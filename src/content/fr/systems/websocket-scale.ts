import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const websocketScale: SystemTranslation = {
  name: "WebSockets à grande échelle",
  tagline: "Des millions de connexions en direct avec Go sur Kubernetes",
  description:
    "Une couche temps réel réutilisable : des pods passerelles légers écrits en Go maintiennent des millions de connexions WebSocket derrière un répartiteur de niveau 4. Les services backend publient des événements sur un bus durable ; un routeur cherche à quel pod passerelle chaque destinataire est connecté et transmet l'événement via un canal pub/sub propre à ce pod, qui le pousse dans le socket. Les événements des destinataires hors ligne sont conservés jusqu'à leur reconnexion.",
  requirements: {
    functional: [
      "Les clients gardent une connexion persistante et reçoivent les événements en temps réel",
      "Les services backend peuvent envoyer à un utilisateur, à un groupe (salon) ou à tout le monde",
      "Présence : savoir qui est en ligne",
      "Livrer les événements manqués après une reconnexion",
    ],
    nonFunctional: [
      "Des millions de connexions simultanées",
      "Latence de livraison sous ~100 ms",
      "On peut ajouter, retirer ou redémarrer des pods passerelles sans perdre d'événements",
      "La mémoire par connexion reste faible",
    ],
  },
  apis: apis(
    "Ouvre une connexion ; le jeton est vérifié une seule fois à la connexion",
    "Push du serveur ; les clients accusent réception par numéro de séquence",
    "Les backends publient { recipients | room, event } sur le bus",
    "Statut en ligne et appareils connectés",
  ),
  estimates: estimates(
    ["Connexions simultanées", "≈ 10 M", "Hypothèse"],
    ["Connexions par pod", "≈ 50–100 k", "~10–20 Ko par connexion en Go → 1–2 Go de RAM pour 100 k"],
    ["Pods passerelles", "≈ 100–200", "10 M ÷ 50–100 k, avec de la marge pour les pannes"],
    ["Battements de cœur", "≈ 330 k/s", "10 M de connexions ÷ un ping toutes les 30 s"],
  ),
  dataModel: dataModel(
    ["Connexion", "Registre en mémoire", "Le routage doit savoir « quel pod détient cet utilisateur ? » en une recherche"],
    ["Appartenance à un salon", "Registre en mémoire", "Diffusion vers les groupes"],
    ["Événement en attente", "Base clé-valeur avec TTL", "Rejouer pour les clients qui étaient hors ligne"],
  ),
  nodes: nodes({
    mobile: ["Clients mobiles", "Une connexion chacun"],
    web: ["Clients web", "Une connexion par onglet"],
    nlb: ["Répartiteur L4", "Répartit les connexions TCP longues entre les pods"],
    gateway: ["Pods passerelles (Go)", "Gardent les sockets, vérifient les jetons, poussent les événements"],
    identity: ["Validation des jetons", "Émet et vérifie les JWT"],
    registry: ["Registre des connexions", "userId → pod, salons et présence"],
    backends: ["Services backend", "Messagerie, notifications, scores en direct…"],
    bus: ["Bus d'événements", "Flux durable et ordonné des événements sortants"],
    router: ["Routeur de diffusion", "Associe les destinataires à leurs pods"],
    pubsub: ["Canaux par pod", "Pub/sub à faible latence vers chaque pod passerelle"],
    pending: ["Événements en attente", "Événements pour les utilisateurs hors ligne"],
    metrics: ["Métriques", "Connexions, retard et pertes par pod"],
  }),
  edges: edges({
    "gateway-identity": "Vérifier le jeton",
    "gateway-registry": "Enregistrement / battement de cœur",
    "backends-bus": "Publier",
    "router-registry": "Où est l'utilisateur ?",
    "router-pubsub": "Vers le canal du pod",
    "pubsub-gateway": "Livrer",
    "router-pending": "Hors ligne",
    "gateway-pending": "Rejouer à la reconnexion",
  }),
  flows: flows({
    connect: [
      "Se connecter",
      "L'application ouvre un WebSocket avec son jeton.",
      "Le répartiteur L4 choisit un pod passerelle qui a de la capacité.",
      "Le pod vérifie le jeton une seule fois.",
      "Il enregistre userId → ce pod et garde l'entrée à jour avec des battements de cœur.",
      "Les événements manqués pendant la déconnexion sont rejoués dans l'ordre.",
    ],
    deliver: [
      "Livrer un événement",
      "Un backend publie un événement pour un utilisateur ou un salon.",
      "Les workers du routeur consomment le bus (partitionné pour que les événements de chaque utilisateur restent dans l'ordre).",
      "Ils cherchent quels pods détiennent les connexions des destinataires.",
      "L'événement part vers le canal de chaque pod.",
      "Le pod l'écrit dans les sockets ; les clients accusent réception par numéro de séquence.",
      "Pour les destinataires sans connexion active, l'événement est conservé pour plus tard.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Mémoire par connexion", "Les goroutines légères de Go et de petits tampons ; des lecteurs de type epoll pour les très gros pods."],
    ["Tempêtes de reconnexions après un déploiement ou une panne", "Vider les pods progressivement, ajouter un délai aléatoire croissant côté client et monter en charge avant le déploiement."],
    ["Des clients lents qui engorgent le pod", "Files d'envoi bornées par connexion ; abandonner ou déconnecter les clients trop en retard."],
    ["Diffuser à des millions", "Envoyer une fois par pod, pas par utilisateur, et laisser chaque pod diffuser localement."],
  ),
  scaling: [
    "Mise à l'échelle automatique des pods passerelles selon le nombre de connexions et le CPU.",
    "Sharder le registre par hachage cohérent ; les entrées expirent si les battements de cœur s'arrêtent.",
    "Partitionner le bus par destinataire pour garder l'ordre par utilisateur.",
    "Déployer par région et transmettre les événements inter-régions via le bus.",
  ],
  extensions: [
    "Repli sur Server-Sent Events pour les réseaux restrictifs.",
    "Limites de débit de publication par client (tenant).",
    "Accusés de livraison de bout en bout remontés aux backends.",
  ],
};
