import { getContent } from "@/content";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { ogCard } from "./og";

/** Social preview for the home page. */
export function homeOgImage(locale: Locale) {
  const t = getMessages(locale).og;
  return ogCard({
    eyebrow: t.homeEyebrow(getContent(locale).systems.length),
    title: t.homeTitle,
    subtitle: t.homeSubtitle,
    chips: ["AWS", "Google Cloud", "Azure", getMessages(locale).providers.oss.short],
  });
}

/** Social preview for one system page. */
export function systemOgImage(locale: Locale, slug: string) {
  const t = getMessages(locale).og;
  const { getConcept, getSystem, systemCategoryLabels } = getContent(locale);
  const system = getSystem(slug);
  if (!system) return ogCard({ eyebrow: t.systemDesign, title: slug, subtitle: "" });

  return ogCard({
    eyebrow: `${systemCategoryLabels[system.category]} · ${t.systemDesign.toLowerCase()}`,
    title: system.name,
    subtitle: system.tagline,
    chips: system.concepts.slice(0, 3).map((c) => getConcept(c)?.name ?? c),
  });
}
