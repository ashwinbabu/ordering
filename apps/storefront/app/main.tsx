import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CustomerSessionProvider } from "../features/auth/customer-session";
import { getSupabaseClient } from "../lib/supabase/client";
import { QueryProvider } from "../lib/query-client";
import { StorefrontApp } from "./storefront-app";
import { StorefrontBootstrap } from "./storefront-bootstrap";
import "./globals.css";

// Dev-only: lets a test account sign in from the browser console (e.g.
// window.supabase.auth.signInWithPassword({...})) while MSG91 is unavailable.
// import.meta.env.DEV is stripped by Vite at build time, so this branch does
// not exist in a production bundle.
if (import.meta.env.DEV) {
  (window as unknown as { supabase: ReturnType<typeof getSupabaseClient> }).supabase = getSupabaseClient();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <StorefrontBootstrap>
        <CustomerSessionProvider>
          <StorefrontApp />
        </CustomerSessionProvider>
      </StorefrontBootstrap>
    </QueryProvider>
  </StrictMode>,
);
