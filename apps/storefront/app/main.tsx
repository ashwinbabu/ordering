import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StorefrontApp } from "./storefront-app";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StorefrontApp />
  </StrictMode>,
);
