import { useQuery } from "@tanstack/react-query";
import { getOperatorOutletContext } from "@/features/outlet-context/api/outlet-context-api";

export function useOutletContextQuery(authUserId: string | null) {
  return useQuery({
    queryKey: ["outlet-context", authUserId],
    queryFn: getOperatorOutletContext,
    enabled: Boolean(authUserId),
    retry: false,
    staleTime: 60_000,
  });
}
