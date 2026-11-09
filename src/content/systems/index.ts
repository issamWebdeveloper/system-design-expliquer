import type { SystemDesignInput } from "@/types/schema";
import { uber } from "./uber";
import { youtube } from "./youtube";
import { instagram } from "./instagram";
import { twitter } from "./twitter";
import { amazon } from "./amazon";
import { netflix } from "./netflix";
import { whatsapp } from "./whatsapp";
import { payments } from "./payments";
import { urlShortener } from "./url-shortener";
import { rateLimiter } from "./rate-limiter";
import { typeahead } from "./typeahead";
import { webCrawler } from "./web-crawler";
import { pastebin } from "./pastebin";
import { dropbox } from "./dropbox";
import { googleMaps } from "./google-maps";
import { websocketScale } from "./websocket-scale";
import { webrtc } from "./webrtc";
import { bookmyshow } from "./bookmyshow";
import { makemytrip } from "./makemytrip";
import { airline } from "./airline";
import { airbnb } from "./airbnb";
import { nobroker } from "./nobroker";
import { meetingScheduler } from "./meeting-scheduler";
import { carRental } from "./car-rental";
import { zomato } from "./zomato";
import { urbanCompany } from "./urban-company";
import { porter } from "./porter";
import { driverFleet } from "./driver-fleet";
import { practo } from "./practo";
import { astrotalk } from "./astrotalk";
import { quora } from "./quora";
import { linkedin } from "./linkedin";
import { bnpl } from "./bnpl";
import { stockBrokerage } from "./stock-brokerage";
import { liveSports } from "./live-sports";
import { redis } from "./redis";

export const systemInputs: SystemDesignInput[] = [
  youtube,
  netflix,
  instagram,
  twitter,
  whatsapp,
  uber,
  amazon,
  payments,
  urlShortener,
  rateLimiter,
  typeahead,
  webCrawler,
  pastebin,
  dropbox,
  googleMaps,
  websocketScale,
  webrtc,
  bookmyshow,
  makemytrip,
  airline,
  airbnb,
  nobroker,
  meetingScheduler,
  carRental,
  zomato,
  urbanCompany,
  porter,
  driverFleet,
  practo,
  astrotalk,
  quora,
  linkedin,
  bnpl,
  stockBrokerage,
  liveSports,
  redis,
];
