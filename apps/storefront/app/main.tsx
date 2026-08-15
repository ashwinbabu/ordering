import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryProvider } from "../lib/query-client";
import { StorefrontApp } from "./storefront-app";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <StorefrontApp />
    </QueryProvider>
  </StrictMode>,
);
