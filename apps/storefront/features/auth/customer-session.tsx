import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { splitE164, type PhoneNumber } from "../../domain/phone";
import type { CustomerProfile } from "../../domain/storefront";
import { getSupabaseClient } from "../../lib/supabase/client";

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
  isLoading: boolean;
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
  const [localOverride, setLocalOverride] = useState<Partial<CustomerProfile>>({});
  const [customerLoaded, setCustomerLoaded] = useState(true);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
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

    const fetchCustomer = session
      ? getSupabaseClient()
          .schema("core")
          .from("customers")
          .select("id, phone_e164, display_name, email, phone_verified_at")
          .eq("auth_user_id", session.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    fetchCustomer.then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        if (error) console.error("Could not load the signed-in customer profile.", error);
        setCustomerId(null);
        setBaseProfile(null);
      } else {
        const row = data as CustomerRow;
        setCustomerId(row.id);
        setBaseProfile(profileFromRow(row));
        setDemoProfile(null); // a real session supersedes any demo sign-in
      }
      setLocalOverride({});
      setCustomerLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [session]);

  async function signOut() {
    setDemoProfile(null);
    await getSupabaseClient().auth.signOut();
  }

  function updateLocalProfile(patch: Partial<CustomerProfile>) {
    setLocalOverride((current) => ({ ...current, ...patch }));
  }

  function completeDemoSignIn(phone: PhoneNumber) {
    setDemoProfile({ name: "", countryCode: phone.countryCode, phone: phone.phone, isPhoneVerified: true });
    setLocalOverride({});
  }

  const customer = useMemo(() => {
    const source = baseProfile ?? demoProfile;
    return source ? { ...source, ...localOverride } : null;
  }, [baseProfile, demoProfile, localOverride]);

  const value: CustomerSessionValue = {
    customer,
    customerId,
    isLoading: !sessionLoaded || !customerLoaded,
    signOut,
    updateLocalProfile,
    completeDemoSignIn,
  };

  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context) throw new Error("useCustomerSession must be used within CustomerSessionProvider.");
  return context;
}
