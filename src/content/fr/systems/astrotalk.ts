import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const astrotalk: SystemTranslation = {
  tagline: "Discussions et appels avec des astrologues, facturés à la minute",
  description:
    "Les utilisateurs alimentent un portefeuille prépayé et lancent des sessions de discussion, d'appel vocal ou vidéo avec des astrologues en ligne, facturées à la minute. Avant le début d'une session, le système réserve assez de solde pour quelques minutes ; un service de comptage débite ensuite chaque minute dans le grand livre et met fin à la session quand les fonds sont épuisés. Les discussions passent par WebSockets, les appels par WebRTC ou un partenaire téléphonique, et les thèmes astraux sont calculés à la demande.",
  requirements: {
    functional: [
      "Parcourir les astrologues par langue, spécialité, prix et note ; voir qui est en ligne",
      "Portefeuille prépayé avec rechargements",
      "Sessions instantanées de discussion, d'appel vocal ou vidéo facturées à la minute",
      "Sessions planifiées, thèmes astraux (kundli) et horoscopes",
      "Revenus et versements des astrologues",
    ],
    nonFunctional: [
      "Facturation exacte : ne jamais facturer un temps non fourni, ne jamais laisser le solde passer en négatif",
      "Des milliers de sessions simultanées avec messagerie en temps réel",
      "Statut en ligne des astrologues exact à quelques secondes près",
    ],
  },
  apis: apis(
    "Astrologues disponibles avec leur prix à la minute",
    "Ajouter de l'argent au portefeuille",
    "Lancer une discussion ou un appel ; réserve le solde des premières minutes",
    "Messages, indicateur de saisie, chronomètre de session",
    "Terminer et régler la session",
  ),
  estimates: estimates(
    ["Sessions", "≈ 100 k/jour", "Hypothèse"],
    ["Sessions simultanées", "≈ 5–10 k en pointe", "~10 minutes en moyenne, pic le soir"],
    ["Prélèvements de facturation", "≈ 170 /s en pointe", "10 k sessions ÷ un prélèvement par minute"],
    ["Astrologues en ligne", "≈ 5 k", "Hypothèse"],
  ),
  dataModel: dataModel(
    ["Grand livre du portefeuille", "Base relationnelle (ajout seul)", "Soldes calculés à partir des écritures ; (sessionId, minute) est unique, donc une minute ne peut pas être facturée deux fois"],
    ["Session", "Base relationnelle", "Cycle de vie et base de facturation"],
    ["Présence", "Cache en mémoire", "Mise à jour en continu ; lue à chaque consultation"],
  ),
  nodes: nodes({
    user: ["Appli utilisateur", "Parcourir, recharger, discuter et appeler"],
    astrologer: ["Appli astrologue", "Se mettre en ligne, prendre des sessions, voir ses revenus"],
    gateway: ["Passerelle d'API", "Authentification et routage"],
    discovery: ["Découverte", "Liste les astrologues avec leur présence en direct"],
    presence: ["Présence", "Statut en ligne / occupé"],
    "session-svc": ["Service de session", "Lance, suit et termine les sessions"],
    "wallet-svc": ["Service de portefeuille", "Solde, réservations et rechargements"],
    meter: ["Compteur de facturation", "Facture chaque minute ; termine les sessions quand le solde est bas"],
    ledger: ["Grand livre du portefeuille", "Mouvements du portefeuille en partie double"],
    chat: ["Passerelle de discussion", "Messages et chronomètres des sessions"],
    calls: ["Appels (WebRTC / téléphonie)", "Sessions vocales et vidéo"],
    charts: ["Calcul des thèmes", "Thèmes astraux à partir de la date, l'heure et le lieu"],
    "payment-svc": ["Rechargements et versements", "Rechargements du portefeuille, versements aux astrologues"],
    psp: ["Prestataire de paiement", "UPI, cartes"],
    events: ["Événements de session", "Commencée, minute facturée, terminée"],
    notify: ["Push", "Demandes de session et offres"],
  }),
  edges: edges({
    "session-wallet": "Réserver le solde",
    "meter-wallet": "Facturer la minute",
    "meter-session": "Terminer si solde bas",
    "user-calls": "Voix / vidéo",
    "gateway-charts": "Kundli",
    "payment-ledger": "Rechargements",
  }),
  flows: flows({
    session: [
      "Session de discussion payante",
      "L'utilisateur ouvre la liste des astrologues en ligne.",
      "La découverte renvoie les astrologues…",
      "…filtrés sur ceux qui sont en ligne et pas occupés.",
      "L'utilisateur lance une discussion à 30 ₹/min.",
      "Le portefeuille réserve le solde des 3 premières minutes ; un solde insuffisant empêche la session.",
      "La réservation est enregistrée.",
      "L'astrologue reçoit une demande et accepte.",
      "Les deux sont connectés par la passerelle de discussion.",
      "« Session commencée » est publié.",
      "Le compteur de facturation démarre son horloge à la minute.",
      "Chaque minute est facturée exactement une fois (unique par session et par minute).",
      "Quand le solde ne couvre plus la minute suivante, la session se termine, après un avertissement.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Dérive de facturation et doubles prélèvements", "Grand livre en ajout seul avec une clé unique par (session, minute) ; régler à partir des horodatages serveur, pas du client."],
    ["Solde épuisé en pleine session", "Réserver quelques minutes à l'avance, compléter la réservation au fil du temps, prévenir avant de terminer."],
    ["Présence périmée qui montre des astrologues occupés comme disponibles", "Battements de cœur avec des TTL courts ; marquer occupé au début d'une session."],
  ),
  scaling: [
    "Faire monter les couches de discussion et d'appel indépendamment de l'API.",
    "Sharder le grand livre par userId.",
    "Précalculer les horoscopes populaires ; calculer les thèmes personnels à la demande et les mettre en cache.",
  ],
  extensions: [
    "Sessions de groupe en direct avec cadeaux.",
    "Consultations planifiées avec rappels.",
    "Boutique (pierres précieuses, services de puja).",
  ],
};
