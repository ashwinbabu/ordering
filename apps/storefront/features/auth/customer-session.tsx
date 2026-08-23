import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { splitE164, type PhoneNumber } from "../../domain/phone";
import type { CustomerProfile } from "../../domain/storefront";
import { getSupabaseClient } from "../../lib/supabase/client";
import { storefrontContext } from "../../lib/storefront/storefront-context";
import { resolveCustomerBusinessId } from "./api/customer-business-api";
import { useCustomerOrdersChannel } from "../orders/use-customer-orders-channel";
import { clearCartPointer } from "../cart/cart-pointer-storage";

interface CustomerRow {
  id: string;
  phone_e164: string;
  display_name: string | null;
  email: string | null;
  phone_verified_at: string | null;
}

interface CustomerSessionValue {
  customer: CustomerProfile | null;
  customerId: string | null;
  /**
   * Reads the current customerId at call time, not the value closed over
   * when a caller was created. `customerId` above is a normal render value
   * -- correct for query keys and reactive UI, but a closure that captures
   * it can go stale if auth transitions while that closure is still
   * running (e.g. mid-mutation, or during a cart-identity recovery retry).
   * This getter is backed by a ref kept in sync with `customerId` on every
   * render, so any code that must observe an auth change that happens
   * *during* an in-flight async operation should call this instead of
   * closing over the plain value.
   */
  getCustomerId: () => string | null;
  isLoading: boolean;
  /**
   * True only when a Supabase session exists but the core.customers row
   * lookup for it genuinely failed (the select itself errored) -- not when
   * it simply found no row. Lets a caller like RequireCustomer distinguish
   * "not signed in" (customer === null, no error: show the auth sheet) from
   * "signed in, but we couldn't read their profile" (a real backend/data
   * problem re-running OTP cannot fix), rather than treating both the same
   * way `customer === null` alone would.
   */
  customerLoadError: boolean;
  /** Re-runs the same core.customers lookup loadCustomer() performs, for a "Try again" action after customerLoadError. */
  retryCustomerLoad: () => void;
  signOut: () => Promise<void>;
  /**
   * Merges a patch into the in-memory profile only. There is no RLS write
   * policy for core.customers - name/email edits are local-only, matching
   * how the rest of the storefront treats non-auth data as demo state.
   */
  updateLocalProfile: (patch: Partial<CustomerProfile>) => void;
  /**
   * use-otp-verification.ts calls this when MSG91 isn't configured and a
   * demo code was accepted - no real MSG91/Supabase session ever gets
   * minted in that path, so without this the account screen would wait
   * forever for a customer row that's never coming. Local-only, cleared on
   * sign-out or once a real session arrives.
   */
  completeDemoSignIn: (phone: PhoneNumber) => void;
}

const CustomerSessionContext = createContext<CustomerSessionValue | null>(null);

