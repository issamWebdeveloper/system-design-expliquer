import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const webCrawler: SystemTranslation = {
  name: "Robot d'indexation (crawler)",
  tagline: "Récupérer des milliards de pages poliment et sans doublons",
  description:
    "Une frontière d'URL distribue des URL à des workers de récupération, avec une file par hôte pour qu'aucun site ne soit martelé. Les pages récupérées sont stockées et analysées pour en extraire les liens ; chaque nouveau lien est vérifié dans un filtre de Bloom de tout ce qui a déjà été vu avant de revenir dans la frontière. Des empreintes de contenu repèrent la même page sous différentes URL, et un planificateur remet les pages en file quand elles doivent être revisitées.",
  requirements: {
    functional: [
      "Partir d'URL de départ et suivre les liens pour découvrir de nouvelles pages",
      "Respecter robots.txt et les limites de débit par site (politesse)",
      "Ignorer les URL déjà explorées et les pages au contenu dupliqué",
      "Stocker les pages brutes pour l'indexation et l'analyse",
      "Revisiter les pages selon la fréquence à laquelle elles changent",
    ],
    nonFunctional: [
      "Des milliards de pages par mois sur un cluster qui monte en charge horizontalement",
      "Ne jamais surcharger un site web",
      "Résister aux sites lents, cassés ou malveillants (timeouts, limites de taille, pièges)",
      "Des workers peuvent tomber sans perdre l'état de la frontière",
    ],
  },
  apis: apis(
    "Ajoute des URL ou domaines de départ à explorer",
    "État d'exploration, date de dernière récupération et résultat HTTP d'une URL",
    "Surcharge le rythme d'exploration ou l'exclusion d'un site",
  ),
  estimates: estimates(
    ["Pages récupérées", "≈ 1 Md/mois (~400/s)", "Hypothèse ; ajouter des workers linéairement pour aller plus loin"],
    ["Stockage brut", "≈ 100 To/mois", "1 Md × ~100 Ko par page ; ~25 To compressés"],
    ["Liens découverts", "≈ 20 k/s avant déduplication", "400 pages/s × ~50 liens sortants"],
    ["Filtre des URL vues", "≈ 12 Go", "10 Md d'URL × 10 bits chacune pour ~1 % de faux positifs"],
  ),
  dataModel: dataModel(
    ["Enregistrement d'URL", "Base orientée colonnes larges", "Des milliards de lignes, mises à jour après chaque récupération"],
    ["Entrée de la frontière", "Une file par hôte (shardée par hôte)", "Une file par hôte réduit la politesse à une règle simple : une récupération par hôte à la fois"],
    ["Page", "Stockage objet", "Gros blobs immuables pour l'indexation en aval"],
    ["Empreinte de contenu", "Base clé-valeur", "Détecte miroirs et doublons sous des URL différentes"],
  ),
  nodes: nodes({
    scheduler: ["Planificateur d'exploration", "Ajoute les URL de départ et remet en file les pages à revisiter"],
    frontier: ["Frontière d'URL", "Files par hôte avec priorités et prochaine heure autorisée"],
    fetchers: ["Workers de récupération", "Téléchargent les pages avec timeouts et limites de taille"],
    coordinator: ["Coordinateur", "Attribue les hôtes aux workers (hachage cohérent) et élit un leader"],
    "dns-cache": ["Cache DNS et robots", "IP résolues, règles robots.txt et limites de débit par hôte"],
    websites: ["Sites web", "Le web ouvert"],
    "page-store": ["Stockage des pages", "Pages brutes récupérées"],
    parser: ["Analyseur et extracteur de liens", "Extrait le texte, les liens et une empreinte de contenu"],
    "seen-urls": ["Filtre de Bloom des URL vues", "Vérification rapide « l'avons-nous déjà mise en file ? »"],
    fingerprints: ["Empreintes de contenu", "Détecte le contenu dupliqué"],
    "url-db": ["Métadonnées des URL", "État et planning de chaque URL connue"],
    indexer: ["Index de recherche", "Consommateur en aval du texte exploré"],
  }),
  edges: edges({
    "scheduler-frontier": "URL de départ / à revisiter",
    "scheduler-db": "Trouver les pages à revisiter",
    "fetchers-coordinator": "Attribution des hôtes",
    "fetchers-dns": "Résolution, robots, limite de débit",
    "fetchers-web": "HTTP GET",
    "fetchers-store": "HTML brut",
    "fetchers-parser": "Page récupérée",
    "parser-fingerprints": "Contenu dupliqué ?",
    "parser-seen": "URL déjà vue ?",
    "parser-frontier": "Nouvelles URL",
    "parser-db": "Mettre à jour l'état",
    "store-indexer": "Indexer le texte",
  }),
  flows: flows({
    crawl: [
      "Explorer une page",
      "Un worker prend l'URL suivante dans une file d'hôte qui lui appartient — au plus une requête en cours par hôte.",
      "Il vérifie les règles robots.txt en cache et le délai d'exploration de l'hôte, et résout le DNS depuis le cache.",
      "Il télécharge la page avec un timeout et une taille maximale.",
      "Le HTML brut est stocké.",
      "La page est confiée à un analyseur.",
      "Une empreinte de contenu signale miroirs et doublons.",
      "Chaque lien extrait est normalisé et vérifié dans le filtre de Bloom.",
      "Seuls les liens jamais vus entrent dans la frontière, dans la file de leur hôte.",
      "L'état de l'URL, son empreinte et sa prochaine date de visite sont enregistrés.",
      "En aval, le texte est indexé pour la recherche.",
    ],
  }),
  bottlenecks: bottlenecks(
    [
      "Marteler un seul site web",
      "Des files par hôte gérées par un seul worker, le respect de robots.txt et des délais adaptés aux temps de réponse.",
    ],
    [
      "Des milliards de vérifications « avons-nous déjà vu cette URL ? »",
      "Un filtre de Bloom en mémoire shardé répond à presque toutes ; seuls les « peut-être vu » interrogent la base.",
    ],
    [
      "Pièges à robots et pages énormes",
      "Plafonner la profondeur et la longueur des URL et le nombre de pages par hôte ; imposer limites d'octets et timeouts.",
    ],
    [
      "La découverte de liens dépasse la récupération",
      "Prioriser la frontière (importance de la page, fréquence de changement) et abandonner ou différer les URL de faible valeur quand les files grossissent.",
    ],
  ),
  scaling: [
    "Attribuer les hôtes aux workers par hachage cohérent : ajouter un worker ne déplace que peu d'hôtes.",
    "Sharder la frontière, le filtre de Bloom et le stockage des URL par hôte ou hachage d'URL.",
    "Faire tourner des workers dans plusieurs régions pour réduire la latence vers les sites lointains.",
    "Sauvegarder périodiquement la frontière pour que les hôtes d'un worker planté soient repris par d'autres.",
  ],
  extensions: [
    "Rendu JavaScript pour les applications côté client (pool de navigateurs headless).",
    "Exploration ciblée sur un sujet ou un ensemble de domaines.",
    "Ingestion des sitemaps et flux RSS pour trouver plus vite les nouvelles pages.",
  ],
};
