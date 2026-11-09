import type { ContentTranslation } from "../translation";

/** French text for the component catalogue (src/content/components.ts), keyed by component id. */
export const frComponents: NonNullable<ContentTranslation["components"]> = {
  "web-client": {
    name: "Client web",
    what: "Navigateur ou application monopage qui appelle le backend en HTTPS et lit les médias depuis le CDN.",
  },
  "mobile-client": {
    name: "Application mobile",
    what: "Application native ou multiplateforme ; garde souvent une connexion persistante pour les mises à jour en temps réel et reçoit des notifications push.",
  },
  dns: {
    name: "DNS / routage géographique",
    what: "Résout les noms de domaine et dirige les utilisateurs vers la région saine la plus proche.",
    whenToUse: ["Déploiements multi-régions", "Bascule entre régions basée sur des contrôles de santé"],
    pitfalls: ["Les TTL retardent la bascule ; gardez-les courts pour les enregistrements critiques"],
    providers: { azure: [undefined, { note: "routage global basé sur le DNS" }] },
  },
  cdn: {
    name: "CDN",
    what: "Met en cache les ressources statiques et les médias dans des points de présence proches des utilisateurs, pour soulager l'origine.",
    whenToUse: ["Images, segments vidéo, JS/CSS", "Tuiles de carte et autres réponses d'API cachables"],
    pitfalls: [
      "L'invalidation du cache est lente et coûteuse ; versionnez plutôt les URL",
      "Les réponses personnalisées ne doivent pas être mises en cache publiquement",
    ],
    providers: { gcp: [undefined, { note: "conçu pour la vidéo à grande échelle" }] },
  },
  waf: {
    name: "WAF / protection DDoS",
    what: "Filtre le trafic malveillant (bots, injections, inondations) avant qu'il n'atteigne vos services.",
    whenToUse: ["Tout point d'entrée public", "Pages de connexion et de paiement"],
    pitfalls: ["Des règles trop agressives bloquent de vrais utilisateurs ; commencez en mode comptage/journalisation"],
  },
  "load-balancer": {
    name: "Répartiteur de charge",
    what: "Répartit les requêtes entre les instances saines et termine le TLS.",
    whenToUse: ["Devant chaque couche mise à l'échelle horizontalement"],
    pitfalls: [
      "Les sessions persistantes masquent les problèmes d'état ; gardez les services sans état",
      "Les WebSockets de longue durée nécessitent un équilibrage L4 ou conscient des connexions",
    ],
  },
  "api-gateway": {
    name: "Passerelle d'API",
    what: "Point d'entrée unique qui authentifie, limite le débit et route les appels d'API vers les services backend.",
    whenToUse: ["Backends en microservices", "API publiques nécessitant des clés, des quotas ou du versionnage"],
    pitfalls: ["Peut devenir un goulot d'étranglement ou un fourre-tout pour la logique métier"],
  },
  service: {
    name: "Service applicatif",
    what: "Service sans état, déployable indépendamment, propriétaire d'un domaine (utilisateurs, commandes, trajets…).",
    whenToUse: ["Logique métier principale", "Tout ce qui doit monter en charge horizontalement"],
    pitfalls: ["Trop de petits services multiplient les sauts réseau et la charge d'astreinte"],
  },
  serverless: {
    name: "Fonction serverless",
    what: "Code déclenché par des événements, qui descend à zéro instance ; facturé à l'invocation.",
    whenToUse: ["Tâches de fond irrégulières", "Liant entre services managés"],
    pitfalls: ["Démarrages à froid et limites de durée d'exécution", "Peu adapté aux traitements longs ou avec état"],
  },
  "realtime-gateway": {
    name: "Passerelle de connexions temps réel",
    what: "Maintient des connexions WebSocket de longue durée et pousse des événements (messages, positions, prix) vers les clients.",
    whenToUse: ["Messagerie instantanée", "Suivi en direct", "Cotations et tableaux de scores"],
    pitfalls: [
      "Nécessite un registre des connexions et un pub/sub entre nœuds",
      "Tempêtes de reconnexions après les déploiements",
    ],
    providers: { gcp: [{ note: "pas de service managé dédié" }] },
  },
  "media-transcoder": {
    name: "Transcodeur média",
    what: "Convertit les vidéos importées en plusieurs résolutions et en segments HLS/DASH.",
    whenToUse: ["Toute vidéo importée par les utilisateurs"],
    pitfalls: ["Gourmand en CPU/GPU ; à exécuter comme un pool de workers autoscalé alimenté par une file"],
    providers: { azure: [{ note: "Azure Media Services a été retiré en 2024" }] },
  },
  "object-storage": {
    name: "Stockage objet",
    what: "Stockage de blobs bon marché et durable pour les médias, documents, sauvegardes et fichiers de data lake.",
    whenToUse: ["Photos, vidéos, morceaux de fichiers, journaux"],
    pitfalls: [
      "Ce n'est pas une base de données : le listage et les petites mises à jour aléatoires sont lents",
      "Utilisez des URL pré-signées pour que les clients importent directement",
    ],
  },
  "relational-db": {
    name: "Base de données relationnelle",
    what: "Base SQL ACID pour les données transactionnelles : utilisateurs, commandes, paiements, réservations.",
    whenToUse: ["Argent et stocks", "Données avec des relations et un besoin de cohérence forte"],
    pitfalls: ["Monter en charge en écriture demande du sharding ou un moteur SQL distribué"],
    providers: { gcp: [undefined, undefined, { note: "SQL distribué à l'échelle mondiale" }] },
  },
  "nosql-db": {
    name: "Base clé-valeur / documents",
    what: "Base qui monte en charge horizontalement pour de gros volumes de lectures par clé.",
    whenToUse: [
      "Sessions, paniers, métadonnées, profils",
      "Lectures prévisibles en quelques millisecondes à n'importe quelle échelle",
    ],
    pitfalls: ["Modélisez dès le départ autour des schémas d'accès ; les requêtes ad hoc sont difficiles"],
  },
  "wide-column-db": {
    name: "Base orientée colonnes larges",
    what: "Base partitionnée optimisée pour l'écriture, pour d'énormes jeux de données surtout en ajout.",
    whenToUse: ["Messages, fils d'actualité, historiques de visionnage, événements ordonnés dans le temps"],
    pitfalls: ["Le choix de la clé de partition décide de tout ; les partitions chaudes font mal"],
  },
  cache: {
    name: "Cache en mémoire",
    what: "Stockage clé-valeur en moins d'une milliseconde pour les données chaudes, compteurs, sessions, verrous et index géographiques.",
    whenToUse: [
      "Cache-aside devant les bases de données",
      "Compteurs de limitation de débit, classements, réservations temporaires de places",
    ],
    pitfalls: [
      "Ruées (stampedes) à l'expiration",
      "Considérez-le comme pouvant perdre des données, sauf si la persistance est configurée",
    ],
    providers: { aws: [undefined, { note: "durable" }] },
  },
  search: {
    name: "Moteur de recherche",
    what: "Index inversé pour la recherche plein texte, à facettes et géographique.",
    whenToUse: ["Recherche de produits, d'annonces, de vidéos ou d'utilisateurs", "Autocomplétion"],
    pitfalls: [
      "Cohérence à terme avec la source de vérité ; alimentez-le par des événements ou du CDC",
    ],
  },
  "graph-db": {
    name: "Base de données graphe",
    what: "Stocke des entités et leurs relations pour des requêtes de parcours.",
    whenToUse: ["Graphes sociaux, recommandations, réseaux de fraude"],
    pitfalls: [
      "Difficile à sharder ; beaucoup d'équipes gardent plutôt des listes d'adjacence dans des bases clé-valeur",
    ],
  },
  "time-series-db": {
    name: "Base de séries temporelles",
    what: "Optimisée pour les métriques horodatées et les données de capteurs, avec sous-échantillonnage.",
    whenToUse: ["Historique de positions, télémétrie IoT, cotations de marché"],
    pitfalls: ["Les étiquettes à forte cardinalité font exploser le stockage"],
  },
  "vector-db": {
    name: "Base vectorielle",
    what: "Recherche par similarité sur des embeddings.",
    whenToUse: ["Recherche sémantique, recommandations, RAG"],
    pitfalls: ["Reconstruire l'index coûte cher ; anticipez les changements de modèle d'embedding"],
  },
  "message-queue": {
    name: "File de messages",
    what: "Met des tâches en attente pour des workers ; chaque message est traité une fois puis supprimé.",
    whenToUse: ["Tâches de fond, notifications, demandes de transcodage"],
    pitfalls: ["Ajoutez des files de lettres mortes et des consommateurs idempotents"],
    providers: { aws: [undefined, { note: "diffusion (fan-out)" }] },
  },
  "event-stream": {
    name: "Streaming d'événements",
    what: "Journal partitionné, durable et rejouable, que de nombreux consommateurs lisent indépendamment.",
    whenToUse: ["Microservices pilotés par les événements", "Pipelines analytiques, CDC, fils d'activité"],
    pitfalls: ["L'ordre n'est garanti que par partition", "Le retard des consommateurs doit être surveillé"],
  },
  "stream-processor": {
    name: "Traitement de flux",
    what: "Exécute des calculs continus (fenêtres, jointures, agrégations) sur des flux d'événements.",
    whenToUse: ["Tarification dynamique, signaux de fraude, tendances, tableaux de bord en direct"],
    pitfalls: ["L'état et la sémantique « exactement une fois » ajoutent de la complexité opérationnelle"],
  },
  workflow: {
    name: "Orchestrateur de workflows",
    what: "Coordonne des processus longs en plusieurs étapes, avec reprises et compensations.",
    whenToUse: ["Sagas entre paiement, stock et expédition", "Pipelines de données planifiés"],
    pitfalls: ["Gardez les étapes du workflow idempotentes"],
    providers: { aws: [undefined, { note: "Airflow managé" }] },
  },
  notifications: {
    name: "Push / SMS / e-mail",
    what: "Délivre des notifications sur les appareils et dans les boîtes de réception quand les utilisateurs sont hors ligne.",
    whenToUse: ["Suivi de commande, codes à usage unique, alertes de nouveaux messages"],
    pitfalls: ["Respectez les préférences des utilisateurs et les limites de débit des fournisseurs"],
    providers: { aws: [undefined, { note: "e-mail" }], oss: [undefined, { note: "e-mail" }] },
  },
  "data-warehouse": {
    name: "Entrepôt de données / OLAP",
    what: "Stockage en colonnes pour des requêtes analytiques sur de gros historiques de données.",
    whenToUse: ["Reporting métier, expérimentation, génération de features hors ligne"],
    pitfalls: ["Pas fait pour des lectures à faible latence côté utilisateur"],
  },
  "batch-processing": {
    name: "Traitement par lots",
    what: "Tâches hors ligne à grande échelle sur les fichiers du data lake.",
    whenToUse: ["Construire des tries de recherche, des features de recommandation, des rapports"],
  },
  "ml-platform": {
    name: "ML / recommandations",
    what: "Entraîne et sert des modèles de classement, de recommandation, d'ETA et de détection de fraude.",
    whenToUse: ["Fils personnalisés", "Tarification, prédiction d'ETA, évaluation du risque"],
    pitfalls: ["Écart de features entre l'entraînement et la production"],
    providers: { oss: [undefined, undefined, { note: "feature store" }] },
  },
  maps: {
    name: "Cartographie et géospatial",
    what: "Géocodage, calcul d'itinéraires, ETA et tuiles de carte.",
    whenToUse: ["VTC, livraison, logistique"],
    pitfalls: ["La tarification à la requête coûte cher à grande échelle ; mettez en cache de façon agressive"],
    providers: { oss: [undefined, undefined, { note: "index géographique hexagonal" }] },
  },
  identity: {
    name: "Identité et authentification",
    what: "Inscription, connexion, jetons (OAuth/OIDC, JWT) et annuaires d'utilisateurs.",
    whenToUse: ["Tout système destiné à des utilisateurs"],
    pitfalls: ["Ne développez pas votre propre cryptographie ni votre stockage de mots de passe"],
  },
  secrets: {
    name: "Secrets et clés",
    what: "Stocke les identifiants et les clés de chiffrement ; gère leur rotation.",
  },
  coordination: {
    name: "Coordination / configuration",
    what: "Stockage cohérent pour l'élection de leader, la découverte de services, les cartes de shards et la configuration dynamique.",
    whenToUse: [
      "Attribution des shards d'un crawler ou d'une autocomplétion",
      "Distribution des règles de limitation de débit",
    ],
  },
  observability: {
    name: "Observabilité",
    what: "Métriques, journaux, traces et alertes pour tous les services.",
    whenToUse: ["Toujours"],
    pitfalls: ["Le volume de journaux coûte cher ; échantillonnez les traces et fixez une durée de rétention"],
  },
  payments: {
    name: "Prestataire de paiement",
    what: "Traitement des cartes, portefeuilles et virements ; généralement un tiers placé derrière votre propre service de paiement et votre grand livre.",
    whenToUse: ["Passage en caisse, versements, abonnements"],
    pitfalls: ["Utilisez des clés d'idempotence ; rapprochez avec les rapports du prestataire"],
  },
  "partner-api": {
    name: "Système partenaire externe",
    what: "Un système géré par quelqu'un d'autre et auquel vous vous intégrez : inventaires des compagnies aériennes et des hôtels, bourses, bureaux de crédit, billetteries de cinéma.",
    whenToUse: ["Stocks ou données qui ne vous appartiennent pas", "Réseaux réglementés auxquels vous devez vous connecter"],
    pitfalls: [
      "Lent, limité en débit et parfois indisponible — mettez en cache ce que vous pouvez et entourez les appels de timeouts et de disjoncteurs",
    ],
    thirdParty: [{ note: "distribution voyage (GDS)" }],
  },
  "webrtc-media": {
    name: "Serveur média WebRTC / TURN",
    what: "Relaie et achemine l'audio et la vidéo en direct : les serveurs TURN font passer les appels à travers les pare-feu et un SFU transmet les flux dans les appels de groupe.",
    whenToUse: ["Téléconsultations vidéo, appels vocaux, cours en direct"],
    pitfalls: [
      "Gourmand en bande passante et sensible à la latence — déployez près des utilisateurs",
      "L'enregistrement nécessite un pipeline séparé",
    ],
    providers: { gcp: [{ note: "pas de service managé dédié" }], oss: [undefined, { note: "STUN/TURN" }] },
  },
};
