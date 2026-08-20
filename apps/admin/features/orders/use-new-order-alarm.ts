"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Order } from "@/features/orders/order-model";

const ALARM_BUCKET = "admin-order-sounds";
const ALARM_FILE = "new-order.wav";
const ALARM_WINDOW_MS = 60_000;

/** The order's `placedAt` as an epoch ms instant, or null if it's missing or
 * unparseable -- either way, never eligible to ring rather than defaulting
 * to "now" and ringing for a timestamp we can't actually trust. */
function placedAtMillis(order: Order): number | null {
  if (!order.placedAt) return null;
  const millis = new Date(order.placedAt).getTime();
  return Number.isNaN(millis) ? null : millis;
}

function isEligible(order: Order, now: number) {
  if (order.status !== "New") return false;
  const placedAt = placedAtMillis(order);
  if (placedAt === null) return false;
  return now - placedAt < ALARM_WINDOW_MS;
}

function shouldRing(orders: Order[], now: number) {
  return orders.some((order) => isEligible(order, now));
}

/** Earliest instant an eligible order ages out of its 60s window, i.e. the
 * next moment `shouldRing` could flip from true to false on its own (as
 * opposed to via an order being accepted, which arrives as a fresh `orders`
 * array and is handled by the effect's own dependency, not this timer). */
function nextExpiry(orders: Order[], now: number): number | null {
  let earliest: number | null = null;
  for (const order of orders) {
    if (order.status !== "New") continue;
    const placedAt = placedAtMillis(order);
    if (placedAt === null) continue;
    const expiry = placedAt + ALARM_WINDOW_MS;
    if (expiry <= now) continue;
    if (earliest === null || expiry < earliest) earliest = expiry;
  }
  return earliest;
}

/**
 * Loops a location's new-order alarm while any order is unaccepted
 * (`status === "New"`) and still within its first 60 seconds -- each New
 * order gets its own 60s eligibility window from its own `placedAt`, so the
 * alarm keeps ringing as long as at least one window is still open.
 *
 * Reads only `ordersQuery.data` (the `orders` param) -- the "order-changed"
 * realtime broadcast (see use-location-orders-channel.ts) carries no order
 * id or status of its own, it only ever invalidates that query, so this
 * hook has no subscription of its own and just reacts to the same refetched
 * list every other order UI reacts to.
 *
 * One `HTMLAudioElement` is created once and kept for the component's
 * lifetime; only its `src` changes (on outlet switch) and only `play`/
 * `pause` are called across re-evaluations, so a refetch that doesn't
 * change whether the alarm should be ringing never restarts playback. The
 * 60s cutoff is enforced by a single `setTimeout` scheduled for the
 * earliest upcoming expiry rather than polling, since nothing else forces a
 * re-check exactly when an order ages out.
 *
 * Autoplay recovery: if the browser blocks `audio.play()` because there's
 * been no user gesture yet, the alarm doesn't just give up until the next
 * `orders` refetch happens to retry it -- it listens for the operator's
 * very next `pointerdown`/`keydown` anywhere on the page and retries
 * immediately (re-checking `shouldRing` at that moment, since the order may
 * have been accepted in the meantime), then removes those listeners as soon
 * as playback actually starts.
 */
export function useNewOrderAlarm(orders: Order[], locationId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const locationIdRef = useRef<string | null>(null);
  const ordersRef = useRef<Order[]>(orders);
  const unlockAttachedRef = useRef(false);
  ordersRef.current = orders;

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Rebuild the audio source when the active outlet changes, stopping
  // whatever was ringing for the previous location first.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || locationIdRef.current === locationId) return;
    locationIdRef.current = locationId;

    audio.pause();
    audio.currentTime = 0;
    isPlayingRef.current = false;

    if (!locationId) {
      audio.removeAttribute("src");
      return;
    }
    const { data } = supabase.storage
      .from(ALARM_BUCKET)
      .getPublicUrl(`${locationId}/${ALARM_FILE}`);
    audio.src = data.publicUrl;
  }, [locationId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !locationId) return;

    let timer: number | undefined;

    function detachUnlockListeners() {
      if (!unlockAttachedRef.current) return;
      unlockAttachedRef.current = false;
      document.removeEventListener("pointerdown", handleUnlock);
      document.removeEventListener("keydown", handleUnlock);
    }

    function attachUnlockListeners() {
      if (unlockAttachedRef.current) return;
      unlockAttachedRef.current = true;
      document.addEventListener("pointerdown", handleUnlock);
      document.addEventListener("keydown", handleUnlock);
    }

    // Attempts playback; on success marks us playing and drops any unlock
    // listeners, on failure (blocked autoplay) leaves isPlayingRef false and
    // arms the listeners so the operator's next gesture retries.
    function attemptPlay() {
      if (isPlayingRef.current) return;
      audio
        ?.play()
        .then(() => {
          isPlayingRef.current = true;
          detachUnlockListeners();
        })
        .catch(() => {
          isPlayingRef.current = false;
          attachUnlockListeners();
        });
    }

    function handleUnlock() {
      if (!shouldRing(ordersRef.current, Date.now())) {
        detachUnlockListeners();
        return;
      }
      attemptPlay();
    }

    function evaluate() {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }

      const now = Date.now();
      const ringing = shouldRing(orders, now);
      if (ringing) {
        attemptPlay();
      } else {
        if (isPlayingRef.current) {
          isPlayingRef.current = false;
          audio?.pause();
          if (audio) audio.currentTime = 0;
        }
        detachUnlockListeners();
      }

      const expiry = nextExpiry(orders, now);
      if (expiry !== null) {
        timer = window.setTimeout(evaluate, Math.max(0, expiry - Date.now()));
      }
    }

    evaluate();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      detachUnlockListeners();
    };
  }, [orders, locationId]);
}
