import SiteHeader from "@/components/site/SiteHeader";
import { getContent } from "@/content";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { buildSearchIndex } from "@/lib/search";

/** Skip link, header and the main scroll container, in one language. */
export default function SiteChrome({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = getMessages(locale);
  const { systemCategoryLabels, systems } = getContent(locale);
  const systemGroups = Object.entries(systemCategoryLabels)
    .map(([category, label]) => ({
      category,
      label,
      systems: systems
        .filter((s) => s.category === category)
        .map(({ slug, name, tagline, category }) => ({ slug, name, tagline, category })),
    }))
    .filter((group) => group.systems.length > 0);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-[#fff] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t.site.skipToContent}
      </a>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <SiteHeader systemGroups={systemGroups} searchIndex={buildSearchIndex(locale)} />
        {/* The single scroll container; section anchors and sticky headers live inside it. */}
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto scroll-smooth focus:outline-none">
          {children}
        </main>
      </div>
    </>
  );
}
