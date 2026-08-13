"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const branches = ["A2 · Mandrem", "A2 · Arambol"];

interface OutletContextValue {
  activeBranch: string;
  branches: string[];
  setActiveBranch: (branch: string) => void;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({ children }: { children: ReactNode }) {
  const [activeBranch, setActiveBranch] = useState(branches[0]);

  return <OutletContext.Provider value={{ activeBranch, branches, setActiveBranch }}>{children}</OutletContext.Provider>;
}

export function useOutletContext() {
  const context = useContext(OutletContext);
  if (!context) throw new Error("useOutletContext must be used within OutletProvider.");
  return context;
}
