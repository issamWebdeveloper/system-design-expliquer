"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_STORAGE_KEY, localeNames, locales, localizeHref, stripLocale, type Locale } from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/client";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";

/** EN / FR toggle: opens the same page (with its view state) in the other language. */
export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const current = useLocale();
  const t = useMessages();
  const { ref, box } = useSlidingIndicator<HTMLDivElement>(locales.indexOf(current));

  const switchTo = (locale: Locale) => {
    if (locale === current) return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Storage unavailable: the choice still applies through the URL.
    }
    const target = localizeHref(stripLocale(pathname), locale);
    router.push(`${target}${window.location.search}${window.location.hash}`);
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={t.language.label}
      className="relative flex items-center rounded-lg border border-line bg-surface p-0.5"
    >
      <Languages size={14} className="mx-1 shrink-0 text-muted" aria-hidden />
      {box && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-md bg-surface-2 transition-all duration-300 ease-out"
          style={{ left: box.left, width: box.width }}
        />
      )}
      {locales.map((locale) => {
        const active = locale === current;
        const { short, name } = localeNames[locale];
        return (
          <button
            key={locale}
            type="button"
            data-seg
            role="radio"
            lang={locale}
            aria-checked={active}
            aria-label={name}
            title={active ? name : t.language.switchTo(name)}
            onClick={() => switchTo(locale)}
            className={`relative rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              active ? `text-fg ${box ? "" : "bg-surface-2"}` : "text-muted hover:text-fg-soft"
            }`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
