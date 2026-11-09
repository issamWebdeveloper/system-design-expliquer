import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const carRental: SystemTranslation = {
  name: "Location de voitures",
  tagline: "Réserver une catégorie, prendre la voiture, rouler, la rendre",
  description:
    "Les clients réservent une catégorie de voiture dans une agence pour une période, pas un véhicule précis. La disponibilité est la taille de la flotte moins les réservations qui se chevauchent, mise en cache par agence et par catégorie. Une réservation retient de la capacité par une mise à jour conditionnelle et pose une caution sur la carte. Au retrait, un véhicule précis est attribué ; la télématique remonte kilométrage et carburant, et le montant final est capturé au retour.",
  requirements: {
    functional: [
      "Chercher des voitures par agence, dates et catégorie, avec les prix",
      "Réserver, modifier et annuler",
      "Caution à la réservation, montant final au retour",
      "Attribuer un véhicule au retrait ; noter dommages et kilométrage",
      "Gestion de flotte : entretien, transferts entre agences",
    ],
    nonFunctional: [
      "Pas de surréservation d'une catégorie dans une agence au-delà de la politique",
      "Paiements exactement une fois, cautions toujours libérées",
      "Disponibilité exacte pendant les hautes saisons de voyage",
    ],
  },
  apis: apis(
    "Catégories disponibles avec leurs prix",
    "Réserver une catégorie (Idempotency-Key) ; pose une caution",
    "Attribuer un véhicule, noter compteur et carburant",
    "Enregistrer le retour, calculer le montant final",
  ),
  estimates: estimates(
    ["Flotte", "≈ 200 k véhicules", "Hypothèse sur ~2 000 agences"],
    ["Réservations", "≈ 100 k/jour", "Hypothèse ; ~1/s en moyenne"],
    ["Recherches de disponibilité", "≈ 50× les réservations", "Navigation et comparaison des prix"],
    ["Télématique", "≈ 2–3 k messages/s", "200 k véhicules × une mise à jour par minute en roulant"],
  ),
  dataModel: dataModel(
    ["Stock par catégorie", "Base relationnelle", "Des incréments conditionnels maintiennent les réservations dans la taille de la flotte"],
    ["Réservation", "Base relationnelle", "Cycle de vie de la réservation au retour"],
    ["Véhicule", "Base relationnelle", "État de la flotte pour l'attribution et l'entretien"],
  ),
  nodes: nodes({
    web: ["Web", "Chercher et réserver"],
    mobile: ["Application mobile", "Réserver, clé numérique, reçus"],
    counter: ["Appli du comptoir", "Retrait et retour par le personnel"],
    vehicles: ["Télématique des véhicules", "Remonte position, kilométrage et carburant"],
    gateway: ["Passerelle d'API", "Authentification et routage"],
    "search-svc": ["Recherche de disponibilité", "Catégories et prix par agence et dates"],
    "availability-cache": ["Cache de disponibilité", "Capacité restante par agence, catégorie et jour"],
    pricing: ["Tarification", "Tarifs selon la saison, la demande et la durée"],
    "reservation-svc": ["Service de réservation", "Retient la capacité et gère le cycle de location"],
    "fleet-svc": ["Service de flotte", "Véhicules, attribution, entretien"],
    "main-db": ["Stock, réservations et flotte", "Source de vérité"],
    "payment-svc": ["Service de paiement", "Cautions et débits finaux"],
    psp: ["Prestataire de paiement", "Autorisation et capture par carte"],
    telemetry: ["Flux télématique", "Mises à jour des véhicules"],
    notify: ["E-mail et SMS", "Confirmations et reçus"],
  }),
  edges: edges({
    "reservation-db": "Retenue conditionnelle",
    "reservation-cache": "Mettre à jour le restant",
    "reservation-fleet": "Attribuer un véhicule",
  }),
  flows: flows({
    reserve: [
      "Réserver une voiture",
      "Le client cherche dans l'agence de l'aéroport pour 5 jours.",
      "La recherche de disponibilité traite la demande.",
      "La capacité restante par catégorie vient du cache.",
      "Les prix sont calculés pour ces dates.",
      "Le client réserve un SUV.",
      "Le compteur de chaque jour pour les SUV de cette agence est incrémenté — seulement s'il reste dans la taille de la flotte.",
      "Une caution est posée sur la carte.",
      "L'émetteur de la carte l'autorise.",
      "La disponibilité en cache est mise à jour.",
      "Une confirmation est envoyée.",
    ],
    return: [
      "Retrait et retour",
      "Au retrait, le personnel ouvre la réservation.",
      "Le service de réservation charge la réservation et vérifie le permis du client.",
      "Un SUV précis, propre et entretenu, est attribué.",
      "Pendant la location, la voiture remonte kilométrage et carburant.",
      "La flotte enregistre les relevés.",
      "Au retour, le montant final (jours en plus, carburant, dommages) est capturé et le reste de la caution libéré.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Surréservation d'une catégorie dans les agences chargées", "Compteurs par jour avec mises à jour conditionnelles ; petite marge de surréservation facultative selon le taux de non-présentation."],
    ["Disponibilité périmée en cache", "Mettre le cache à jour à chaque réservation et revérifier la base au moment de réserver."],
    ["Des cautions jamais libérées", "Un processus de rapprochement qui annule les retenues des locations annulées ou terminées."],
  ),
  scaling: [
    "Partitionner stock et réservations par région ou par agence.",
    "Mettre en cache disponibilité et prix par agence.",
    "Traiter la télématique de façon asynchrone.",
  ],
  extensions: [
    "Clés numériques et retrait sans contact.",
    "Locations en aller simple avec rééquilibrage de la flotte.",
    "Détection des dommages à partir de photos.",
  ],
};
