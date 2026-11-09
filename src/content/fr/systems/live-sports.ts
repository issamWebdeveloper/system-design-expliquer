import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const liveSports: SystemTranslation = {
  name: "Scores sportifs en direct",
  tagline: "Scores, commentaires et alertes en temps réel pour des millions",
  description:
    "Les marqueurs officiels et les partenaires de données envoient chaque balle, but ou point à un service d'ingestion. Les événements passent par un flux où un processeur met à jour l'état du match et les statistiques. Le nouveau score arrive dans un cache, est poussé par WebSockets à tous ceux qui suivent le match et déclenche des notifications push pour les grands moments — tandis que des instantanés sont mis en cache au CDN pour tous les autres.",
  requirements: {
    functional: [
      "Scores en direct, action par action et commentaires pour de nombreux matchs à la fois",
      "Statistiques des joueurs et des équipes mises à jour en temps réel",
      "Alertes push pour les buts, les guichets et les résultats",
      "Calendriers, rencontres et classements",
      "Outils d'administration pour que les marqueurs officiels corrigent les erreurs",
    ],
    nonFunctional: [
      "Les mises à jour atteignent les spectateurs en 1 à 2 secondes",
      "Énormes pics pendant les grands matchs (des dizaines de millions de spectateurs)",
      "Événements appliqués dans l'ordre ; les corrections doivent se propager",
    ],
  },
  apis: apis(
    "Le marqueur ou le partenaire envoie un événement balle/but (numéroté)",
    "Instantané actuel (en cache CDN une ou deux secondes)",
    "S'abonner aux mises à jour en direct",
    "Historique action par action",
  ),
  estimates: estimates(
    ["Spectateurs pendant une finale", "≈ 20–50 M", "Hypothèse pour un match majeur"],
    ["Événements de score", "≈ 1 toutes les quelques secondes par match", "Faible volume en entrée"],
    ["Diffusion push", "≈ 10–50 M de messages par événement", "Chaque spectateur reçoit chaque mise à jour"],
    ["Rafales d'alertes", "≈ 50 M de notifications en quelques secondes", "Une alerte de but à chaque abonné"],
  ),
  dataModel: dataModel(
    ["Événement de match", "Base de séries temporelles", "Action par action ordonnée ; les corrections font référence aux événements antérieurs"],
    ["État du match", "Cache en mémoire", "Lu par des millions ; reconstruit à partir des événements s'il est perdu"],
    ["Rencontre / classement", "Base clé-valeur", "Surtout statique, très mis en cache"],
  ),
  nodes: nodes({
    scorer: ["Appli du marqueur officiel", "Saisit chaque événement sur le lieu du match"],
    partners: ["Partenaires de données", "Flux de données sous licence"],
    viewers: ["Applis des fans", "Suivre scores et commentaires"],
    web: ["Web", "Scores et statistiques"],
    cdn: ["CDN", "Instantanés à TTL court pour les chargements de page"],
    ingest: ["Service d'ingestion", "Valide, ordonne et déduplique les événements"],
    stream: ["Flux des événements de match", "Événements ordonnés par match"],
    processor: ["Processeur d'état du match", "Applique les événements, met à jour les statistiques"],
    state: ["État du match", "Dernier score par match"],
    history: ["Action par action", "Chaque événement pour la relecture et les statistiques"],
    api: ["API des scores", "Instantanés et historique"],
    ws: ["Passerelle en direct", "Pousse les mises à jour aux abonnés"],
    notify: ["Alertes push", "Alertes de but et de résultat"],
  }),
  edges: edges({
    "scorer-ingest": "Événements",
    "partners-ingest": "Flux",
    "processor-ws": "Mises à jour",
    "processor-notify": "Grands moments",
    "web-cdn": "Instantané",
  }),
  flows: flows({
    goal: [
      "Un but est marqué",
      "Le marqueur officiel enregistre un but avec le numéro de séquence suivant.",
      "L'ingestion le valide et le publie dans la partition du match, en préservant l'ordre.",
      "Le processeur l'applique à l'état du match.",
      "Le nouveau score est écrit dans le cache.",
      "L'événement est ajouté à l'action par action.",
      "La mise à jour est poussée à chaque abonné en direct…",
      "…et les fans voient 1–0 en une ou deux secondes.",
      "Les abonnés de chaque équipe reçoivent une alerte push.",
      "Ceux qui ouvrent la page plus tard obtiennent un instantané vieux de deux secondes au plus.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Diffuser à des dizaines de millions d'un coup", "Un sujet par match sur une passerelle qui monte en charge horizontalement ; envoyer de petits diffs."],
    ["Tempêtes de chargements de page au coup d'envoi", "Servir les instantanés depuis le CDN avec des TTL de 1–2 secondes pour que l'origine ne reçoive qu'un filet de requêtes."],
    ["Événements désordonnés ou en double venant de plusieurs sources", "Numéros de séquence par match, déduplication à l'ingestion et événements de correction qui réécrivent l'état."],
  ),
  scaling: [
    "Partitionner le flux d'événements par matchId.",
    "Dimensionner les passerelles selon le nombre d'abonnés ; les préchauffer avant les grands matchs.",
    "Reconstruire l'état du match à partir du journal d'événements si le cache est perdu.",
  ],
  extensions: [
    "Points de fantasy sport calculés à partir des mêmes événements.",
    "Modèles de probabilité de victoire en direct.",
    "Extraits vidéo des temps forts liés aux événements.",
  ],
};
