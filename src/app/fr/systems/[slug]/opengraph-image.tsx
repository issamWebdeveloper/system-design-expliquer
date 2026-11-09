import { systemOgImage } from "@/lib/ogImages";
import { systems } from "@/content";
import { getMessages } from "@/i18n/messages";
import { ogSize } from "@/lib/og";

export const alt = getMessages("fr").og.systemAlt;
export const size = ogSize;
export const contentType = "image/png";
// Rendered once at build time for the static export.
export const dynamic = "force-static";

export function generateStaticParams() {
  return systems.map((system) => ({ slug: system.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return systemOgImage("fr", (await params).slug);
}
