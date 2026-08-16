import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CustomerSessionProvider } from "../features/auth/customer-session";
import { QueryProvider } from "../lib/query-client";
import { StorefrontApp } from "./storefront-app";
import { StorefrontBootstrap } from "./storefront-bootstrap";
import "./globals.css";

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
