import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const quora: SystemTranslation = {
  tagline: "Questions, réponses, votes et fil personnalisé",
  description:
    "Quand quelqu'un pose une question, la recherche suggère d'abord des questions similaires existantes pour éviter les doublons. Les nouvelles questions et réponses sont stockées dans des tables relationnelles shardées, indexées pour la recherche et diffusées aux abonnés du sujet. Les votes sont comptés dans un cache rapide et intégrés à un modèle de classement qui ordonne les réponses et construit le fil de chaque lecteur.",
  requirements: {
    functional: [
      "Poser des questions étiquetées par sujets ; recevoir des suggestions de doublons pendant la saisie",
      "Répondre, commenter, voter pour ou contre",
      "Suivre des sujets, des questions et des personnes",
      "Fil d'accueil personnalisé et classement des réponses",
      "Rechercher des questions, notifications pour les réponses et les mentions",
    ],
    nonFunctional: [
      "Dominé par la lecture : les réponses sont bien plus lues qu'écrites",
      "Le fil se charge vite ; les compteurs de votes peuvent avoir un léger retard",
      "Spam et contenus de faible qualité tenus à l'écart",
    ],
  },
  apis: apis(
    "Doublons possibles pendant la saisie",
    "Poser une question avec des sujets",
    "Publier une réponse",
    "Vote pour ou contre (idempotent par utilisateur)",
    "Fil personnalisé",
  ),
  estimates: estimates(
    ["Utilisateurs quotidiens", "≈ 100 M", "Hypothèse"],
    ["Nouvelles réponses", "≈ 1 M/jour", "Hypothèse ; ~12/s"],
    ["Lectures de réponses", "≈ 50 k/s", "100 M d'utilisateurs × ~40 réponses vues ÷ 86 400 s"],
    ["Votes", "≈ 2 k/s", "Hypothèse"],
  ),
  dataModel: dataModel(
    ["Question / réponse", "Base relationnelle, shardée par questionId", "Une question et ses réponses vivent sur un même shard"],
    ["Vote", "Base orientée colonnes larges + compteurs en cache", "Un vote par utilisateur ; les totaux tenus dans des compteurs"],
    ["Abonnement", "Base relationnelle", "Pilote la diffusion dans les fils et les notifications"],
    ["Entrée de fil", "Cache en mémoire", "Candidats préconstruits pour des lectures de fil rapides"],
  ),
  nodes: nodes({
    web: ["Web", "Lire, demander, répondre"],
    mobile: ["Application mobile", "Lire, demander, répondre"],
    cdn: ["CDN", "Images et ressources statiques"],
    gateway: ["Passerelle d'API", "Authentification, limites de débit"],
    "qa-svc": ["Service questions-réponses", "Questions, réponses, commentaires"],
    "vote-svc": ["Service de votes", "Enregistre les votes et met à jour les compteurs"],
    "feed-svc": ["Service de fil", "Assemble et classe le fil de chaque utilisateur"],
    "search-svc": ["Service de recherche", "Recherche et détection des doublons"],
    "search-index": ["Index des questions", "Questions et réponses par texte"],
    ranking: ["Modèles de classement", "Qualité des réponses et pertinence du fil"],
    "main-db": ["Questions, réponses et abonnements", "Stockage relationnel shardé"],
    "votes-db": ["Votes et activité", "Activité à fort volume"],
    counters: ["Compteurs et fils", "Comptes de votes et fils préconstruits"],
    events: ["Événements de contenu", "Nouvelles questions, réponses, votes"],
    fanout: ["Workers de diffusion", "Poussent le nouveau contenu dans les fils des abonnés du sujet"],
    notify: ["Notifications", "Nouvelles réponses et mentions"],
  }),
  edges: edges({
    "vote-counters": "Incrémenter",
    "fanout-counters": "Candidats du fil",
    "events-ranking": "Signaux",
    "feed-ranking": "Score",
  }),
  flows: flows({
    ask: [
      "Poser une question",
      "Pendant la saisie, des questions similaires sont suggérées.",
      "Le service de recherche cherche les doublons.",
      "Les correspondances proches s'affichent ; l'utilisateur décide de publier quand même.",
      "La question est publiée avec ses sujets.",
      "Elle est stockée sur son shard.",
      "Un événement « nouvelle question » est publié.",
      "Elle devient consultable par la recherche.",
      "Les workers de diffusion l'ajoutent aux candidats des fils des abonnés du sujet.",
      "Les fils sont mis à jour en cache.",
    ],
    feed: [
      "Lire le fil",
      "L'utilisateur ouvre l'appli.",
      "Le service de fil rassemble les candidats.",
      "Les candidats préconstruits et les comptes de votes viennent du cache.",
      "Le modèle de classement les ordonne pour cet utilisateur.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des réponses populaires qui reçoivent beaucoup de votes", "Compter en cache, persister les votes de façon asynchrone et recalculer les scores par lots."],
    ["Questions en double", "Recherche de similarité pendant la saisie et fusion des doublons après coup."],
    ["Des sujets populaires avec des millions d'abonnés", "Pour les très gros sujets, récupérer le contenu à la lecture au lieu de le diffuser."],
  ),
  scaling: [
    "Sharder les questions par questionId ; mettre en cache les questions chaudes.",
    "Séparer l'activité à forte écriture (votes, vues) du stockage du contenu.",
    "Utiliser un service de coordination (ZooKeeper) pour la carte des shards et l'élection de leader des tâches de fond.",
  ],
  extensions: [
    "Espaces (communautés) avec leurs propres fils.",
    "Demandes de réponse adressées à des experts.",
    "Traduction automatique des réponses.",
  ],
};
