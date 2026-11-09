import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const bookmyshow: SystemTranslation = {
  tagline: "Billets de cinéma et d'événements avec choix des places en direct",
  description:
    "Parcourir les séances est un chemin de lecture mis en cache et piloté par la recherche. Le plus difficile est le plan de salle : quand vous choisissez des places, elles sont retenues quelques minutes par un verrou de courte durée, pour que personne d'autre ne les prenne pendant que vous payez. Le paiement confirme la réservation dans une seule transaction en base ; si vous partez, la retenue expire et les places sont libérées. Pour les grosses sorties, une salle d'attente virtuelle fait entrer les gens au compte-gouttes.",
  requirements: {
    functional: [
      "Parcourir films et événements par ville, date, langue et lieu",
      "Voir un plan de salle en direct et choisir des places précises",
      "Retenir les places pendant le paiement ; les libérer si le paiement n'aboutit pas",
      "Payer et recevoir un billet électronique (code QR)",
      "Annuler et rembourser selon la politique du lieu",
    ],
    nonFunctional: [
      "Ne jamais vendre deux fois la même place",
      "Absorber les pics des avant-premières (des centaines de milliers d'utilisateurs simultanés)",
      "Le plan de salle reflète les retenues en quelques secondes",
      "Paiements exactement une fois",
    ],
  },
  apis: apis(
    "Séances par lieu et horaire",
    "Plan de salle avec places libres, retenues et réservées",
    "Retenir des places ~8 minutes ; échoue si l'une est déjà prise",
    "Confirmer une retenue après paiement (idempotent)",
    "Annuler et rembourser",
  ),
  estimates: estimates(
    ["Concurrence en pointe", "≈ 250 k utilisateurs", "Chiffre rapporté pour les grosses avant-premières"],
    ["Requêtes en pointe", "≈ 11 k/s", "650 k requêtes par minute ÷ 60"],
    ["Billets", "≈ 1 M/jour", "Hypothèse ; ~12/s en moyenne, bien plus les jours de sortie"],
    ["Places suivies", "≈ 50 M/jour", "~10 k écrans × 5 séances × ~1 000 places (événements compris)"],
  ),
  dataModel: dataModel(
    ["Place de séance", "Base relationnelle", "Une contrainte d'unicité rend la double réservation impossible au niveau de la base"],
    ["Retenue de place", "Cache en mémoire avec TTL", "Verrous temporaires rapides qui expirent d'eux-mêmes"],
    ["Réservation", "Base relationnelle", "Enregistrement transactionnel de l'argent et des places"],
    ["Film / séance", "Base relationnelle + index de recherche", "Consultés en permanence ; mis en cache et indexés"],
  ),
  nodes: nodes({
    web: ["Web", "Parcourir et réserver"],
    mobile: ["Application mobile", "Parcourir, réserver et présenter les billets"],
    cdn: ["CDN", "Affiches, bandes-annonces et pages statiques"],
    "waiting-room": ["Salle d'attente virtuelle", "Laisse entrer les utilisateurs à un rythme sûr pendant les pics"],
    gateway: ["Passerelle d'API", "Authentification, limitation de débit, routage"],
    "catalog-svc": ["Service catalogue", "Films, lieux et horaires des séances"],
    "search-index": ["Index de recherche", "Films, événements et lieux"],
    "seat-svc": ["Service des places", "Plans de salle et retenues"],
    holds: ["Retenues de places", "Verrous de courte durée par place (TTL)"],
    "booking-svc": ["Service de réservation", "Transforme une retenue payée en réservation"],
    "booking-db": ["Réservations et places", "Source de vérité des places vendues"],
    "payment-svc": ["Service de paiement", "Débite et rembourse de façon idempotente"],
    psp: ["Prestataire de paiement", "Cartes, UPI, portefeuilles"],
    venues: ["Billetterie du lieu", "Certains cinémas gardent leur propre système de billetterie"],
    events: ["Événements de réservation", "Confirmée, annulée"],
    notify: ["Billets et alertes", "Billets électroniques par SMS, e-mail et push"],
  }),
  edges: edges({
    "gateway-waiting": "Mode pic",
    "seats-holds": "SET NX + TTL",
    "seats-db": "Places réservées",
    "seats-venue": "Synchroniser l'état des places",
    "booking-db-write": "Confirmer",
  }),
  flows: flows({
    book: [
      "Réserver des places",
      "L'utilisateur choisit une séance.",
      "Le service des places construit le plan de salle.",
      "Les places réservées viennent de la base…",
      "…et celles retenues par d'autres, du cache. L'utilisateur choisit deux places et chacune est verrouillée avec SET NX pour 8 minutes — tout ou rien.",
      "L'utilisateur paie.",
      "Le service de réservation débite en utilisant l'id de la retenue comme clé d'idempotence.",
      "Le prestataire de paiement accepte.",
      "Les places sont marquées réservées dans une seule transaction ; une contrainte d'unicité est l'ultime garde-fou contre la double vente.",
      "Un événement « réservation confirmée » est publié.",
      "Le billet électronique est envoyé.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des milliers de personnes veulent les mêmes places à la même seconde", "Des retenues atomiques par place dans un stockage en mémoire avec TTL, plus une contrainte d'unicité en base en dernière ligne de défense."],
    ["Pics de trafic des avant-premières", "Une salle d'attente virtuelle fait entrer les utilisateurs à un rythme soutenable ; la navigation reste sur le cache et le CDN."],
    ["Le paiement réussit mais la confirmation échoue", "Confirmation idempotente indexée par l'id de retenue ; un processus de rapprochement rembourse ou finalise les paiements orphelins."],
  ),
  scaling: [
    "Sharder places et réservations par ville ou par lieu ; l'essentiel du trafic est local.",
    "Mettre en cache les listes de séances par ville avec des TTL courts.",
    "Faire monter les services de places et de réservation indépendamment de la navigation.",
  ],
  extensions: [
    "Mises à jour du plan de salle en direct par WebSockets.",
    "Tarification dynamique pour les séances très demandées.",
    "Ajout de nourriture et boissons dans la même commande.",
  ],
};
