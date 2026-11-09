import { useSyncExternalStore } from "react";
import { URL_CHANGE_EVENT } from "./url";

/**
 * Reads one query parameter without useSearchParams, so the component still
 * prerenders (with `fallback`) in the static export and then follows the URL.
 */
export function useUrlParam(name: string, fallback: string): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(URL_CHANGE_EVENT, onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        window.removeEventListener(URL_CHANGE_EVENT, onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    () => new URLSearchParams(window.location.search).get(name) ?? fallback,
    () => fallback,
  );
}
