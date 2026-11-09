import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const pastebin: SystemTranslation = {
  tagline: "Partager des extraits de texte par lien court",
  description:
    "Un proche cousin du raccourcisseur d'URL, avec des valeurs plus grosses. Le texte va dans un stockage objet, un petit enregistrement de métadonnées contient la clé, le propriétaire et l'expiration, et les lectures sont servies par un CDN et un cache, car les extraits populaires sont bien plus lus qu'écrits. Une tâche de fond supprime les extraits expirés.",
  requirements: {
    functional: [
      "Créer un extrait (jusqu'à quelques Mo) et obtenir une URL courte",
      "Lire un extrait par son URL, y compris en texte brut",
      "Expiration, protection par mot de passe et visibilité non listée facultatives",
      "Supprimer ses propres extraits",
    ],
    nonFunctional: [
      "Lectures rapides et hautement disponibles",
      "Les extraits sont durables jusqu'à leur expiration",
      "Les clés sont difficiles à deviner",
    ],
  },
  apis: apis(
    "{ content, expiresIn?, visibility? } → { key, url }",
    "Extrait mis en forme",
    "Texte brut (cachable par le CDN)",
    "Supprimer (propriétaire uniquement)",
  ),
  estimates: estimates(
    ["Nouveaux extraits", "≈ 1 M/jour (~12/s)", "Hypothèse"],
    ["Lectures", "≈ 10 M/jour (~115/s)", "Ratio lecture/écriture de 10:1"],
    ["Nouveau contenu", "≈ 10 Go/jour", "1 M × ~10 Ko en moyenne ; ~3,6 To par an"],
    ["Métadonnées", "≈ 0,5 Go/jour", "1 M × ~500 octets"],
  ),
  dataModel: dataModel(
    ["Métadonnées d'extrait", "Base clé-valeur", "Petits enregistrements consultés uniquement par clé"],
    ["Contenu d'extrait", "Stockage objet", "Les grosses valeurs n'ont pas leur place dans la base"],
  ),
  nodes: nodes({
    browser: ["Navigateur / CLI", "Crée et lit des extraits"],
    cdn: ["CDN", "Met en cache le texte brut en périphérie"],
    lb: ["Répartiteur de charge", "Répartit le trafic"],
    app: ["Service d'extraits", "Crée, lit et supprime les extraits"],
    kgs: ["Générateur de clés", "Distribue des clés aléatoires uniques"],
    cache: ["Cache", "Métadonnées chaudes et petits contenus"],
    "meta-db": ["Métadonnées des extraits", "clé → emplacement du contenu et expiration"],
    blob: ["Contenu des extraits", "Le texte lui-même"],
    cleanup: ["Nettoyage des expirés", "Supprime les extraits expirés"],
  }),
  edges: edges({
    "browser-lb": "Créer / lire",
    "browser-cdn": "Vue brute",
    "cdn-lb": "Absent",
    "app-kgs": "Clé suivante",
    "cleanup-meta": "Trouver les expirés",
    "cleanup-blob": "Supprimer",
  }),
  flows: flows({
    create: [
      "Créer un extrait",
      "L'utilisateur envoie du texte (débit limité par IP).",
      "Le service d'extraits vérifie la taille.",
      "Il obtient une clé aléatoire unique.",
      "Le contenu est compressé et stocké.",
      "Les métadonnées avec l'emplacement du contenu et l'expiration sont enregistrées, et l'URL est renvoyée.",
    ],
    read: [
      "Lire un extrait",
      "Les vues brutes des extraits populaires viennent du CDN.",
      "En cas d'absence, la requête atteint le service.",
      "Le service d'extraits le recherche.",
      "Les extraits chauds sont en cache…",
      "…sinon les métadonnées sont lues et l'expiration vérifiée.",
      "Le contenu est récupéré dans le stockage et mis en cache.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des extraits volumineux dans la base", "Garder le contenu dans le stockage objet et seulement un pointeur dans la base."],
    ["Extraits viraux", "Servir le contenu brut depuis le CDN et le cache avec des TTL raisonnables."],
    ["Abus (spam, secrets divulgués, logiciels malveillants)", "Limites de débit, plafonds de taille et analyse avant de rendre un extrait public."],
  ),
  scaling: [
    "Sharder les métadonnées par hachage de la clé.",
    "Utiliser les règles de cycle de vie du stockage comme filet de sécurité pour l'expiration.",
    "Les services sans état montent en charge derrière le répartiteur.",
  ],
  extensions: [
    "Coloration syntaxique et détection du langage.",
    "Historique et versions des extraits.",
    "Extraits privés chiffrés côté client.",
  ],
};
