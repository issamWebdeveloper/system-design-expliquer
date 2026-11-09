import type { Metadata } from "next";
import SiteChrome from "@/components/site/SiteChrome";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = {
  title: t.site.name,
  description: t.site.description,
  openGraph: { locale: "fr_FR" },
};

export default function FrenchLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="fr">{children}</SiteChrome>;
}
