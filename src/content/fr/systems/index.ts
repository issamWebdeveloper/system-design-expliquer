import type { ContentTranslation } from "../../translation";
import { amazon } from "./amazon";
import { instagram } from "./instagram";
import { netflix } from "./netflix";
import { twitter } from "./twitter";
import { uber } from "./uber";
import { whatsapp } from "./whatsapp";
import { youtube } from "./youtube";

/** French translations of the system designs, keyed by slug. Missing systems are shown in English. */
export const frSystems: NonNullable<ContentTranslation["systems"]> = {
  amazon,
  instagram,
  netflix,
  twitter,
  uber,
  whatsapp,
  youtube,
};
