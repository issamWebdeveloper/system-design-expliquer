import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SystemPage from "@/components/system/SystemPage";
import { getContent, systems } from "@/content";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

export function systemStaticParams() {
  return systems.map((system) => ({ slug: system.slug }));
}

export function systemMetadata(locale: Locale, slug: string): Metadata {
  const system = getContent(locale).getSystem(slug);
  if (!system) return {};
  return {
    title: getMessages(locale).system.metaTitle(system.name),
    description: `${system.tagline}. ${system.description}`,
  };
}

export default function SystemView({ locale, slug }: { locale: Locale; slug: string }) {
  const system = getContent(locale).getSystem(slug);
  if (!system) notFound();
  return <SystemPage system={system} locale={locale} />;
}
