import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const airline: SystemTranslation = {
  name: "Réservation aérienne",
  tagline: "Vols, sièges, réservations et enregistrement pour une compagnie",
  description:
    "La compagnie possède son stock : chaque vol a un nombre fixe de sièges par classe tarifaire. Une réservation décrémente ce compteur avec un contrôle de concurrence optimiste, crée un dossier passager (PNR), encaisse le paiement et émet un billet. Les événements opérationnels — retards, changements de porte, annulations — passent par un flux d'événements pour prévenir les passagers et les replacer sur d'autres vols.",
  requirements: {
    functional: [
      "Rechercher vols et tarifs ; réserver des allers simples, allers-retours et multi-destinations",
      "Choisir son siège, ajouter bagages et repas",
      "Gérer ses réservations : modifier, annuler, rembourser",
      "Enregistrement en ligne et cartes d'embarquement",
      "Mises à jour du statut des vols et replacement automatique en cas d'annulation",
    ],
    nonFunctional: [
      "Pas de surréservation au-delà de la limite choisie par la compagnie",
      "Réservations et paiements exactement une fois",
      "Hautement disponible — l'enregistrement ne peut pas tomber à l'aéroport",
      "Vendre via agences de voyage et GDS autant que par les canaux directs",
    ],
  },
  apis: apis(
    "Vols avec tarifs par classe",
    "Créer un PNR pour des passagers et des segments (Idempotency-Key)",
    "Attribuer des sièges",
    "S'enregistrer et obtenir les cartes d'embarquement",
    "Statut, porte et retard en direct",
  ),
  estimates: estimates(
    ["Passagers", "≈ 500 k/jour", "Échelle rapportée pour une grande compagnie"],
    ["Vols", "≈ 3–5 k/jour", "Hypothèse"],
    ["Réservations", "≈ 6/s en moyenne", "500 k passagers ÷ ~1 réservation par passager ÷ 86 400 s ; ×20 lors des promotions"],
    ["Recherches", "≈ 100× les réservations", "Ratio recherche/réservation élevé, surtout via agences et GDS"],
  ),
  dataModel: dataModel(
    ["Stock tarifaire", "Base relationnelle", "UPDATE … SET sold = sold + n WHERE sold + n ≤ capacity AND version = v empêche la survente"],
    ["PNR (réservation)", "Base relationnelle", "Dossier standard du secteur auquel tous les canaux font référence"],
    ["Attribution de siège", "Base relationnelle", "Unique par siège et par vol"],
  ),
  nodes: nodes({
    web: ["Site web", "Réservations directes"],
    mobile: ["Application mobile", "Réservations, enregistrement, carte d'embarquement"],
    agents: ["Applis aéroport et agents", "Outils du personnel aux comptoirs et aux portes"],
    gds: ["GDS / agences de voyage", "Canaux de vente indirects"],
    gateway: ["Passerelle d'API", "Authentification, limites de débit, routage"],
    "inventory-svc": ["Vols et stock", "Horaires et sièges par classe tarifaire"],
    "booking-svc": ["Réservations (PNR)", "Crée et modifie les réservations"],
    "checkin-svc": ["Enregistrement et embarquement", "Plans de cabine, cartes d'embarquement, listes de porte"],
    "ops-svc": ["Opérations aériennes", "Statut, retards, portes, changements d'appareil"],
    "inventory-db": ["Stock", "Sièges vendus par vol et par classe"],
    "pnr-db": ["Réservations", "PNR, billets et sièges"],
    "payment-svc": ["Service de paiement", "Débits et remboursements"],
    psp: ["Prestataire de paiement", "Traitement des cartes"],
    events: ["Événements opérationnels et de réservation", "Retards, annulations, réservations"],
    status: ["Statut en direct", "Pousse le statut des vols vers les applis"],
    notify: ["SMS, e-mail, push", "Confirmations et alertes de perturbation"],
  }),
  edges: edges({
    "gds-gateway": "Disponibilité et vente",
    "booking-inventory": "Décrémenter les sièges",
    "ops-events": "Retard / annulation",
    "events-rebook": "Replacement automatique",
  }),
  flows: flows({
    book: [
      "Réserver un vol",
      "Le passager choisit un vol et un tarif.",
      "Le service de réservation démarre une réservation.",
      "Il demande au stock de vendre un siège dans cette classe tarifaire.",
      "Une mise à jour conditionnelle ne réussit que s'il reste des sièges et que personne n'a modifié la ligne entre-temps ; sinon elle réessaie ou échoue.",
      "Un PNR est créé avec les passagers et les segments.",
      "Le paiement est encaissé, indexé par le PNR. En cas d'échec, le siège est rendu au stock.",
      "La carte est débitée et un numéro de billet est émis.",
      "Un événement de réservation est publié.",
      "Le billet électronique est envoyé par e-mail.",
    ],
    disruption: [
      "Vol annulé",
      "Les opérations annulent un vol.",
      "Le service de réservation replace les passagers concernés sur les prochains vols disponibles.",
      "Les mises à jour de statut sont poussées…",
      "…vers chaque appli connectée.",
      "Les passagers reçoivent un SMS et un e-mail avec leur nouvel itinéraire.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Ventes simultanées des derniers sièges", "Mises à jour conditionnelles avec une colonne de version sur le stock ; légère surréservation contrôlée si la politique l'autorise."],
    ["Le volume de recherches des GDS écrase celui des réservations", "Servir la disponibilité depuis un cache rafraîchi à chaque vente ; limiter le débit des canaux."],
    ["Une perturbation massive crée des milliers de replacements d'un coup", "Traiter les replacements depuis une file, par priorité (correspondances, statut), plutôt qu'en ligne."],
  ),
  scaling: [
    "Partitionner le stock par vol et par date.",
    "Réplicas en lecture pour la recherche et le statut ; le primaire gère les ventes.",
    "Garder l'enregistrement disponible avec ses propres réplicas dans la région de l'aéroport.",
  ],
  extensions: [
    "Programme de fidélité avec miles et surclassements.",
    "Tarification dynamique par classe tarifaire.",
    "Planification des équipages et des appareils.",
  ],
};
