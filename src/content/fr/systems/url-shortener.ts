import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const urlShortener: SystemTranslation = {
  name: "Raccourcisseur d'URL",
  tagline: "Des liens courts et des milliards de redirections",
  description:
    "Un service de génération de clés distribue des clés Base62 uniques de 7 caractères à partir de plages pré-allouées : créer un lien n'exige donc jamais de vérifier l'unicité. Une redirection est une simple lecture par clé, servie surtout depuis le cache (voire depuis la périphérie du CDN), et les événements de clic partent de façon asynchrone vers l'analytique pour garder le chemin de redirection minuscule.",
  requirements: {
    functional: [
      "À partir d'une URL longue, renvoyer un lien court unique",
      "Visiter le lien court redirige vers l'URL d'origine",
      "Alias personnalisé et date d'expiration facultatifs",
      "Statistiques de clics par lien",
    ],
    nonFunctional: [
      "Redirections en quelques millisecondes, très haute disponibilité",
      "Dominé par la lecture : environ 100 redirections par lien créé",
      "Les clés doivent être uniques et difficiles à deviner en séquence",
      "Les liens ne sont jamais perdus avant leur expiration",
    ],
  },
  apis: apis(
    "{ url, alias?, expiresIn? } → { shortUrl }",
    "Redirection 301/302 vers l'URL d'origine (404 si inconnue ou expirée)",
    "Nombre de clics par jour, pays et site référent",
    "Supprimer un lien (propriétaire uniquement)",
  ),
  estimates: estimates(
    ["Nouveaux liens", "≈ 200/s", "500 M par mois ÷ (30 × 86 400 s)"],
    ["Redirections", "≈ 20 k/s", "Ratio lecture/écriture de 100:1"],
    ["Stockage sur 5 ans", "≈ 15 To", "500 M × 12 × 5 = 30 Md de liens × ~500 octets"],
    ["Taille du cache", "≈ 170 Go", "20 % des 1,7 Md de redirections quotidiennes × 500 octets (règle des 80/20)"],
    ["Espace de clés", "62⁷ ≈ 3 500 milliards", "7 caractères Base62 — plus de 100× le besoin sur 5 ans"],
  ),
  dataModel: dataModel(
    ["Lien", "Base clé-valeur", "La seule requête chaude est « clé → URL » ; les bases clé-valeur la font monter en charge horizontalement"],
    ["Plage de clés", "Stockage de coordination", "Chaque instance de génération réserve un bloc de valeurs de compteur : deux instances ne distribuent jamais la même clé"],
    ["Clic", "Entrepôt de données", "Analytique en ajout seul, agrégée hors ligne"],
  ),
  nodes: nodes({
    creator: ["Créateur (appli / API)", "Crée des liens courts"],
    visitor: ["Navigateur du visiteur", "Clique sur un lien court"],
    edge: ["Cache de périphérie", "Met en cache les redirections populaires près des visiteurs"],
    lb: ["Répartiteur de charge", "Répartit le trafic entre les serveurs applicatifs"],
    app: ["Service de raccourcissement", "Crée les liens et sert les redirections (sans état)"],
    kgs: ["Service de génération de clés", "Distribue des clés inutilisées issues d'une plage réservée"],
    ranges: ["Allocateur de plages", "Donne à chaque générateur un bloc unique de valeurs de compteur"],
    cache: ["Cache des liens populaires", "clé → URL pour les liens populaires"],
    db: ["Stockage des liens", "Toutes les correspondances clé courte → URL"],
    clicks: ["Événements de clic", "Un événement par redirection"],
    analytics: ["Analytique des clics", "Statistiques agrégées par lien"],
    cleanup: ["Nettoyage des expirés", "Supprime les liens expirés en arrière-plan"],
  }),
  edges: edges({
    "creator-lb": "POST /shorten",
    "visitor-edge": "GET /{key}",
    "edge-lb": "Absent",
    "app-kgs": "Clé suivante",
    "kgs-ranges": "Réserver une plage",
    "cleanup-db": "Supprimer les expirés",
  }),
  flows: flows({
    shorten: [
      "Créer un lien court",
      "Le créateur envoie une URL longue.",
      "N'importe quel serveur applicatif peut la traiter — ils sont sans état.",
      "L'application demande la clé suivante au générateur. Il encode une valeur de compteur en Base62 (ex. « aZ3x9Qk »).",
      "Le générateur ne réserve une nouvelle plage que lorsque son bloc est épuisé : cet appel est rare.",
      "La correspondance est écrite. Comme les clés sont uniques par construction, aucune vérification de collision n'est nécessaire.",
      "Elle est aussi écrite dans le cache, car les nouveaux liens sont souvent cliqués tout de suite.",
    ],
    redirect: [
      "Suivre un lien court",
      "Le navigateur demande le lien court ; les plus populaires sont servis en périphérie.",
      "En cas d'absence, la requête atteint le répartiteur de charge.",
      "Un serveur applicatif la traite.",
      "La plupart des recherches trouvent la clé dans le cache…",
      "…sinon une seule lecture clé-valeur trouve l'URL. Les clés expirées ou inconnues renvoient 404.",
      "Un événement de clic est émis de façon asynchrone et la redirection est renvoyée immédiatement.",
      "L'analytique agrège les clics par lien en arrière-plan.",
    ],
  }),
  bottlenecks: bottlenecks(
    [
      "Générer des clés uniques sans goulot central ni collision",
      "Pré-allouer des plages de compteur à chaque générateur ; encoder le compteur en Base62 (en mélangeant les bits pour que les clés ne soient pas séquentielles).",
    ],
    [
      "20 k+ redirections par seconde sur la base",
      "Cache-aside avec éviction LRU pour les ~20 % de liens qui reçoivent l'essentiel des clics ; mettre aussi en cache en périphérie.",
    ],
    [
      "Le dilemme 301 contre 302",
      "Une 301 laisse les navigateurs mettre la redirection en cache (moins de charge, mais clics non comptés) ; une 302 garde chaque clic visible pour l'analytique.",
    ],
    [
      "Abus : spam et liens malveillants",
      "Limiter le débit de création par utilisateur/IP et vérifier les URL dans une liste de blocage de logiciels malveillants avant de les enregistrer.",
    ],
  ),
  scaling: [
    "Sharder le stockage des liens par hachage de la clé ; les lectures se répartissent uniformément.",
    "Répliquer stockage et cache entre régions ; les redirections sont servies depuis la plus proche.",
    "Les serveurs applicatifs sont sans état et montent en charge derrière le répartiteur.",
    "Écrire les événements de clic dans un flux pour que l'analytique ne ralentisse jamais les redirections.",
  ],
  extensions: [
    "Domaines personnalisés pour des liens à votre marque.",
    "Codes QR pour chaque lien.",
    "Aperçus de liens et avertissements de sécurité.",
    "Tableaux de bord par utilisateur avec graphiques de clics.",
  ],
};
