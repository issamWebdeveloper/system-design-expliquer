import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const meetingScheduler: SystemTranslation = {
  name: "Planificateur de réunions",
  tagline: "Trouver un créneau, réserver une salle, inviter tout le monde",
  description:
    "Planifier, c'est surtout gérer les disponibilités : le système fusionne les agendas des participants (y compris externes) en une vue en cache des intervalles occupés et trouve les créneaux libres communs. La réservation prend la salle par une insertion conditionnelle, pour que deux réunions ne puissent pas occuper la même salle au même moment, puis envoie les invitations. Un planificateur déclenche les rappels avant chaque réunion.",
  requirements: {
    functional: [
      "Créer des réunions avec participants, horaire, durée et salle facultative",
      "Suggérer des horaires où tout le monde est libre",
      "Réserver des salles sans double réservation",
      "Envoyer des invitations ; les participants acceptent ou refusent",
      "Réunions récurrentes et rappels",
      "Synchronisation avec des agendas externes",
    ],
    nonFunctional: [
      "Aucune réservation qui se chevauche pour une salle",
      "Réponses de disponibilité bien en dessous d'une seconde",
      "Fuseaux horaires gérés correctement partout",
    ],
  },
  apis: apis(
    "{ attendees, rangeStart, rangeEnd, duration } → créneaux libres",
    "Créer une réunion et réserver une salle (Idempotency-Key)",
    "Reprogrammer ou changer les participants",
    "Accepter ou refuser",
    "Salles libres sur une plage horaire",
  ),
  estimates: estimates(
    ["Utilisateurs", "≈ 1 M dans un ensemble d'organisations", "Hypothèse pour une large base de clients SaaS"],
    ["Réunions créées", "≈ 5 M/jour (~60/s)", "1 M d'utilisateurs × 5 réunions"],
    ["Requêtes de disponibilité", "≈ 10× les créations", "On explore plusieurs créneaux avant de réserver"],
    ["Événements stockés", "≈ 2 Md/an", "Occurrences récurrentes comprises"],
  ),
  dataModel: dataModel(
    ["Événement", "Base relationnelle", "Modifications transactionnelles et règles de récurrence"],
    ["Participant", "Base relationnelle", "État de réponse par personne"],
    ["Réservation de salle", "Base relationnelle", "Une contrainte d'exclusion sur (salle, plage horaire) empêche les chevauchements"],
    ["Disponibilités", "Cache en mémoire", "Fusion rapide entre de nombreux participants"],
  ),
  nodes: nodes({
    web: ["Agenda web", "Créer et gérer les réunions"],
    mobile: ["Application mobile", "Réponses et rappels"],
    gateway: ["Passerelle d'API", "Authentification et routage"],
    "calendar-svc": ["Service d'agenda", "Créer, modifier et développer les réunions"],
    "availability-svc": ["Service de disponibilité", "Fusionne les intervalles occupés et trouve les créneaux communs"],
    "freebusy-cache": ["Cache des disponibilités", "Intervalles occupés par utilisateur et par jour"],
    "room-svc": ["Réservation de salles", "Prend les salles sans chevauchement"],
    "calendar-db": ["Événements et salles", "Réunions, participants et réservations de salles"],
    external: ["Agendas externes", "Agendas Google / Outlook via synchronisation"],
    reminders: ["Planificateur de rappels", "Déclenche les rappels au bon moment"],
    events: ["Événements d'agenda", "Créé, modifié, annulé"],
    notify: ["E-mail et push", "Invitations, mises à jour, rappels"],
  }),
  edges: edges({
    "availability-external": "Créneaux occupés externes",
    "room-db": "Insertion conditionnelle",
    "events-cache": "Invalider",
    "events-notify": "Invitations",
    "events-reminders": "Planifier",
    "reminders-notify": "Rappeler",
  }),
  flows: flows({
    schedule: [
      "Planifier une réunion",
      "L'organisateur choisit les participants et une durée.",
      "Le service de disponibilité est interrogé pour des créneaux cette semaine.",
      "Il fusionne les intervalles occupés en cache de chaque participant…",
      "…plus les créneaux occupés de leurs agendas externes, et renvoie les créneaux libres communs.",
      "L'organisateur choisit un créneau et une salle.",
      "Le service des salles prend la salle.",
      "Une contrainte d'exclusion rejette l'insertion en cas de chevauchement — pas de double réservation.",
      "La réunion et les participants sont enregistrés.",
      "Un événement « réunion créée » est publié.",
      "Les disponibilités des participants sont rafraîchies.",
      "Les invitations partent.",
      "Un rappel est programmé 10 minutes avant.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Fusionner les agendas de grands groupes", "Mettre en cache les intervalles occupés par utilisateur et par jour, et fusionner des listes d'intervalles triées (O(n log n))."],
    ["Deux personnes qui réservent la même salle en même temps", "Contrainte d'exclusion en base sur (salle, plage horaire) — la seconde insertion échoue proprement."],
    ["Réunions récurrentes avec exceptions", "Stocker la règle de récurrence et les dérogations ; développer les occurrences à la demande pour la période affichée."],
  ),
  scaling: [
    "Sharder les événements par organisation (tenant).",
    "Stocker les heures en UTC avec le fuseau d'origine pour l'affichage et la récurrence.",
    "Faire tourner la synchronisation des agendas externes en workers de fond avec des webhooks.",
  ],
  extensions: [
    "Liens de réservation pour les personnes externes (à la Calendly).",
    "Liens d'appel vidéo automatiques.",
    "Suggestions intelligentes qui respectent les heures de travail et les plages de concentration.",
  ],
};
