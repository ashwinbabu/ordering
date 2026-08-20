"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// Supabase throws a PostgrestError-shaped object (or plain Error) rather than
// rejecting the fetch itself. A `code` of "" means the request never reached
// the database (network/DNS/timeout) and is worth one retry. Any other code
// is a definite response from Postgres or PostgREST -- permission denial,
// validation failure, concurrency conflict -- and retrying reproduces the
// same failure.
function isRetryableQueryError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === ""
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              failureCount < 1 && isRetryableQueryError(error),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
