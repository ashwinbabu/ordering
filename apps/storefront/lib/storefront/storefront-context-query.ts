import { useQuery } from "@tanstack/react-query";
import { resolveStorefrontContext } from "./storefront-context-api";

export function storefrontContextQueryKey(hostname: string) {
  return ["storefront-context", hostname] as const;
}

/**
 * Hostname -> business/location never changes without a deploy, so this is
 * cached for the tab's lifetime. Unlike the other storefront queries, this
 * keeps TanStack's default retry: a transient network failure should retry,
 * but an unknown hostname resolves to `null` data (not a thrown error), so it
 * never enters the retry path at all -- the two failure modes stay naturally
 * distinct without extra logic here.
 */
export function useStorefrontContextQuery(hostname: string) {
  return useQuery({
    queryKey: storefrontContextQueryKey(hostname),
    queryFn: () => resolveStorefrontContext(hostname),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
