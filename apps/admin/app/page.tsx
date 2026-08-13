"use client";

import { AuthProvider } from "@/features/auth/auth-context";
import { AdminApp } from "@/features/admin/admin-app";
import { OrderingStatusProvider } from "@/features/ordering-status/ordering-status-context";
import { OutletProvider } from "@/features/outlet-context/outlet-context";
import { QueryProvider } from "@/lib/query-client";

export default function Home() {
  return (
    <QueryProvider>
      <AuthProvider>
        <OutletProvider>
          <OrderingStatusProvider>
            <AdminApp />
          </OrderingStatusProvider>
        </OutletProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
