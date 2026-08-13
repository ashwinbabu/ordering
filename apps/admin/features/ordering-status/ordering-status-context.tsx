"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface OrderingStatusContextValue {
  orderingOpen: boolean;
  pauseOrdering: () => void;
  resumeOrdering: () => void;
}

const OrderingStatusContext = createContext<OrderingStatusContextValue | null>(null);

export function OrderingStatusProvider({ children }: { children: ReactNode }) {
  const [orderingOpen, setOrderingOpen] = useState(true);

  return (
    <OrderingStatusContext.Provider value={{ orderingOpen, pauseOrdering: () => setOrderingOpen(false), resumeOrdering: () => setOrderingOpen(true) }}>
      {children}
    </OrderingStatusContext.Provider>
  );
}

export function useOrderingStatus() {
  const context = useContext(OrderingStatusContext);
  if (!context) throw new Error("useOrderingStatus must be used within OrderingStatusProvider.");
  return context;
}
