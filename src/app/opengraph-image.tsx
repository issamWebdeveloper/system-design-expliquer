import { ogCard, ogSize } from "@/lib/og";
import { systems } from "@/content";

export const alt = "System Design Explainer — how large systems are built, on any cloud";
export const size = ogSize;
export const contentType = "image/png";
// Rendered once at build time for the static export.
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    eyebrow: `${systems.length} system designs`,
    title: "How are large systems built?",
    subtitle: "Interactive architectures you can switch between AWS, Google Cloud, Azure and open source.",
    chips: ["AWS", "Google Cloud", "Azure", "Open source"],
  });
}
