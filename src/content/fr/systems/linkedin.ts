import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const linkedin: SystemTranslation = {
  tagline: "Profils, relations, fil, messagerie et offres d'emploi",
  description:
    "Le graphe professionnel est au cœur du système : les relations vivent dans un stockage de graphe qui répond à « comment suis-je lié à cette personne ? » et alimente « Personnes que vous pourriez connaître ». Les publications sont diffusées dans les fils des relations et classées par un modèle. Les offres d'emploi forment une verticale de recherche distincte, rapprochée des profils, et la messagerie tourne sur une couche temps réel.",
  requirements: {
    functional: [
      "Profils avec expériences, compétences et formation",
      "Envoyer et accepter des demandes de relation ; suivre des personnes et des entreprises",
      "Publier des actualités ; voir un fil classé",
      "Rechercher des personnes et des offres ; postuler",
      "Messagerie directe et notifications",
    ],
    nonFunctional: [
      "Requêtes de graphe (degré de relation) en quelques millisecondes",
      "Le fil se charge vite pour des centaines de millions d'utilisateurs",
      "Les modifications de profil apparaissent dans la recherche en quelques minutes",
    ],
  },
  apis: apis(
    "Profil avec votre degré de relation",
    "Envoyer une demande de relation",
    "Accepter",
    "Fil classé",
    "Recherche d'offres d'emploi",
    "Messages en temps réel",
  ),
  estimates: estimates(
    ["Membres", "≈ 1 Md, dont 150 M par jour", "Hypothèse fondée sur des chiffres publics"],
    ["Relations", "≈ 50–100 Md d'arêtes", "Quelques centaines de relations par membre en moyenne"],
    ["Requêtes de fil", "≈ 20 k/s en moyenne", "150 M × ~10 chargements du fil ÷ 86 400 s"],
    ["Recherches d'offres", "≈ 5 k/s", "Hypothèse"],
  ),
  dataModel: dataModel(
    ["Profil", "Base relationnelle / documentaire, shardée par memberId", "Dominé par la lecture ; alimente aussi la recherche"],
    ["Relation", "Stockage de graphe", "Parcours pour le degré de relation et « personnes que vous pourriez connaître »"],
    ["Publication", "Base orientée colonnes larges", "Fort volume, lue via les fils"],
    ["Offre d'emploi", "Index de recherche + base relationnelle", "Recherche plein texte et par facettes"],
  ),
  nodes: nodes({
    web: ["Web", "Profils, fil, offres"],
    mobile: ["Application mobile", "Fil, messagerie, notifications"],
    cdn: ["CDN", "Photos de profil et médias"],
    gateway: ["Passerelle d'API", "Authentification et routage"],
    "profile-svc": ["Service des profils", "Profils et paramètres"],
    "graph-svc": ["Service de graphe", "Relations et requêtes de degré"],
    "graph-db": ["Graphe des membres", "Relations et abonnements"],
    "feed-svc": ["Service de fil", "Rassemble et classe les publications"],
    "feed-cache": ["Cache du fil", "ID des publications récentes par membre"],
    "jobs-svc": ["Service des offres", "Recherche d'offres, candidatures"],
    "search-index": ["Index des personnes et offres", "Membres et offres d'emploi"],
    recommend: ["Recommandations", "Personnes que vous pourriez connaître, offres adaptées, classement du fil"],
    messaging: ["Messagerie", "Conversations en temps réel"],
    "main-db": ["Profils et offres", "Shardés par membre / entreprise"],
    "posts-db": ["Publications", "Publications et activité des membres"],
    events: ["Événements d'activité", "Modifications de profil, publications, relations"],
    notify: ["Notifications", "Demandes, messages, alertes emploi"],
  }),
  edges: edges({
    "feed-posts": "Compléter",
    "feed-recommend": "Classer",
    "events-feed": "Diffusion",
    "jobs-recommend": "Offres adaptées",
  }),
  flows: flows({
    connect: [
      "Accepter une relation",
      "Le membre accepte une demande de relation.",
      "Le service de graphe la traite.",
      "Une arête de relation est ajoutée dans les deux sens.",
      "Un événement « relation établie » est publié.",
      "Les publications récentes de chacun peuvent désormais apparaître dans le fil de l'autre.",
      "« Personnes que vous pourriez connaître » est rafraîchi à partir des nouvelles relations de deuxième degré.",
      "Le demandeur est prévenu.",
    ],
    jobs: [
      "Trouver un emploi",
      "Le membre cherche « ingénieur backend, Bangalore ».",
      "Le service des offres lance la recherche.",
      "L'index fait correspondre intitulé, lieu et compétences.",
      "Les résultats sont reclassés selon l'adéquation avec le profil du membre.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Parcours de graphe sur des milliards d'arêtes", "Partitionner le graphe par membre, garder les listes de premier degré en mémoire et précalculer hors ligne les candidats de deuxième degré."],
    ["Des influenceurs avec des millions d'abonnés", "Fil hybride : récupérer leurs publications à la lecture au lieu de les diffuser."],
    ["Fraîcheur de la recherche après une modification de profil", "Envoyer les changements de profil en flux vers l'index en quelques minutes."],
  ),
  scaling: [
    "Sharder membres, publications et graphe par memberId.",
    "Précalculer les recommandations hors ligne et les servir depuis le cache.",
    "Isoler la messagerie dans sa propre couche temps réel.",
  ],
  extensions: [
    "Pages entreprise et outils pour recruteurs.",
    "Cours en ligne.",
    "Évaluations de compétences et recommandations.",
  ],
};
