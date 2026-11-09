import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const makemytrip: SystemTranslation = {
  tagline: "Vols et hôtels agrégés depuis de nombreux fournisseurs",
  description:
    "La plateforme possède peu de stock : vols et hôtels vivent dans les systèmes des compagnies aériennes, des GDS et des gestionnaires de canaux hôteliers. Les recherches partent en parallèle vers ces fournisseurs, et les résultats sont mis brièvement en cache car leurs appels sont lents et coûteux. Réserver un voyage est une saga — retenir chez le fournisseur, encaisser, puis émettre le billet — avec des annulations compensatoires si une étape échoue.",
  requirements: {
    functional: [
      "Rechercher des vols par trajet et date, et des hôtels par ville et dates",
      "Filtrer et trier par prix, horaire, note et équipements",
      "Réserver vols et hôtels, séparément ou en forfait",
      "Payer, recevoir l'itinéraire, annuler et être remboursé",
    ],
    nonFunctional: [
      "Résultats de recherche en quelques secondes malgré des fournisseurs lents",
      "Les prix affichés doivent être revalidés avant le paiement",
      "Pas de réservation sans paiement, pas de paiement sans réservation",
      "Absorber les pics des périodes de vacances",
    ],
  },
  apis: apis(
    "Options de vol agrégées",
    "Hôtels avec leurs tarifs",
    "Revérifier prix et disponibilité auprès du fournisseur",
    "Réserver un itinéraire (Idempotency-Key)",
    "Annuler et rembourser selon les règles tarifaires",
  ),
  estimates: estimates(
    ["Utilisateurs mensuels", "≈ 10 M", "Hypothèse"],
    ["Recherches", "≈ 1–3 M/jour", "Chaque session lance plusieurs recherches ; le ratio recherche/réservation est très élevé"],
    ["Appels fournisseurs", "10–20 par recherche", "Diffusion vers compagnies et GDS avant mise en cache"],
    ["Réservations", "≈ 50–100 k/jour", "Hypothèse tirée d'un taux de conversion d'environ 1–3 %"],
  ),
  dataModel: dataModel(
    ["Réservation", "Base relationnelle", "Machine à états en plusieurs étapes avec de l'argent en jeu"],
    ["Entrée du cache tarifaire", "Cache en mémoire", "Réduit les appels lents et limités aux fournisseurs ; TTL court car les prix changent"],
    ["Hôtel", "Index de recherche", "Contenu statique recherché par géolocalisation et facettes"],
  ),
  nodes: nodes({
    web: ["Web", "Rechercher et réserver"],
    mobile: ["Application mobile", "Rechercher, réserver et gérer ses voyages"],
    gateway: ["Passerelle d'API", "Authentification, limites de débit, routage"],
    "search-svc": ["Agrégateur de recherche", "Interroge les fournisseurs et fusionne les résultats"],
    "fare-cache": ["Cache des tarifs", "Réponses récentes des fournisseurs avec TTL courts"],
    "hotel-index": ["Index des hôtels", "Contenu hôtelier pour le filtrage et le classement"],
    suppliers: ["Compagnies, GDS, hôtels", "Le vrai stock et les vrais prix"],
    "booking-svc": ["Service de réservation", "Crée les réservations et suit leur statut"],
    saga: ["Saga de réservation", "Retenir → payer → émettre, avec compensation"],
    "booking-db": ["Réservations", "Les réservations et leurs étapes"],
    "payment-svc": ["Service de paiement", "Autoriser, capturer, rembourser"],
    psp: ["Prestataire de paiement", "Cartes, UPI, portefeuilles"],
    events: ["Événements de réservation", "Confirmée, échouée, annulée"],
    notify: ["Itinéraire et alertes", "Billets, bons, changements d'horaire"],
  }),
  edges: edges({
    "search-suppliers": "Requêtes en parallèle",
    "saga-suppliers": "Retenir / émettre / annuler",
    "saga-payment": "Payer / rembourser",
  }),
  flows: flows({
    search: [
      "Rechercher des vols",
      "L'utilisateur cherche Delhi → Mumbai pour vendredi.",
      "L'agrégateur traite la demande.",
      "Une recherche identique récente peut déjà être en cache pour quelques minutes.",
      "Sinon il interroge compagnies et GDS en parallèle avec un timeout strict et utilise ce qui revient à temps.",
    ],
    book: [
      "Réserver un voyage",
      "L'utilisateur réserve ; le prix est d'abord revalidé.",
      "Une réservation est créée en PENDING.",
      "La saga de réservation démarre.",
      "Étape 1 : retenir le siège ou la chambre chez le fournisseur.",
      "Étape 2 : encaisser le paiement.",
      "Le prestataire de paiement accepte.",
      "Étape 3 : émettre le billet ou le bon. En cas d'échec, la saga rembourse et libère la retenue.",
      "Le résultat est publié.",
      "L'itinéraire est envoyé par e-mail.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des API fournisseurs lentes et limitées en débit", "Cache à TTL court, appels parallèles avec timeouts et disjoncteurs par fournisseur."],
    ["Le prix change entre la recherche et la réservation", "Toujours recalculer le prix avant le paiement et prévenir l'utilisateur s'il a changé."],
    ["Échecs partiels entre fournisseur, paiement et émission", "Une saga aux étapes idempotentes avec compensations, plus un rapprochement pour les réservations bloquées."],
  ),
  scaling: [
    "Faire monter les agrégateurs de recherche horizontalement ; ils sont sans état.",
    "Sharder les réservations par bookingId et garder des caches chauds par région.",
    "Mettre en file le travail après réservation (e-mails, fidélité, analytique) hors du chemin critique.",
  ],
  extensions: [
    "Forfaits vol + hôtel avec un seul paiement.",
    "Alertes de prix et prédictions tarifaires.",
    "Points de fidélité et portefeuille.",
  ],
};
