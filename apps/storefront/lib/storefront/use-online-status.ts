import { useEffect, useState } from "react";

// Server-dependent cart actions (coupon validation, delivery pricing,
// checkout) must not pretend to succeed while offline; this is the single
// signal those call sites gate on.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    function goOnline() { setIsOnline(true); }
    function goOffline() { setIsOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
