"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextValue {
  authenticated: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(true);

  return (
    <AuthContext.Provider value={{ authenticated, signIn: () => setAuthenticated(true), signOut: () => setAuthenticated(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
