import SiteChrome from "@/components/site/SiteChrome";

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="en">{children}</SiteChrome>;
}
