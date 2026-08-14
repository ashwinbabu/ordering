"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrderingStatus,
  setOrderingStatus,
} from "@/features/ordering-status/api/ordering-status-api";
import { useOutletContext } from "@/features/outlet-context/outlet-context";

interface OrderingStatusContextValue {
  orderingOpen: boolean;
  loading: boolean;
  canManage: boolean;
  pauseOrdering: () => Promise<void>;
  resumeOrdering: () => Promise<void>;
}

const OrderingStatusContext = createContext<OrderingStatusContextValue | null>(
  null,
);

export function OrderingStatusProvider({ children }: { children: ReactNode }) {
  const { activeBusiness, activeLocation } = useOutletContext();
  const queryClient = useQueryClient();
  const canManage =
    activeBusiness?.role === "owner" || activeBusiness?.role === "admin";
  const locationId = activeLocation?.id ?? null;
  const statusQuery = useQuery({
    queryKey: ["ordering-status", locationId],
    queryFn: () => getOrderingStatus(locationId!),
    enabled: Boolean(locationId && canManage),
    staleTime: 15_000,
  });
  const statusMutation = useMutation({
    mutationFn: (orderingEnabled: boolean) =>
      setOrderingStatus(locationId!, orderingEnabled),
    onSuccess: async (orderingEnabled) => {
      queryClient.setQueryData(
        ["ordering-status", locationId],
        orderingEnabled,
      );
      await queryClient.invalidateQueries({
        queryKey: ["business-settings", activeBusiness?.id ?? null, locationId],
      });
    },
  });

  async function setStatus(orderingEnabled: boolean) {
    if (!locationId || !canManage)
      throw new Error(
        "Only a business owner or admin can change ordering status.",
      );
    await statusMutation.mutateAsync(orderingEnabled);
  }

  return (
    <OrderingStatusContext.Provider
      value={{
        orderingOpen: statusQuery.data ?? true,
        loading: statusQuery.isPending || statusMutation.isPending,
        canManage,
        pauseOrdering: () => setStatus(false),
        resumeOrdering: () => setStatus(true),
      }}
    >
      {children}
    </OrderingStatusContext.Provider>
  );
}

export function useOrderingStatus() {
  const context = useContext(OrderingStatusContext);
  if (!context)
    throw new Error(
      "useOrderingStatus must be used within OrderingStatusProvider.",
    );
  return context;
}
