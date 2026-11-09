import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const driverFleet: SystemTranslation = {
  name: "Réservation de chauffeurs et gestion de flotte",
  tagline: "Engager un chauffeur pour votre voiture et gérer des flottes de chauffeurs et de véhicules",
  description:
    "Les clients réservent un chauffeur vérifié à l'heure ou au trajet pour leur propre voiture ; les gestionnaires de flotte pilotent de nombreux chauffeurs et véhicules depuis un tableau de bord. Un service de dispatch associe les réservations aux chauffeurs disponibles à proximité, une couche temps réel suit les services et les trajets, la télématique remonte l'état des véhicules, et un pipeline de paie transforme les trajets terminés en versements aux chauffeurs.",
  requirements: {
    functional: [
      "Réserver un chauffeur maintenant ou plus tard, à l'heure, au trajet ou hors de la ville",
      "Intégration des chauffeurs avec KYC et vérification des antécédents",
      "Suivi en direct du chauffeur et du véhicule",
      "Tableaux de bord de flotte : services, taux d'utilisation, état des véhicules, conformité",
      "Tarifs, factures et versements hebdomadaires aux chauffeurs",
    ],
    nonFunctional: [
      "Trouver un chauffeur en moins d'une minute pour les réservations immédiates",
      "Mises à jour de position en quelques secondes",
      "Documents des chauffeurs stockés de façon sécurisée",
    ],
  },
  apis: apis(
    "{ type, start, pickup, durationHours } → réservation",
    "Statut de service, GPS, offres de réservation",
    "Données du tableau de bord de flotte",
    "Intégrer un chauffeur avec ses documents",
    "Trajets et versements",
  ),
  estimates: estimates(
    ["Chauffeurs", "≈ 200 k inscrits, 50 k en ligne", "Hypothèse"],
    ["Réservations", "≈ 100 k/jour", "Hypothèse"],
    ["Mises à jour GPS", "≈ 12 k/s", "50 k chauffeurs en ligne ÷ toutes les 4 s"],
    ["Télématique", "≈ 5 k messages/s", "Véhicules de flotte qui remontent une fois par minute"],
  ),
  dataModel: dataModel(
    ["Chauffeur", "Base relationnelle", "Profils et statut de conformité"],
    ["Réservation / trajet", "Base relationnelle, shardée par ville", "Cycle de vie et facturation"],
    ["Service (shift)", "Base relationnelle", "Paie et taux d'utilisation"],
    ["Documents du chauffeur", "Stockage objet (chiffré)", "Fichiers sensibles à accès restreint"],
  ),
  nodes: nodes({
    customer: ["Appli client", "Réserver un chauffeur et suivre le trajet"],
    driver: ["Appli chauffeur", "Se mettre en ligne, accepter les réservations, envoyer le GPS"],
    fleet: ["Tableau de bord de flotte", "Les gestionnaires pilotent chauffeurs et véhicules"],
    gateway: ["Passerelle d'API", "Authentification, rôles, routage"],
    "booking-svc": ["Service de réservation", "Réservations et cycle de vie des trajets"],
    dispatch: ["Dispatch", "Associe les réservations aux chauffeurs disponibles"],
    rt: ["Passerelle temps réel", "GPS, offres, suivi en direct"],
    "geo-index": ["Index géographique des chauffeurs", "Chauffeurs en ligne par cellule et compétence"],
    "driver-svc": ["Gestion des chauffeurs", "Intégration, KYC, services, conformité"],
    documents: ["Documents des chauffeurs", "Fichiers KYC chiffrés"],
    "main-db": ["Chauffeurs, réservations et services", "Source de vérité"],
    telematics: ["Événements de trajet et télématique", "Trajets, historique GPS, état des véhicules"],
    payroll: ["Paie et versements", "Calcul hebdomadaire des revenus"],
    warehouse: ["Analytique de flotte", "Rapports d'utilisation et de performance"],
    psp: ["Prestataire de paiement", "Débits clients et versements aux chauffeurs"],
    notify: ["Push et SMS", "Alertes de réservation et de service"],
  }),
  edges: edges({
    "dispatch-geo": "Proches + compétences",
    "dispatch-rt": "Offre",
    "driver-rt": "GPS / statut",
    "customer-rt": "Suivre",
    "rt-events": "Historique GPS",
    "payroll-psp": "Versements",
  }),
  flows: flows({
    book: [
      "Réserver un chauffeur",
      "Le client réserve un chauffeur pour 4 heures, tout de suite.",
      "Le service de réservation crée la réservation.",
      "Elle est enregistrée en SEARCHING.",
      "Le dispatch cherche un chauffeur.",
      "Il filtre les chauffeurs en ligne à proximité capables de conduire ce type de voiture.",
      "L'offre part vers le meilleur chauffeur, qui accepte.",
      "Le client suit l'arrivée du chauffeur.",
      "Les informations du chauffeur sont envoyées par SMS.",
    ],
    payout: [
      "Versements hebdomadaires",
      "Chaque trajet terminé est publié.",
      "L'historique GPS confirme les heures de service.",
      "Une tâche hebdomadaire totalise trajets, heures, primes et retenues.",
      "Les versements partent vers les comptes bancaires des chauffeurs.",
      "Les gestionnaires de flotte consultent les rapports d'utilisation.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Associer selon les compétences en plus de la distance", "Indexer les chauffeurs par cellule et indicateurs de compétence ; élargir le rayon faute de correspondance."],
    ["Documents sensibles des chauffeurs", "Chiffrer au repos, restreindre l'accès par rôle et auditer chaque lecture."],
    ["Exactitude de la paie", "Calculer à partir d'événements de trajet immuables ; rendre les versements idempotents."],
  ),
  scaling: [
    "Partitionner par ville ; les flottes sont des clients (tenants) avec leurs propres tableaux de bord.",
    "Envoyer l'historique GPS vers un stockage bon marché et ne garder en mémoire que les positions en direct.",
    "L'analytique dans un entrepôt de données, pas dans la base opérationnelle.",
  ],
  extensions: [
    "Contrats de chauffeurs pour les entreprises.",
    "Formation des chauffeurs et primes fondées sur les notes.",
    "Maintenance prédictive à partir de la télématique.",
  ],
};
