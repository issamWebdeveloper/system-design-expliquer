"use client";

import { forwardRef, type ComponentProps } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPath, localizeHref, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/** The current locale, read from the URL (works during static prerender too). */
export function useLocale(): Locale {
  return localeFromPath(usePathname() ?? "/");
}

/** Interface text for the current locale. */
export function useMessages(): Messages {
  return messages[useLocale()];
}

/** Turns an internal path into the current locale's version of it. */
export function useLocalizeHref(): (href: string) => string {
  const locale = useLocale();
  return (href) => localizeHref(href, locale);
}

/** next/link that keeps the reader in their language: "/systems/x" → "/fr/systems/x" on French pages. */
const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function Link({ href, ...props }, ref) {
  const locale = useLocale();
  const localized = typeof href === "string" ? localizeHref(href, locale) : href;
  return <NextLink ref={ref} href={localized} {...props} />;
});

export default Link;
