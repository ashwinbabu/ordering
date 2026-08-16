"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrderingStatus,
  getTodayOpeningHours,
  setOrderingStatus,
} from "@/features/ordering-status/api/ordering-status-api";
import { useOutletContext } from "@/features/outlet-context/outlet-context";

interface OrderingStatusContextValue {
  orderingOpen: boolean;
  loading: boolean;
  canManage: boolean;
  scheduleLabel: string | null;
  pauseOrdering: () => Promise<void>;
  resumeOrdering: () => Promise<void>;
}

function formatClockTime(hhmm: string) {
  const [hourStr, minuteStr] = hhmm.split(":");
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function scheduleLabelFor(
  hours: { isClosed: boolean; opensAt: string | null; closesAt: string | null } | null | undefined,
) {
  if (!hours || hours.isClosed || !hours.closesAt) return "Closed today";
  return `Open until ${formatClockTime(hours.closesAt)}`;
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
  const scheduleQuery = useQuery({
    queryKey: ["ordering-status-today-hours", locationId],
    queryFn: () => getTodayOpeningHours(locationId!),
    enabled: Boolean(locationId && canManage),
    staleTime: 60_000,
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
        scheduleLabel: scheduleQuery.data ? scheduleLabelFor(scheduleQuery.data) : null,
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
