"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { useOutletContextQuery } from "@/features/outlet-context/outlet-context-query";
import { useLocationOrdersChannel } from "@/features/orders/use-location-orders-channel";
import type { AccessibleBusiness, AccessibleLocation } from "@/features/outlet-context/outlet-context-model";

interface OutletContextValue {
  activeBusiness: AccessibleBusiness | null;
  activeLocation: AccessibleLocation | null;
  locations: AccessibleLocation[];
  loading: boolean;
  error: Error | null;
  selectLocation: (locationId: string) => void;
  retry: () => void;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { data, error, isPending, refetch } = useOutletContextQuery(userId);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const locations = data?.locations ?? [];

  const activeLocation = locations.find((location) => location.id === selectedLocationId) ?? locations[0] ?? null;
  const activeBusiness = useMemo(
    () => data?.businesses.find((business) => business.id === activeLocation?.businessId) ?? null,
    [activeLocation?.businessId, data?.businesses],
  );

  // Long-lived, provider-level subscription (not per-screen) so switching
  // outlets re-scopes it automatically via the effect's own cleanup, the
  // same pattern the storefront uses for its customer-orders channel.
  useLocationOrdersChannel(activeBusiness?.id ?? null, activeLocation?.id ?? null);

  return (
    <OutletContext.Provider value={{
      activeBusiness,
      activeLocation,
      locations,
      loading: Boolean(userId) && isPending,
      error: error instanceof Error ? error : null,
      selectLocation: setSelectedLocationId,
      retry: () => { void refetch(); },
    }}>
      {children}
    </OutletContext.Provider>
  );
}

export function useOutletContext() {
  const context = useContext(OutletContext);
  if (!context) throw new Error("useOutletContext must be used within OutletProvider.");
  return context;
}
