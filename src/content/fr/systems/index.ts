import type { ContentTranslation } from "../../translation";
import { amazon } from "./amazon";
import { bookmyshow } from "./bookmyshow";
import { dropbox } from "./dropbox";
import { googleMaps } from "./google-maps";
import { instagram } from "./instagram";
import { netflix } from "./netflix";
import { pastebin } from "./pastebin";
import { payments } from "./payments";
import { rateLimiter } from "./rate-limiter";
import { twitter } from "./twitter";
import { typeahead } from "./typeahead";
import { uber } from "./uber";
import { urlShortener } from "./url-shortener";
import { webCrawler } from "./web-crawler";
import { webrtc } from "./webrtc";
import { websocketScale } from "./websocket-scale";
import { whatsapp } from "./whatsapp";
import { youtube } from "./youtube";

/** French translations of the system designs, keyed by slug. Missing systems are shown in English. */
export const frSystems: NonNullable<ContentTranslation["systems"]> = {
  amazon,
  bookmyshow,
  dropbox,
  "google-maps": googleMaps,
  instagram,
  netflix,
  pastebin,
  payments,
  "rate-limiter": rateLimiter,
  twitter,
  typeahead,
  uber,
  "url-shortener": urlShortener,
  "web-crawler": webCrawler,
  webrtc,
  "websocket-scale": websocketScale,
  whatsapp,
  youtube,
};
