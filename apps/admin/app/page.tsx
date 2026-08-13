"use client";

import { AuthProvider } from "@/features/auth/auth-context";
import { AdminApp } from "@/features/admin/admin-app";
import { OrderingStatusProvider } from "@/features/ordering-status/ordering-status-context";
import { OutletProvider } from "@/features/outlet-context/outlet-context";

export default function Home() {
  return (
    <AuthProvider>
      <OutletProvider>
        <OrderingStatusProvider>
          <AdminApp />
        </OrderingStatusProvider>
      </OutletProvider>
    </AuthProvider>
  );
}
