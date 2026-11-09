import type { Provider } from "@/types/schema";
import type { Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";

export interface ProviderMeta {
  id: Provider;
  name: string;
  shortName: string;
  /** CSS colour (a theme-aware variable). */
  accent: string;
}

export const providers: ProviderMeta[] = [
  { id: "generic", name: "Generic", shortName: "Generic", accent: "var(--provider-generic)" },
  { id: "aws", name: "Amazon Web Services", shortName: "AWS", accent: "var(--provider-aws)" },
  { id: "gcp", name: "Google Cloud", shortName: "GCP", accent: "var(--provider-gcp)" },
  { id: "azure", name: "Microsoft Azure", shortName: "Azure", accent: "var(--provider-azure)" },
  { id: "oss", name: "Open source / self-hosted", shortName: "Open source", accent: "var(--provider-oss)" },
];

/** Providers with their generic and open-source names in the given language (cloud brands stay as is). */
export function getProviders(locale: Locale): ProviderMeta[] {
  const t = messages[locale].providers;
  return providers.map((p) =>
    p.id === "generic" || p.id === "oss" ? { ...p, name: t[p.id].name, shortName: t[p.id].short } : p,
  );
}

export function getProvider(id: Provider, locale: Locale = "en"): ProviderMeta {
  const list = getProviders(locale);
  return list.find((p) => p.id === id) ?? list[0];
}
