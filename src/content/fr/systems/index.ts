import type { ContentTranslation } from "../../translation";
import { amazon } from "./amazon";
import { instagram } from "./instagram";
import { netflix } from "./netflix";
import { payments } from "./payments";
import { rateLimiter } from "./rate-limiter";
import { twitter } from "./twitter";
import { typeahead } from "./typeahead";
import { uber } from "./uber";
import { urlShortener } from "./url-shortener";
import { webCrawler } from "./web-crawler";
import { whatsapp } from "./whatsapp";
import { youtube } from "./youtube";

/** French translations of the system designs, keyed by slug. Missing systems are shown in English. */
export const frSystems: NonNullable<ContentTranslation["systems"]> = {
  amazon,
  instagram,
  netflix,
  payments,
  "rate-limiter": rateLimiter,
  twitter,
  typeahead,
  uber,
  "url-shortener": urlShortener,
  "web-crawler": webCrawler,
  whatsapp,
  youtube,
};
