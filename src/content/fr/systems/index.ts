import type { ContentTranslation } from "../../translation";
import { airbnb } from "./airbnb";
import { airline } from "./airline";
import { amazon } from "./amazon";
import { astrotalk } from "./astrotalk";
import { bookmyshow } from "./bookmyshow";
import { carRental } from "./car-rental";
import { driverFleet } from "./driver-fleet";
import { dropbox } from "./dropbox";
import { googleMaps } from "./google-maps";
import { instagram } from "./instagram";
import { makemytrip } from "./makemytrip";
import { meetingScheduler } from "./meeting-scheduler";
import { netflix } from "./netflix";
import { nobroker } from "./nobroker";
import { pastebin } from "./pastebin";
import { payments } from "./payments";
import { porter } from "./porter";
import { practo } from "./practo";
import { rateLimiter } from "./rate-limiter";
import { twitter } from "./twitter";
import { typeahead } from "./typeahead";
import { uber } from "./uber";
import { urbanCompany } from "./urban-company";
import { urlShortener } from "./url-shortener";
import { webCrawler } from "./web-crawler";
import { webrtc } from "./webrtc";
import { websocketScale } from "./websocket-scale";
import { whatsapp } from "./whatsapp";
import { youtube } from "./youtube";
import { zomato } from "./zomato";

/** French translations of the system designs, keyed by slug. Missing systems are shown in English. */
export const frSystems: NonNullable<ContentTranslation["systems"]> = {
  airbnb,
  airline,
  amazon,
  astrotalk,
  bookmyshow,
  "car-rental": carRental,
  "driver-fleet": driverFleet,
  dropbox,
  "google-maps": googleMaps,
  instagram,
  makemytrip,
  "meeting-scheduler": meetingScheduler,
  netflix,
  nobroker,
  pastebin,
  payments,
  porter,
  practo,
  "rate-limiter": rateLimiter,
  twitter,
  typeahead,
  uber,
  "urban-company": urbanCompany,
  "url-shortener": urlShortener,
  "web-crawler": webCrawler,
  webrtc,
  "websocket-scale": websocketScale,
  whatsapp,
  youtube,
  zomato,
};
