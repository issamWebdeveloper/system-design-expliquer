import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const redis: SystemTranslation = {
  tagline: "Stockage de données distribué en mémoire",
  description:
    "Redis Cluster découpe l'espace des clés en 16 384 slots de hachage répartis sur plusieurs nœuds primaires, chacun avec un ou plusieurs réplicas. Les clients hachent chaque clé vers son slot et parlent directement au primaire qui le possède, en suivant les redirections MOVED quand des slots migrent. Les primaires répliquent de façon asynchrone vers leurs réplicas, et les nœuds eux-mêmes détectent les pannes via le bus du cluster et votent pour promouvoir un réplica — sans coordinateur externe.",
  requirements: {
    functional: [
      "Lire, écrire et faire expirer des clés, plus des structures de données (hashes, sets, sorted sets, streams)",
      "Répartir données et charge sur de nombreux nœuds",
      "Lectures facultatives depuis les réplicas",
      "Ajouter ou retirer des nœuds et déplacer les données sans interruption",
      "Survivre à la perte d'un primaire grâce à la bascule automatique",
    ],
    nonFunctional: [
      "Latence inférieure à la milliseconde pour les opérations sur une seule clé",
      "Débit qui monte linéairement quand on ajoute des primaires",
      "Bascule en quelques secondes",
      "Accepter une petite fenêtre d'écritures perdues lors d'une bascule (la réplication est asynchrone)",
    ],
  },
  apis: apis(
    "Commandes clé-valeur de base via le protocole Redis (RESP)",
    "Les clients récupèrent quel nœud possède quelle plage de slots",
    "Redirection quand un client interroge le mauvais nœud ; il met à jour sa carte des slots",
    "Les opérations multi-clés ne marchent que si les clés partagent un hash tag (même slot)",
  ),
  estimates: estimates(
    ["Slots de hachage", "16 384", "slot = CRC16(clé) mod 16384 ; les slots sont l'unité de sharding"],
    ["Débit par primaire", "≈ 100 k+ op/s", "Exécution des commandes sur un seul thread, sur un cœur"],
    ["Débit du cluster", "≈ 300 k op/s pour 3 primaires", "Monte à peu près linéairement avec le nombre de primaires"],
    ["Mémoire par nœud", "Des dizaines de Go", "Jeu de données ÷ primaires, plus le surcoût ; les réplicas doublent la mémoire totale"],
  ),
  dataModel: dataModel(
    ["Clé", "En mémoire, sur le primaire qui possède son slot", "Le hachage vers les slots répartit les clés uniformément ; les hash tags regroupent les clés liées"],
    ["Carte des slots", "Chaque nœud (bus du cluster) et chaque client", "Permet aux clients d'envoyer chaque commande directement au bon nœud"],
    ["Persistance", "Disque local (instantanés RDB / journal AOF)", "Reprise au redémarrage ; la réplication est le principal mécanisme de disponibilité"],
  ),
  nodes: nodes({
    "app-client": ["Client applicatif", "Services qui utilisent Redis pour le cache, les sessions, les compteurs ou le pub/sub"],
    proxy: ["Point d'accès du cluster / client intelligent", "Associe chaque clé à son slot et au nœud qui le possède"],
    failover: ["Détection des pannes (bus du cluster)", "Les nœuds échangent leur état ; une majorité de primaires vote pour promouvoir un réplica"],
    "primary-1": ["Primaire A (slots 0–5460)", "Possède un tiers des slots ; traite les écritures"],
    "replica-1": ["Réplica A", "Copie de A ; peut servir des lectures et prendre le relais"],
    "primary-2": ["Primaire B (slots 5461–10922)", "Possède un tiers des slots ; traite les écritures"],
    "replica-2": ["Réplica B", "Copie de B"],
    "primary-3": ["Primaire C (slots 10923–16383)", "Possède un tiers des slots ; traite les écritures"],
    "replica-3": ["Réplica C", "Copie de C"],
    monitoring: ["Supervision", "Mémoire, latence, taux de succès du cache et retard de réplication par nœud"],
  }),
  edges: edges({
    "client-proxy": "Protocole Redis",
    "proxy-a": "Commandes",
    "repl-a": "Réplication asynchrone",
    "proxy-replica-a": "Lectures facultatives",
    "failover-a": "Santé",
    "failover-promote": "Promouvoir",
    "monitoring-b": "Métriques (tous les nœuds)",
  }),
  flows: flows({
    write: [
      "Écrire une clé",
      "L'application exécute SET user:42 … ; le client hache la clé vers le slot 5649.",
      "Sa carte des slots indique que le primaire B possède ce slot : la commande y va directement (si la carte est périmée, B répond MOVED et le client la rafraîchit).",
      "B accuse réception immédiatement et transmet l'écriture à son réplica de façon asynchrone.",
    ],
    failover: [
      "Un primaire tombe",
      "Le primaire A ne répond plus ; les autres nœuds le marquent comme possiblement en panne via le bus du cluster.",
      "Une majorité de primaires tombe d'accord, et le réplica A est promu propriétaire des slots 0–5460.",
      "Les clients reçoivent des réponses MOVED, rafraîchissent leur carte des slots et envoient les clés de A au nouveau primaire. Les écritures pas encore répliquées sont perdues.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des clés chaudes qui concentrent la charge sur un primaire", "Découper les clés chaudes, les mettre en cache dans l'application, ou lire depuis les réplicas quand des données un peu anciennes sont acceptables."],
    ["Les grosses clés et les commandes lentes bloquent l'unique thread", "Éviter les collections énormes et les commandes en O(N) comme KEYS ; utiliser SCAN et des structures plus petites."],
    ["Écritures perdues lors d'une bascule", "L'accepter pour un cache ; pour les données critiques, utiliser WAIT pour attendre l'accusé des réplicas, ou un stockage durable comme source de vérité."],
  ),
  scaling: [
    "Ajouter des primaires et leur déplacer des slots de hachage à chaud (resharding).",
    "Ajouter des réplicas pour la capacité de lecture et une bascule plus rapide.",
    "Utiliser des hash tags ({user:42}) pour que les clés utilisées ensemble tombent dans le même slot.",
    "Répartir les nœuds sur plusieurs zones de disponibilité pour qu'une panne de zone laisse une majorité de primaires.",
  ],
  extensions: [
    "Redis Streams comme journal d'événements léger.",
    "Cache côté client avec invalidation assistée par le serveur.",
    "Déploiements actif-actif géorépliqués (fondés sur les CRDT) pour des écritures multi-régions.",
  ],
};
