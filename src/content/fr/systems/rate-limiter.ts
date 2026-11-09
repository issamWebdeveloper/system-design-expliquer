import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const rateLimiter: SystemTranslation = {
  name: "Limiteur de débit d'API",
  tagline: "Des limites d'usage équitable vérifiées à chaque requête en moins d'une milliseconde",
  description:
    "Chaque requête d'API passe par un limiteur au niveau de la passerelle, qui met à jour de façon atomique un compteur (ou un seau à jetons) pour ce client dans un stockage en mémoire partagé et répond autoriser ou refuser. Les règles vivent dans une base de configuration et sont poussées vers chaque instance du limiteur : un changement s'applique en quelques secondes sans redéploiement. Si le stockage des compteurs tombe, le limiteur laisse passer plutôt que d'entraîner l'API dans sa chute.",
  requirements: {
    functional: [
      "Limiter les requêtes par identité client (utilisateur, clé d'API ou IP), par ex. 100 par minute",
      "Des limites différentes selon le point d'accès, l'offre ou le niveau",
      "Renvoyer un HTTP 429 avec Retry-After et des en-têtes X-RateLimit-* au-delà de la limite",
      "Les administrateurs ajoutent ou modifient des règles sans redéployer",
      "Rendre compte de l'usage et des refus pour la supervision et la facturation",
    ],
    nonFunctional: [
      "Ajoute moins de ~1–2 ms à chaque requête",
      "Les limites tiennent sur de nombreuses instances de passerelle (distribuées, pas par serveur)",
      "Hautement disponible ; si le limiteur tombe, le trafic continue (fail open)",
      "Un léger excès ou défaut de comptage aux bords des fenêtres est acceptable",
    ],
  },
  apis: apis(
    "Appelé par la passerelle à chaque requête",
    "Usage actuel et quota restant",
    "Crée une règle : { scope, match, limit, window, algorithm }",
    "Modifie une limite ; propagée à tous les limiteurs en quelques secondes",
  ),
  estimates: estimates(
    ["Vérifications (pire cas)", "≈ 1,7 M/s", "1 M de clients × 100 req/min ÷ 60 s"],
    ["Compteurs actifs", "≈ 5 M", "Un par client actif × règle"],
    ["Mémoire des compteurs", "≈ 0,5–1 Go", "5 M × ~100–200 octets par clé"],
    ["Shards du stockage des compteurs", "≈ 20", "1,7 M op/s ÷ ~100 k op/s par shard Redis"],
    ["Budget de latence", "< 1 ms", "Un aller-retour vers un stockage en mémoire dans la même zone"],
  ),
  dataModel: dataModel(
    ["Règle", "Base relationnelle (source de vérité)", "Petite, rarement modifiée, nécessite un historique et une validation"],
    ["Seau à jetons", "Stockage en mémoire (hash Redis)", "Recharger et prélever dans un seul script atomique ; autorise de courtes rafales jusqu'à la taille du seau"],
    ["Compteur à fenêtre fixe / glissante", "Stockage en mémoire (Redis)", "INCR + EXPIRE ; la fenêtre glissante combine les comptes de la fenêtre courante et de la précédente"],
  ),
  nodes: nodes({
    clients: ["Clients d'API", "Applications et intégrations qui appellent l'API"],
    admin: ["Console d'administration", "Modifier les limites par offre ou par client"],
    gateway: ["Passerelle d'API", "Point d'application : consulte le limiteur, renvoie 429 ou transmet"],
    limiter: ["Limiteur de débit", "Associe la requête aux règles et exécute l'algorithme (plugin de passerelle ou sidecar)"],
    counters: ["Stockage des compteurs", "Compteurs et seaux à jetons partagés, mis à jour atomiquement par scripts Lua"],
    backend: ["API backend", "Les services protégés"],
    "rules-svc": ["Service des règles", "Valide et enregistre les changements de règles"],
    "rules-db": ["Base des règles", "Toutes les règles de limitation"],
    config: ["Distribution de la configuration", "Pousse les mises à jour de règles vers chaque limiteur (watch)"],
    metrics: ["Métriques et alertes", "Requêtes autorisées / refusées par client et par route"],
  }),
  edges: edges({
    "clients-gateway": "Requête d'API",
    "gateway-limiter": "Autorisé ?",
    "limiter-counters": "Vérification + mise à jour atomique",
    "gateway-backend": "Requêtes autorisées",
    "admin-rules": "Modifier une règle",
    "rules-config": "Publier",
    "config-limiter": "Mises à jour de règles",
  }),
  flows: flows({
    check: [
      "Vérifier une requête",
      "Une requête arrive avec une clé d'API.",
      "La passerelle consulte le limiteur ; celui-ci trouve la règle la plus spécifique dans sa copie locale en mémoire.",
      "Un seul script Lua recharge le seau selon le temps écoulé, prend un jeton s'il y en a et renvoie ce qui reste — de façon atomique, pour que des passerelles concurrentes ne laissent pas passer trop de requêtes.",
      "Autorisée : la requête est transmise avec les en-têtes X-RateLimit-Remaining. Refusée : la passerelle renvoie plutôt un 429 avec Retry-After.",
      "Les comptes d'autorisations / refus sont émis de façon asynchrone.",
    ],
    rule: [
      "Modifier une limite",
      "Un administrateur relève la limite d'un client à 1 000 par minute.",
      "La règle est validée et enregistrée.",
      "La nouvelle version est publiée dans le stockage de configuration.",
      "Chaque limiteur l'observe et adopte les nouvelles règles en quelques secondes — sans redéploiement.",
    ],
  }),
  bottlenecks: bottlenecks(
    [
      "Conditions de concurrence entre instances de passerelle",
      "Lire-modifier-écrire dans un seul script Lua (ou un INCR) pour que chaque vérification soit atomique dans le stockage.",
    ],
    [
      "Le stockage des compteurs ajoute de la latence à chaque requête",
      "Le garder dans la même zone, regrouper les appels et, pour les très hautes limites, tenir un compteur local synchronisé par lots.",
    ],
    [
      "Un seul client bruyant devient une clé chaude",
      "Une clé chaude tient sur un shard jusqu'à ~100 k op/s ; au-delà, répartir le seau sur des sous-clés ou compter d'abord localement.",
    ],
    [
      "Panne du stockage des compteurs",
      "Laisser passer (fail open) avec un timeout court, se rabattre sur des limites locales par instance et alerter.",
    ],
    [
      "Limites globales entre régions",
      "Donner à chaque région une part de la limite et rééquilibrer périodiquement — des comptes globaux exacts exigeraient de lents appels inter-régions.",
    ],
  ),
  scaling: [
    "Sharder les compteurs par clientId avec du hachage cohérent sur un cluster Redis.",
    "Exécuter le limiteur dans le processus de la passerelle ou en sidecar pour éviter un saut réseau.",
    "Mettre les règles en cache localement dans chaque limiteur ; le stockage de configuration ne pousse que les changements.",
    "Ajouter des shards de compteurs quand le volume de requêtes augmente ; le limiteur lui-même est sans état.",
  ],
  extensions: [
    "Limites de concurrence (requêtes en cours) en plus des limites de débit.",
    "Limites adaptatives qui se resserrent automatiquement quand les backends sont surchargés.",
    "Quotas facturés par offre, avec export de l'usage vers la facturation.",
    "Limites par IP au niveau du CDN/WAF pour absorber les inondations avant la passerelle.",
  ],
};
