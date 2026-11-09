/*
 * Locales and URL helpers. English lives at the site root (/systems/youtube),
 * every other locale under its own prefix (/fr/systems/youtube), so both are
 * plain static pages and links can be shared in either language.
 */
export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  fr: { short: "FR", name: "Français" },
};

/** Remembers the reader's last explicit choice (see LanguageSwitcher). */
export const LOCALE_STORAGE_KEY = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** The locale a pathname belongs to: "/fr" and "/fr/…" are French, everything else English. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split("/")[1];
  return isLocale(first) && first !== defaultLocale ? first : defaultLocale;
}

/** The pathname without its locale prefix ("/fr/concepts/" → "/concepts/"). */
export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname);
  if (locale === defaultLocale) return pathname || "/";
  const rest = pathname.slice(locale.length + 1);
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Prefixes an internal href with the locale. External links, hash-only links and
 * hrefs that already carry a locale are returned unchanged.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (locale === defaultLocale || !href.startsWith("/") || href.startsWith("//")) return href;
  if (localeFromPath(href) !== defaultLocale) return href;
  // "/" → "/fr/", "/#catalogue" → "/fr/#catalogue", "/systems/x" → "/fr/systems/x".
  return `/${locale}${href}`;
}

/** Inline script for <head>: sets <html lang> from the URL before first paint. */
export const langInitScript = `(function(){try{var p=location.pathname.split('/')[1];document.documentElement.lang=${JSON.stringify(
  locales.filter((l) => l !== defaultLocale),
)}.indexOf(p)>=0?p:${JSON.stringify(defaultLocale)};}catch(e){}})();`;
