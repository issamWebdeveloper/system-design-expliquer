import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const urbanCompany: SystemTranslation = {
  tagline: "Réserver des professionnels vérifiés pour des services à domicile",
  description:
    "Les clients réservent un service pour un créneau, pas une personne. La disponibilité des créneaux est calculée à partir des plannings des professionnels proches qui ont la bonne compétence. Choisir un créneau pose une courte retenue, le paiement la confirme, puis un service d'attribution choisit le meilleur professionnel selon la distance, la note et la charge. Le jour J, le professionnel pointe à l'arrivée et au départ dans son appli, et le versement suit la fin de la mission.",
  requirements: {
    functional: [
      "Parcourir les services (ménage, beauté, réparations) avec leurs prix",
      "Voir les créneaux disponibles à votre adresse et en réserver un",
      "Attribuer un professionnel qualifié à proximité",
      "Suivre l'état de la mission ; payer en ligne ou après le service",
      "Notes, demandes de reprise, versements aux professionnels",
    ],
    nonFunctional: [
      "Ne jamais promettre un créneau que personne ne peut assurer",
      "Attribution quelques minutes après la réservation",
      "Les plannings des professionnels restent cohérents",
    ],
  },
  apis: apis(
    "Catalogue avec prix",
    "Créneaux réservables à cette adresse",
    "Retenir un créneau quelques minutes",
    "Confirmer un créneau retenu (Idempotency-Key)",
    "Professionnel : en route, commencé, terminé",
  ),
  estimates: estimates(
    ["Réservations", "≈ 100 k/jour", "Hypothèse"],
    ["Professionnels", "≈ 50 k", "Hypothèse sur l'ensemble des villes"],
    ["Requêtes de créneaux", "≈ 20× les réservations", "Les clients comparent jours et horaires"],
    ["Lignes de planning", "≈ 50 k × 14 jours × ~16 créneaux", "≈ 11 M de cases de créneaux tenues deux semaines à l'avance"],
  ),
  dataModel: dataModel(
    ["Planning du professionnel", "Base relationnelle", "Les mises à jour conditionnelles empêchent la double attribution"],
    ["Capacité par créneau", "Cache en mémoire", "Réponses rapides à « peut-on assurer ce créneau ? » pour les clients"],
    ["Réservation", "Base relationnelle", "Cycle de vie et argent"],
  ),
  nodes: nodes({
    customer: ["Appli client", "Réserver et suivre les services"],
    pro: ["Appli professionnel", "Missions, navigation, pointage, revenus"],
    gateway: ["Passerelle d'API", "Authentification et routage"],
    "catalog-svc": ["Service catalogue", "Services, prix, offres"],
    "slot-svc": ["Service des créneaux", "Calcule les créneaux disponibles et pose les retenues"],
    "slot-cache": ["Capacité et retenues", "Capacité par zone et retenues de courte durée"],
    "booking-svc": ["Service de réservation", "Confirme les réservations et suit les missions"],
    assignment: ["Service d'attribution", "Choisit le professionnel"],
    "pro-geo": ["Positions des professionnels", "Bases et positions en direct par cellule"],
    "main-db": ["Réservations et plannings", "Source de vérité"],
    "payment-svc": ["Paiements et versements", "Débits clients, versements aux professionnels"],
    psp: ["Prestataire de paiement", "UPI, cartes"],
    events: ["Événements de réservation", "Confirmée, attribuée, terminée"],
    notify: ["Push et SMS", "Confirmations et alertes d'arrivée"],
  }),
  edges: edges({
    "slots-cache": "Capacité / retenue",
    "assignment-geo": "Proche, compétent, libre",
    "assignment-db": "Réserver le créneau du pro",
    "events-payout": "Terminée → versement",
  }),
  flows: flows({
    book: [
      "Réserver un service",
      "Le client choisit « grand ménage » pour samedi.",
      "Le service des créneaux vérifie la capacité pour cette zone et cette compétence.",
      "Le créneau de 10 h a de la capacité ; une retenue est posée pour 10 minutes.",
      "Le client confirme.",
      "La réservation est enregistrée en PENDING sur le créneau retenu.",
      "Le paiement est encaissé (ou marqué « payer après le service ») et la réservation confirmée.",
      "« Réservation confirmée » est publié.",
      "Le service d'attribution la prend en charge.",
      "Il présélectionne les professionnels proches qui ont la compétence et sont libres à 10 h.",
      "Il réserve le créneau du meilleur par une mise à jour conditionnelle.",
      "Le client et le professionnel sont prévenus.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Afficher des créneaux qu'on ne peut pas réellement assurer", "Calculer la capacité à partir des vrais plannings par zone et compétence ; retenir la capacité pendant le paiement."],
    ["Deux réservations attribuées au même professionnel", "Mise à jour conditionnelle sur la ligne du créneau du professionnel ; réessayer avec le candidat suivant."],
    ["Absences et retards", "Position en direct le jour de la mission et réattribution automatique quand un professionnel est en retard."],
  ),
  scaling: [
    "Partitionner par ville ; capacité et attribution sont locales.",
    "Reconstruire la capacité des créneaux de façon incrémentale quand les plannings changent.",
    "Attribution asynchrone pour que le paiement reste rapide.",
  ],
  extensions: [
    "Abonnements pour les services récurrents.",
    "Vente de produits (purificateurs d'eau, outils).",
    "Formation et score qualité des professionnels.",
  ],
};
