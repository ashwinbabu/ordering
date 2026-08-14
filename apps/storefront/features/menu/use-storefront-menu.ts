import { useCallback, useEffect, useState } from "react";
import type { StorefrontMenu } from "../../domain/storefront";
import { getStorefrontMenu } from "./api/storefront-menu-api";

type StorefrontMenuState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: StorefrontMenu; error: null }
  | { status: "error"; data: null; error: Error };

export function useStorefrontMenu(locationId: string) {
  const [state, setState] = useState<StorefrontMenuState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });

    void getStorefrontMenu(locationId)
      .then((menu) => {
        if (cancelled) return;
        if (!menu) {
          setState({
            status: "error",
            data: null,
            error: new Error("This restaurant location is not available."),
          });
          return;
        }
        setState({ status: "ready", data: menu, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error : new Error("Could not load the menu."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, reloadToken]);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);
  return { ...state, retry };
}
