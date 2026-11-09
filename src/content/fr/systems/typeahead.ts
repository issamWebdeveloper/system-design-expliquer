import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const typeahead: SystemTranslation = {
  name: "Autocomplétion de recherche",
  tagline: "Des suggestions à chaque frappe en moins de 100 ms",
  description:
    "Les suggestions sont précalculées : une tâche hors ligne transforme les journaux de requêtes en tries qui stockent les meilleures complétions à chaque préfixe, si bien que répondre à une frappe est une seule recherche. Les tries sont shardés par préfixe, les préfixes chauds restent en mémoire et même en périphérie du CDN, et une tâche de streaming met en avant les requêtes en vogue en ce moment.",
  requirements: {
    functional: [
      "Renvoyer les 5 à 10 meilleures complétions pour le texte déjà tapé",
      "Classer par popularité, fraîcheur et (éventuellement) l'historique et la langue de l'utilisateur",
      "Refléter les requêtes tendance en quelques minutes",
      "Filtrer les suggestions offensantes ou bloquées",
    ],
    nonFunctional: [
      "p99 sous ~100 ms de bout en bout pour suivre le rythme de la frappe",
      "Très dominé par la lecture : une requête par frappe",
      "Hautement disponible ; des suggestions un peu anciennes sont acceptables, des suggestions manquantes non",
    ],
  },
  apis: apis(
    "Meilleures complétions pour un préfixe (cachable)",
    "La requête soumise, qui alimente aussi le journal des requêtes",
  ),
  estimates: estimates(
    ["Recherches", "≈ 100 M/jour", "Hypothèse"],
    ["Requêtes de suggestion", "≈ 10 k/s en moyenne, ~30 k/s en pointe", "100 M de recherches × ~8 frappes ÷ 86 400 s ; l'anti-rebond réduit ce chiffre"],
    ["Taille des tries", "≈ 10–20 Go par langue", "~100 M de requêtes distinctes × préfixes × listes top-k ; répartis sur des shards"],
    ["Budget de latence", "< 50 ms côté serveur", "Laisse de la marge pour le réseau dans un objectif de 100 ms"],
  ),
  dataModel: dataModel(
    ["Nœud de trie", "Stockage clé-valeur (shards de tries sérialisés)", "Le top-k précalculé par préfixe évite tout classement au moment de la requête"],
    ["Journal des requêtes", "Flux d'événements → stockage objet", "Matière première pour reconstruire les tries et repérer les tendances"],
    ["Carte des shards", "Stockage de coordination", "Permet à chaque serveur de router un préfixe vers le bon shard et de changer de version de façon atomique"],
  ),
  nodes: nodes({
    client: ["Champ de recherche", "Envoie le préfixe après un court anti-rebond"],
    edge: ["Cache de périphérie", "Met en cache les suggestions des préfixes courts très courants"],
    gateway: ["Passerelle d'API", "Routage et limitation de débit"],
    "suggest-svc": ["Service de suggestions", "Trouve le shard d'un préfixe et renvoie son top-k"],
    "hot-cache": ["Cache des préfixes chauds", "Top-k en mémoire pour les préfixes les plus tapés"],
    "trie-store": ["Shards de tries", "Tries sérialisés, shardés par plage de préfixes"],
    "shard-map": ["Carte des shards", "Plage de préfixes → shard et version active du trie"],
    "query-log": ["Journal des requêtes", "Chaque recherche soumise"],
    "log-archive": ["Archive des journaux", "Des jours d'historique de requêtes pour la reconstruction"],
    builder: ["Constructeur de tries", "Agrège les journaux et construit de nouveaux tries hors ligne"],
    trending: ["Détecteur de tendances", "Compte les requêtes sur de courtes fenêtres et met en avant les pics"],
  }),
  edges: edges({
    "client-edge": "GET /suggest",
    "edge-gateway": "Absent",
    "suggest-shardmap": "Quel shard ?",
    "gateway-log": "Recherches soumises",
    "archive-builder": "Journaux quotidiens",
    "builder-trie": "Publier les nouveaux tries",
    "builder-shardmap": "Changer de version",
    "trending-cache": "Mettre en avant les tendances",
  }),
  flows: flows({
    suggest: [
      "Taper une lettre",
      "Après ~100 ms sans frappe, le champ envoie le préfixe ; les préfixes très courants sont servis en périphérie.",
      "Les préfixes moins courants atteignent la passerelle.",
      "Le service de suggestions prend la requête.",
      "Sa copie locale de la carte des shards indique quel shard possède ce préfixe.",
      "Les préfixes chauds viennent directement de la mémoire…",
      "…les autres demandent une seule recherche dans le shard de trie, qui contient déjà la liste top-k.",
    ],
    rebuild: [
      "Rafraîchir les suggestions",
      "Chaque recherche soumise est journalisée.",
      "Les journaux sont archivés dans le stockage objet.",
      "Une tâche quotidienne compte les requêtes avec une décroissance temporelle et filtre les termes bloqués.",
      "Elle construit de nouveaux tries avec des listes top-k à chaque préfixe et les envoie.",
      "La carte des shards bascule vers la nouvelle version de façon atomique.",
      "Pendant ce temps, une tâche de streaming guette les pics soudains…",
      "…et injecte les requêtes tendance dans le cache chaud en quelques minutes.",
    ],
  }),
  bottlenecks: bottlenecks(
    [
      "Une requête à chaque frappe",
      "Anti-rebond côté client, préfixes courts en cache en périphérie et en mémoire, recherches en O(longueur du préfixe).",
    ],
    [
      "Shards déséquilibrés (bien plus de requêtes commencent par « s » que par « x »)",
      "Découper selon le trafic mesuré plutôt que selon l'alphabet, et répliquer les shards chauds.",
    ],
    [
      "Les tries vieillissent entre deux reconstructions",
      "Superposer une couche rapide de tendances à la construction quotidienne.",
    ],
  ),
  scaling: [
    "Répliquer chaque shard de trie plusieurs fois et répartir les lectures.",
    "Construire les tries par langue et les servir depuis la région la plus proche.",
    "Les serveurs de suggestions sans état montent en charge horizontalement.",
    "Reconstruire hors ligne pour que le service des requêtes ne soit jamais en concurrence avec l'agrégation.",
  ],
  extensions: [
    "Suggestions personnalisées issues de l'historique de l'utilisateur.",
    "Correction orthographique des fautes de frappe.",
    "Suggestions enrichies (entités avec images) pour les personnes, lieux et produits.",
  ],
};
