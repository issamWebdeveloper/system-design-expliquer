import { homeOgImage } from "@/lib/ogImages";
import { getMessages } from "@/i18n/messages";
import { ogSize } from "@/lib/og";

export const alt = getMessages("en").og.homeAlt;
export const size = ogSize;
export const contentType = "image/png";
// Rendered once at build time for the static export.
export const dynamic = "force-static";

export default function Image() {
  return homeOgImage("en");
}
