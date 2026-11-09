export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "sde:theme-change";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Keep in sync with resolveTheme below.
 */
export const themeInitScript = `(function(){try{var m=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var light=m==="light"||(m==="system"&&matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=light?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemeMode(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
  document.documentElement.dataset.theme = resolveTheme(mode);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Subscribe to mode changes (this tab, other tabs, and OS changes while in "system"). */
export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSystemChange = () => {
    if (readThemeMode() === "system") document.documentElement.dataset.theme = resolveTheme("system");
    onChange();
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onSystemChange);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onSystemChange);
    media.removeEventListener("change", onSystemChange);
  };
}
