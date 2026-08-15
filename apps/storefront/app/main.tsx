import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CustomerSessionProvider } from "../features/auth/customer-session";
import { QueryProvider } from "../lib/query-client";
import { StorefrontApp } from "./storefront-app";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <CustomerSessionProvider>
        <StorefrontApp />
      </CustomerSessionProvider>
    </QueryProvider>
  </StrictMode>,
);
