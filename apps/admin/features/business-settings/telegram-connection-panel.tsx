"use client";

import { useState } from "react";
import { CircleAlert, Copy, ExternalLink } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  useBusinessNotificationPreferencesQuery,
  useCreateOwnerPairingTokenMutation,
  useCreateStaffGroupPairingTokenMutation,
  useSetBusinessNotificationPreferencesMutation,
  useTelegramConnectionQuery,
} from "@/features/business-settings/telegram-query";

interface TelegramConnectionPanelProps {
  businessId: string;
  locationId: string;
}

export function TelegramConnectionPanel({
  businessId,
  locationId,
}: TelegramConnectionPanelProps) {
  const statusQuery = useTelegramConnectionQuery(businessId, locationId, true);
  const createTokenMutation = useCreateStaffGroupPairingTokenMutation(
    businessId,
    locationId,
  );
  const createOwnerTokenMutation = useCreateOwnerPairingTokenMutation(
    businessId,
    locationId,
  );
  const preferencesQuery = useBusinessNotificationPreferencesQuery(
    businessId,
    true,
  );
  const setPreferencesMutation =
    useSetBusinessNotificationPreferencesMutation(businessId);
  const [pairing, setPairing] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ownerPairing, setOwnerPairing] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);

  async function handleConnect() {
    setCopied(false);
    const result = await createTokenMutation.mutateAsync();
    setPairing(result);
  }

  async function handleConnectOwner() {
    const result = await createOwnerTokenMutation.mutateAsync();
    setOwnerPairing(result);
  }

  const status = statusQuery.data;
  const connected = status?.staffGroup.connected ?? false;
  const myConnected = status?.myConnection.connected ?? false;
  const command = pairing ? `/connect ${pairing.token}` : "";
  const deepLink =
    ownerPairing && status?.botUsername
      ? `https://t.me/${status.botUsername}?start=${ownerPairing.token}`
      : null;

  return (
    <section id="settings-notifications" className="settings-section">
      <div className="settings-section-head">
        <div>
          <h2>Telegram notifications</h2>
          <p>Send new-order alerts to your restaurant&apos;s Telegram group.</p>
        </div>
      </div>

      {statusQuery.isPending ? (
        <p className="read-only-meta">Checking connection…</p>
      ) : statusQuery.error ? (
        <p className="read-only-meta">Couldn&apos;t load Telegram status.</p>
      ) : (
        <>
          <div className="operational-setting">
            <span>
              <strong>Staff group</strong>
              <small>
                {connected
                  ? `Connected · ${status?.staffGroup.chatTitle ?? "Telegram group"}`
                  : "Not connected"}
              </small>
            </span>
            <button
              className="secondary-button compact-button"
              disabled={createTokenMutation.isPending}
              onClick={() => {
                void handleConnect();
              }}
            >
              {connected ? "Reconnect" : "Connect Telegram group"}
            </button>
          </div>

          {pairing && (
            <div className="telegram-pairing-box">
              <ol>
                <li>
                  Add {status?.botUsername ? `@${status.botUsername}` : "the bot"} to
                  your staff Telegram group.
                </li>
                <li>
                  Send this command in the group:
                  <div className="telegram-token-row">
                    <code>{command}</code>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(command);
                        setCopied(true);
                      }}
                    >
                      <Copy size={13} />
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
              </ol>
              <small>This code expires in 15 minutes.</small>
            </div>
          )}

          {createTokenMutation.error && (
            <p className="telegram-error-text">
              <CircleAlert size={14} />
              {createTokenMutation.error instanceof Error
                ? createTokenMutation.error.message
                : "Couldn't generate a code."}
            </p>
          )}

          <div className="operational-setting" style={{ marginTop: 12 }}>
            <span>
              <strong>Your Telegram</strong>
              <small>
                {myConnected
                  ? "Connected · you'll get order alerts sent to this account too"
                  : "Not connected"}
              </small>
            </span>
            <button
              className="secondary-button compact-button"
              disabled={createOwnerTokenMutation.isPending}
              onClick={() => {
                void handleConnectOwner();
              }}
            >
              {myConnected ? "Reconnect my Telegram" : "Connect my Telegram"}
            </button>
          </div>

          {ownerPairing && (
            <div className="telegram-pairing-box">
              {deepLink ? (
                <>
                  <a
                    className="secondary-button compact-button"
                    href={deepLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} />
                    Open Telegram
                  </a>
                  <small>This opens a private chat with the bot and connects automatically.</small>
                </>
              ) : (
                <>
                  <p>
                    Open a private chat with the bot and send:
                  </p>
                  <div className="telegram-token-row">
                    <code>/start {ownerPairing.token}</code>
                  </div>
                </>
              )}
              <small>This code expires in 15 minutes.</small>
            </div>
          )}

          {createOwnerTokenMutation.error && (
            <p className="telegram-error-text">
              <CircleAlert size={14} />
              {createOwnerTokenMutation.error instanceof Error
                ? createOwnerTokenMutation.error.message
                : "Couldn't generate a code."}
            </p>
          )}

          <div className="settings-toggle-line">
            <Toggle
              checked={preferencesQuery.data?.notifyOwnerOnCancellation ?? false}
              disabled={preferencesQuery.isPending || setPreferencesMutation.isPending}
              onChange={() => {
                void setPreferencesMutation.mutateAsync(
                  !(preferencesQuery.data?.notifyOwnerOnCancellation ?? false),
                );
              }}
              label="Also alert owner on cancellations"
            />
            <span>
              <strong>Also alert owner on cancellations</strong>
              <small>Staff group always gets cancellation alerts; this adds your Telegram too.</small>
            </span>
          </div>

          <div className="telegram-matrix-note">
            <small>
              Staff group: new orders, cancellations, orders waiting 3+/8+ min, store paused/resumed.
              Owner: orders waiting 8+ min, store paused/resumed, daily sales summary (11 PM local time)
              {preferencesQuery.data?.notifyOwnerOnCancellation ? ", cancellations" : ""}.
            </small>
          </div>
        </>
      )}
    </section>
  );
}
