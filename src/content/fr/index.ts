import type { ContentTranslation } from "../translation";
import { frComponents } from "./components";
import { frConcepts } from "./concepts";
import { frSystems } from "./systems";

/** French translation of the content. Anything missing here is shown in English. */
export const fr: ContentTranslation = {
  labels: {
    systemCategories: {
      "media-social": "Médias et réseaux sociaux",
      mobility: "Mobilité et logistique",
      "commerce-fintech": "Commerce et fintech",
      bookings: "Réservations et places de marché",
      infrastructure: "Briques de base",
    },
    conceptFamilies: {
      data: "Données et stockage",
      scale: "Échelle et distribution",
      messaging: "Messagerie et flux",
      reliability: "Fiabilité et exactitude",
      security: "Sécurité",
    },
    difficulty: { 1: "Débutant", 2: "Intermédiaire", 3: "Avancé" },
    componentCategories: {
      client: "Clients",
      edge: "Périphérie et réseau",
      security: "Sécurité et identité",
      compute: "Calcul",
      messaging: "Messagerie",
      storage: "Stockage",
      database: "Bases de données et recherche",
      cache: "Cache",
      analytics: "Analytique et traitement",
      ml: "Apprentissage automatique",
      ops: "Exploitation",
      external: "Services externes",
    },
  },
  components: frComponents,
  concepts: frConcepts,
  systems: frSystems,
};