function profileFromRow(row: CustomerRow): CustomerProfile {
  const phone = splitE164(row.phone_e164);
  return {
    name: row.display_name ?? "",
    countryIso2: phone.countryIso2,
    countryCode: phone.countryCode,
    phone: phone.phone,
    email: row.email ?? undefined,
    isPhoneVerified: Boolean(row.phone_verified_at),
  };
}

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [baseProfile, setBaseProfile] = useState<CustomerProfile | null>(null);
  const [demoProfile, setDemoProfile] = useState<CustomerProfile | null>(null);
  const [localOverride, setLocalOverride] = useState<Partial<CustomerProfile>>(
    {},
  );
  const [customerLoaded, setCustomerLoaded] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState(false);
  // Bumped by retryCustomerLoad() to re-run the effect below without
  // depending on `session` having actually changed.
  const [reloadToken, setReloadToken] = useState(0);
  // True only once core.customer_businesses is confirmed to exist for this
  // session -- the Realtime RLS policy for the customer-orders channel
  // requires that row, and it's created by a separate async step below, so
  // "authUserId is set" alone is not enough to know the channel can be
  // joined yet.
  const [customerBusinessReady, setCustomerBusinessReady] = useState(false);
  // Mirrors `customerId` for callers that need its *current* value from
  // inside an async operation that may outlive the render that started it
  // (see `getCustomerId` below). Written only by setCurrentCustomerId,
  // synchronously with the state below it -- an effect-based mirror would
  // leave a window, between the state committing and the effect running,
  // where getCustomerId() could still return the previous value.
  const customerIdRef = useRef<string | null>(null);
  const setCurrentCustomerId = useCallback((next: string | null) => {
    customerIdRef.current = next;
    setCustomerId(next);
  }, []);
  const getCustomerId = useCallback(() => customerIdRef.current, []);

  // Lives here (not in the Orders screen) so the customer keeps receiving
  // order-change notifications while on any screen, with exactly one
  // subscription for the whole session -- re-subscribing automatically if
  // they sign in/out (authUserId changes) via the hook's own cleanup.
  useCustomerOrdersChannel(
    session?.user.id ?? null,
    customerId,
    customerBusinessReady,
  );

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    // A session transition invalidates the previous customer lookup. Keep
    // gated routes in their loading state until the new session's customer
    // row has been resolved; otherwise RequireCustomer can reopen the OTP
    // sheet during the small window between session installation and profile
    // hydration.
    setCustomerLoaded(false);
    setCustomerBusinessReady(false);
    setCustomerLoadError(false);

    async function loadCustomer() {
      const fetchCustomer = session
        ? getSupabaseClient()
            .schema("core")
            .from("customers")
            .select("id, phone_e164, display_name, email, phone_verified_at")
            .eq("auth_user_id", session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const { data, error } = await fetchCustomer;
      if (!active) return;

      if (error || !data) {
        if (error) {
          console.error(
            "Could not load the signed-in customer profile.",
            error,
          );
          // Only a genuine read failure, never a legitimate "no row yet" --
          // that case (no error, just !data) stays on the ordinary
          // sign-in path below via customer === null.
          setCustomerLoadError(true);
        }
        setCurrentCustomerId(null);
        setBaseProfile(null);
        setLocalOverride({});
        setCustomerLoaded(true);
        return;
      }

      const row = data as CustomerRow;
      setCurrentCustomerId(row.id);
      setBaseProfile(profileFromRow(row));
      setDemoProfile(null); // a real session supersedes any demo sign-in
      setLocalOverride({});
      setCustomerLoaded(true);

      // Idempotent (DB-level upsert on business_id+customer_id) -- safe to
      // call on every session resolution, not just the first sign-in.
      // Awaited (not fire-and-forget) so customerBusinessReady only flips
      // once the row the Realtime RLS policy checks for actually exists --
      // subscribing before this resolves is what caused the private
      // customer-orders channel to be rejected as unauthorized.
      try {
        await resolveCustomerBusinessId(storefrontContext.businessId, row.id);
        if (active) setCustomerBusinessReady(true);
      } catch (linkError) {
        console.error(
          "Could not link this customer to the current business.",
          linkError,
        );
      }
    }

    void loadCustomer();

    return () => {
      active = false;
    };
  }, [session, setCurrentCustomerId, reloadToken]);

  const retryCustomerLoad = useCallback(
    () => setReloadToken((token) => token + 1),
    [],
  );

  async function signOut() {
    setDemoProfile(null);
    // Without this, the next anonymous bootstrap would try this customer's
    // cart pointer and either leak it into the new anonymous session or --
    // on a shared device -- into whichever customer signs in next.
    clearCartPointer(storefrontContext);
    await getSupabaseClient().auth.signOut();
  }

  function updateLocalProfile(patch: Partial<CustomerProfile>) {
    setLocalOverride((current) => ({ ...current, ...patch }));
  }

  function completeDemoSignIn(phone: PhoneNumber) {
    setDemoProfile({
      name: "",
      countryIso2: phone.countryIso2,
      countryCode: phone.countryCode,
      phone: phone.phone,
      isPhoneVerified: true,
    });
    setLocalOverride({});
  }

  const customer = useMemo(() => {
    const source = baseProfile ?? demoProfile;
    return source ? { ...source, ...localOverride } : null;
  }, [baseProfile, demoProfile, localOverride]);

  const value: CustomerSessionValue = {
    customer,
    customerId,
    getCustomerId,
    isLoading: !sessionLoaded || !customerLoaded,
    customerLoadError,
    retryCustomerLoad,
    signOut,
    updateLocalProfile,
    completeDemoSignIn,
  };

  return (
    <CustomerSessionContext.Provider value={value}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context)
    throw new Error(
      "useCustomerSession must be used within CustomerSessionProvider.",
    );
  return context;
}
