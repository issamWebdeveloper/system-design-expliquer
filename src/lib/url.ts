/*
 * View state (cloud, node, flow, step) lives in the query string so any view can
 * be shared. Writes go through the History API, which Next.js keeps in sync with
 * useSearchParams — no navigation or re-render of server components.
 */
export function updateSearchParams(
  changes: Record<string, string | null>,
  options: { mode?: "push" | "replace"; hash?: string } = {},
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  const hash = options.hash ? `#${options.hash}` : "";
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;
  if (options.mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

/** Fired after every updateSearchParams so non-Suspense components can follow the URL. */
export const URL_CHANGE_EVENT = "sde:url-change";

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Fired by "Play on diagram" buttons outside the architecture card. */
export const PLAY_FLOW_EVENT = "sde:play-flow";
