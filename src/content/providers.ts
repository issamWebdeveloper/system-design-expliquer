import type { Provider } from "@/types/schema";

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

export function getProvider(id: Provider): ProviderMeta {
  return providers.find((p) => p.id === id) ?? providers[0];
}
