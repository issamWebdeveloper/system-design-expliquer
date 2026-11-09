import type { ContentTranslation } from "../translation";
import { diagram } from "./helpers";

/** French text for the concepts (src/content/concepts.ts and conceptDiagrams.ts), keyed by slug. */
export const frConcepts: NonNullable<ContentTranslation["concepts"]> = {
  "adaptive-bitrate-streaming": {
    name: "Streaming à débit adaptatif",
    summary:
      "Encoder la vidéo en plusieurs qualités et en petits segments pour que le lecteur change de qualité selon la bande passante.",
    explanation: [
      "Les vidéos sont transcodées en plusieurs versions (240p–4K) et découpées en segments de 2 à 10 secondes listés dans un manifeste (HLS ou DASH). Le lecteur mesure le débit et choisit la meilleure qualité pour le segment suivant, ce qui évite la mise en mémoire tampon.",
    ],
    howItWorks: [
      "Transcoder en morceaux parallèles ; stocker les segments dans un stockage objet.",
      "Servir manifestes et segments depuis un CDN.",
      "L'encodage par titre ajuste les débits à la complexité du contenu.",
    ],
    tradeoffs: ["Multiplier les versions multiplie le coût de stockage et d'encodage."],
    diagram: diagram(
      {
        upload: ["Fichier original", "Un seul fichier de haute qualité"],
        transcoder: ["Transcodeur", "Produit une échelle de qualités"],
        renditions: ["Versions", "240p … 4K, découpées en segments de 4 s"],
        cdn: ["CDN", "Met en cache le manifeste et les segments"],
        player: ["Lecteur", "Mesure la bande passante, choisit la qualité de chaque segment"],
      },
      { "transcoder-renditions": "HLS/DASH", "cdn-renditions": "Origine", "player-cdn": "Manifeste + segments" },
      {
        play: [
          "Regarder dans le train",
          "Après l'import, la vidéo est encodée à plusieurs débits.",
          "Chaque version est découpée en segments courts listés dans un manifeste.",
          "Le lecteur charge le manifeste et démarre en 720p depuis le point de présence le plus proche.",
          "Les segments qui ne sont pas encore en périphérie sont récupérés une fois depuis l'origine.",
          "Le train entre dans un tunnel ; le débit chute, donc les segments suivants viennent de la version 360p — pas de mise en mémoire tampon, juste une qualité plus basse jusqu'au retour du signal.",
        ],
      },
    ),
  },
  authentication: {
    name: "Authentification et jetons",
    summary:
      "Vérifier une fois l'identité d'un utilisateur, puis lui donner un jeton que chaque service peut contrôler à moindre coût.",
    explanation: [
      "Les utilisateurs se connectent avec un mot de passe, un compte social ou un code à usage unique. Le service d'identité émet un jeton signé de courte durée (souvent un JWT) et un jeton de rafraîchissement. La passerelle vérifie la signature à chaque requête sans consulter de base de données.",
    ],
    howItWorks: [
      "OAuth 2.0 / OpenID Connect pour les parcours de connexion et l'accès des tiers.",
      "Des jetons d'accès de courte durée et des jetons de rafraîchissement limitent les dégâts en cas de fuite.",
      "Les services autorisent à partir des informations du jeton (id utilisateur, rôles, offre).",
    ],
    tradeoffs: [
      "Révoquer un jeton sans état avant son expiration nécessite une liste de refus.",
      "Ne stockez jamais vous-même de mots de passe sans un schéma de hachage éprouvé — préférez un fournisseur d'identité managé.",
    ],
    diagram: diagram(
      {
        browser: ["Navigateur", "L'utilisateur qui se connecte"],
        app: ["Votre application", "Lance la connexion, échange le code"],
        idp: ["Fournisseur d'identité", "Vérifie les identifiants, émet les jetons"],
        gateway: ["Passerelle d'API", "Vérifie la signature des jetons"],
        api: ["API", "Fait confiance aux informations du jeton"],
      },
      {
        "browser-app": "Connexion",
        "browser-idp": "Redirection + mot de passe",
        "app-idp": "Code → jetons",
        "browser-gw": "Jeton Bearer",
        "gw-api": "Informations vérifiées",
      },
      {
        oidc: [
          "Connexion (OIDC)",
          "L'utilisateur clique sur « Se connecter ».",
          "Il est redirigé vers le fournisseur d'identité et saisit son mot de passe (l'application ne le voit jamais).",
          "Le fournisseur redirige avec un code à usage unique ; le serveur de l'application l'échange contre un jeton d'identité, un jeton d'accès de courte durée et un jeton de rafraîchissement.",
          "Les appels d'API portent le jeton d'accès (un JWT signé).",
          "La passerelle vérifie la signature et l'expiration avec la clé publique du fournisseur — sans base de données — et transmet l'id et les rôles de l'utilisateur.",
        ],
      },
    ),
  },
  "back-pressure": {
    name: "Contre-pression et files d'attente",
    summary: "Quand les producteurs vont plus vite que les consommateurs, mettre en tampon et ralentir plutôt que tomber.",
    explanation: [
      "Les pics (un import viral, une vente flash) arrivent plus vite que les workers ne peuvent traiter. Une file absorbe la rafale : le coût est un délai, pas une panne, et elle signale à l'amont de ralentir quand elle devient trop longue.",
    ],
    howItWorks: [
      "Une file entre le chemin de la requête et le travail lourd (transcodage, e-mails, diffusion).",
      "Autoscaler les consommateurs selon la profondeur de la file.",
      "Des files de lettres mortes pour les messages qui échouent sans cesse.",
      "Refuser ou délester la charge peu prioritaire quand les files sont pleines.",
    ],
    tradeoffs: ["Les utilisateurs voient des délais pendant les pics ; les files doivent être surveillées."],
    diagram: diagram(
      {
        api: ["API", "Accepte les imports rapidement"],
        queue: ["File de tâches", "Absorbe les rafales"],
        workers: ["Workers", "Traitent à leur rythme"],
        dlq: ["File de lettres mortes", "Messages qui échouent sans cesse"],
        autoscale: ["Autoscaler", "Dimensionne selon la profondeur de la file"],
      },
      { "api-queue": "Mise en file", "workers-dlq": "Après 5 échecs", "autoscale-workers": "Ajout de workers" },
      {
        spike: [
          "Pic de trafic",
          "Un moment viral apporte 10× plus d'imports que d'habitude ; l'API se contente de mettre les tâches en file et répond « accepté ».",
          "Les workers continuent de consommer à rythme constant ; c'est la file qui grossit, au lieu que le système tombe.",
          "La profondeur de la file dépasse un seuil : des workers sont ajoutés jusqu'à résorber l'arriéré.",
        ],
        poison: [
          "Message empoisonné",
          "Une tâche fait planter un worker à chaque tentative.",
          "Après 5 essais, elle part dans la file de lettres mortes : elle ne bloque plus le reste et peut être inspectée.",
        ],
      },
    ),
  },
  "bloom-filter": {
    name: "Filtres de Bloom",
    summary:
      "Un minuscule ensemble probabiliste qui répond « forcément jamais vu » ou « probablement déjà vu » avec quelques bits par élément.",
    explanation: [
      "Vérifier des milliards d'éléments (URL déjà visitées par un crawler, noms d'utilisateur pris) dans une base de données est lent. Un filtre de Bloom hache chaque élément vers quelques positions de bits ; si l'un des bits n'est pas activé, l'élément n'a jamais été ajouté. Les faux positifs sont possibles, les faux négatifs non.",
    ],
    howItWorks: [
      "k fonctions de hachage activent k bits par élément inséré.",
      "Une recherche vérifie les mêmes k bits ; s'ils sont tous activés, l'élément est « probablement présent ».",
      "Dimensionnez le tableau de bits selon le nombre d'éléments attendu et le taux de faux positifs acceptable (~10 bits par élément ≈ 1 %).",
    ],
    tradeoffs: [
      "Impossible de supprimer des éléments (utilisez des filtres de Bloom à compteurs) et ne donne jamais de « oui » certain.",
    ],
    diagram: diagram(
      {
        parser: ["Extracteur de liens", "Trouve 50 liens par page"],
        bloom: ["Filtre de Bloom", "En mémoire, ~10 bits par URL"],
        db: ["Stockage des URL", "Trace exacte de chaque URL"],
        frontier: ["Frontière d'URL", "Pages restant à explorer"],
      },
      { "parser-bloom": "Déjà vu ?", "parser-db": "Seulement si « peut-être »", "parser-frontier": "Nouvelle URL" },
      {
        check: [
          "Vérifier un lien",
          "Pour chaque lien, le filtre est consulté d'abord. La réponse la plus courante est « forcément jamais vu » — aucun appel à la base.",
          "Ces liens vont directement dans la frontière.",
          "Seules les réponses « peut-être déjà vu » (dont ~1 % de faux positifs) sont confirmées dans le stockage exact.",
        ],
      },
    ),
  },
  caching: {
    name: "Mise en cache",
    summary:
      "Garder des copies des données souvent lues en mémoire rapide pour que la plupart des requêtes n'atteignent jamais la base de données.",
    explanation: [
      "La plupart des grands systèmes sont dominés par la lecture, et une petite fraction des données reçoit l'essentiel des lectures. Placer ces données chaudes dans un stockage en mémoire (ou en périphérie d'un CDN) fait passer la latence des millisecondes aux microsecondes et protège la base de données.",
      "Le plus difficile est de décider quoi mettre en cache, combien de temps, et que faire quand les données sous-jacentes changent.",
    ],
    howItWorks: [
      "Cache-aside : lire le cache ; en cas d'absence, lire la base et remplir le cache. Le schéma le plus courant.",
      "Write-through : écrire dans le cache et la base en même temps pour que le cache soit toujours à jour.",
      "Write-back : écrire dans le cache et reporter l'écriture en base plus tard — rapide mais risque de perte.",
      "L'éviction (LRU/LFU) et les TTL bornent la mémoire ; des clés versionnées évitent l'invalidation explicite.",
    ],
    tradeoffs: [
      "Lectures périmées jusqu'à l'expiration du TTL ou l'invalidation de la clé.",
      "Ruée sur le cache quand une clé chaude expire — utilisez la fusion des requêtes ou un rafraîchissement anticipé.",
      "Un système de plus à exploiter, surveiller et dimensionner.",
    ],
    diagram: diagram(
      {
        app: ["Application", "Demande le produit 42"],
        svc: ["Service produits", "Applique le cache-aside"],
        cache: ["Cache", "Produits populaires, TTL de 5 minutes"],
        db: ["Base de données", "Source de vérité"],
      },
      { "app-svc": "GET /products/42", "svc-cache": "get / set / delete", "svc-db": "lecture / écriture" },
      {
        hit: [
          "Succès de cache",
          "L'application demande le produit 42.",
          "Le service cherche product:42 dans le cache — il y est, la réponse part en moins d'une milliseconde. La base de données n'est jamais sollicitée.",
        ],
        miss: [
          "Défaut de cache",
          "L'application demande un produit que personne n'a consulté récemment.",
          "La recherche dans le cache échoue.",
          "Le service lit la ligne en base (quelques millisecondes).",
          "Il stocke le résultat dans le cache avec un TTL : le lecteur suivant aura un succès.",
        ],
        write: [
          "Mise à jour (invalidation)",
          "Un administrateur change le prix du produit.",
          "Le service écrit d'abord le nouveau prix en base.",
          "Puis il supprime product:42 du cache ; la lecture suivante le remplit avec des données fraîches.",
        ],
      },
    ),
  },
  "change-data-capture": {
    name: "Capture des changements (CDC)",
    summary:
      "Diffuser chaque modification de la base comme un événement pour que les autres systèmes restent synchronisés sans double écriture.",
    explanation: [
      "Écrire dans une base puis, séparément, dans un index de recherche ou un cache peut les rendre incohérents si l'une des écritures échoue. Le CDC suit le journal des modifications de la base et publie chaque insertion, mise à jour et suppression, pour que les copies en aval suivent la source de vérité.",
    ],
    howItWorks: [
      "Des outils lisent le journal d'écriture anticipée (WAL) ou le binlog et publient dans un flux d'événements.",
      "Des consommateurs mettent à jour index de recherche, caches et entrepôts de données.",
    ],
    tradeoffs: [
      "Les copies en aval sont cohérentes à terme.",
      "Les changements de schéma doivent être coordonnés avec les consommateurs.",
    ],
    diagram: diagram(
      {
        app: ["Application", "N'écrit que dans la base"],
        db: ["Base de données", "Le journal d'écriture enregistre chaque changement"],
        connector: ["Connecteur CDC", "Suit le journal"],
        stream: ["Événements de changement", "Un par ligne modifiée"],
        search: ["Index de recherche", "Reste synchronisé"],
        cache: ["Invalidateur de cache", "Évince les clés périmées"],
        warehouse: ["Entrepôt", "Copie analytique"],
      },
      { "db-connector": "Lecture du journal" },
      {
        sync: [
          "Une écriture, toutes les copies à jour",
          "L'application met à jour un prix dans la base — et rien d'autre. Pas de double écriture risquée.",
          "Le connecteur lit le changement dans le propre journal de la base.",
          "Il publie un événement de changement avec les valeurs avant et après.",
          "L'index de recherche se met à jour…",
          "…le cache évince l'ancienne valeur…",
          "…et l'analytique reçoit l'historique. Si un consommateur est arrêté, il rattrape son retard depuis le flux.",
        ],
      },
    ),
  },
  "consistent-hashing": {
    name: "Hachage cohérent",
    summary:
      "Placer les clés sur un anneau de hachage pour qu'ajouter ou retirer un serveur ne déplace qu'une petite partie des clés.",
    explanation: [
      "Avec un simple hash mod N, changer N redistribue presque toutes les clés — un désastre pour les caches et le routage des connexions. Le hachage cohérent place serveurs et clés sur le même anneau ; chaque clé appartient au serveur suivant dans le sens horaire, donc un changement n'affecte que les voisins.",
    ],
    howItWorks: [
      "Chaque serveur reçoit de nombreux nœuds virtuels sur l'anneau pour équilibrer la charge.",
      "Utilisé pour les clusters de cache, les bases orientées colonnes larges, le routage des sessions WebSocket et les compteurs de limitation de débit.",
    ],
    tradeoffs: [
      "La réplication reste nécessaire pour la disponibilité ; les clés d'un nœud perdu doivent être reconstruites ou lues sur des réplicas.",
    ],
    diagram: diagram(
      {
        client: ["Bibliothèque cliente", "Place chaque clé sur l'anneau"],
        a: ["Nœud A", "Possède l'arc qui le précède"],
        b: ["Nœud B", "Possède l'arc qui le précède"],
        c: ["Nœud C", "Possède l'arc qui le précède"],
      },
      {},
      {
        route: [
          "Router une clé",
          "hash('user:42') tombe juste avant le nœud B sur l'anneau : B la possède.",
          "Si B tombe en panne, seules les clés de B bougent — vers le nœud suivant dans le sens horaire, C. Les clés de A ne bougent pas du tout.",
        ],
      },
    ),
  },
  "distributed-locks": {
    name: "Verrous distribués et réservations temporaires",
    summary:
      "Empêcher deux processus de prendre la même chose en même temps — une place, un chauffeur, un créneau.",
    explanation: [
      "Les réservations et l'attribution des courses nécessitent une exclusivité entre de nombreux serveurs. Un verrou ou une réservation de courte durée dans un stockage partagé marque un élément comme pris pendant que le reste du processus se termine.",
    ],
    howItWorks: [
      "Créer une clé seulement si elle est absente, avec un TTL (SET NX EX), pour que les détenteurs qui plantent la libèrent automatiquement.",
      "Ou utiliser des verrous de ligne en base / des mises à jour conditionnelles (disponible ≥ quantité).",
      "Des jetons de clôture (fencing tokens) empêchent un détenteur périmé d'agir après l'expiration de son verrou.",
    ],
    tradeoffs: [
      "Les problèmes d'horloge et de réseau rendent imparfaits les verrous en cache ; les chemins critiques impliquant de l'argent doivent s'appuyer sur les contraintes de la base de données.",
    ],
    diagram: diagram(
      {
        a: ["Serveur A", "Veut la place 12A"],
        b: ["Serveur B", "Veut aussi la place 12A"],
        locks: ["Stockage des verrous", "lock:seat:12A avec un TTL"],
        db: ["Base des réservations", "Vérifie le jeton de clôture"],
      },
      {
        "a-lock": "SET NX EX 30",
        "b-lock": "SET NX EX 30",
        "a-db": "Écriture avec le jeton 33",
        "b-db": "Écriture avec le jeton 34",
      },
      {
        contend: [
          "Deux serveurs, une place",
          "Le serveur A crée lock:seat:12A seulement s'il n'existe pas — il réussit et obtient le jeton de clôture 33.",
          "Le serveur B tente la même chose un instant plus tard et échoue : il indique à son utilisateur que la place est prise.",
          "A termine la réservation en présentant le jeton 33, puis supprime le verrou.",
        ],
        crash: [
          "Le détenteur plante",
          "Le serveur A prend le verrou (jeton 33) puis se fige dans une longue pause.",
          "Au bout de 30 s le verrou expire ; B le prend avec le jeton 34 et réserve la place.",
          "L'écriture de B est enregistrée avec le jeton 34.",
          "A se réveille et tente d'écrire avec le jeton 33 — la base refuse car elle a déjà vu 34. C'est exactement ce qu'empêchent les jetons de clôture.",
        ],
      },
    ),
  },
  ledger: {
    name: "Grand livre en partie double",
    summary:
      "Enregistrer chaque mouvement d'argent en débits et crédits équilibrés pour que l'argent ne puisse jamais apparaître ni disparaître.",
    explanation: [
      "Au lieu de mettre à jour une colonne de solde, les systèmes de paiement ajoutent des écritures : débiter un compte, en créditer un autre, pour une somme nulle. Les soldes sont dérivés des écritures, et l'historique complet sert de piste d'audit.",
    ],
    howItWorks: [
      "Les écritures sont en ajout seul ; les erreurs se corrigent par de nouvelles écritures d'extourne.",
      "Des instantanés périodiques des soldes gardent les lectures rapides.",
      "Le rapprochement compare le grand livre aux fichiers de règlement bancaire.",
    ],
    tradeoffs: ["Plus de lignes et une discipline plus stricte qu'un simple champ de solde."],
    diagram: diagram(
      {
        payments: ["Service de paiement", "Émet un événement « capturé »"],
        events: ["Événements de paiement", "Ordonnés par paiement"],
        "ledger-svc": ["Service grand livre", "Transforme les événements en écritures équilibrées"],
        ledger: ["Grand livre", "Journal en ajout seul"],
        bank: ["Règlement bancaire", "Ce qui a réellement bougé"],
        recon: ["Rapprochement", "Compare les deux chaque nuit"],
      },
      { "ledger-write": "Débit = crédit", "bank-recon": "Fichier de règlement", "recon-ledger": "Correspondance" },
      {
        post: [
          "Comptabiliser et rapprocher",
          "Un paiement par carte de 100 $ est capturé.",
          "Le service grand livre consomme l'événement (dédupliqué par id de paiement).",
          "Il ajoute des écritures dont la somme est nulle : débit de 100 $ sur le compte de compensation carte, crédit de 97 $ au marchand et de 3 $ en revenus de commission.",
          "Pendant la nuit, la banque envoie ce qui a réellement été réglé.",
          "Chaque ligne est rapprochée des écritures du grand livre ; tout ce qui ne correspond pas est signalé à un humain.",
        ],
      },
    ),
  },
  "event-driven": {
    name: "Architecture pilotée par les événements",
    summary: "Les services publient des événements sur ce qui s'est passé ; d'autres y réagissent de façon asynchrone.",
    explanation: [
      "Au lieu que le service de commandes appelle directement l'expédition, l'e-mail et l'analytique, il publie « commande passée » dans un journal durable. Chaque consommateur lit à son rythme : le producteur reste rapide et on peut ajouter des consommateurs sans le modifier.",
    ],
    howItWorks: [
      "Un journal partitionné et rejouable (façon Kafka) garde les événements dans l'ordre par clé.",
      "Les consommateurs suivent leurs propres positions (offsets) et peuvent rejouer l'historique pour reconstruire leur état.",
      "Utilisez une table outbox pour qu'une écriture en base et son événement soient publiés ensemble.",
    ],
    tradeoffs: [
      "Cohérence à terme : les consommateurs sont en retard sur le producteur.",
      "Le débogage traverse de nombreux services ; il faut un bon traçage.",
      "Les consommateurs doivent être idempotents, car un événement peut être livré plusieurs fois.",
    ],
    diagram: diagram(
      {
        orders: ["Service de commandes", "Producteur"],
        log: ["Journal d'événements", "Durable, ordonné, rejouable"],
        email: ["Service e-mail", "Groupe de consommateurs 1"],
        search: ["Indexeur de recherche", "Groupe de consommateurs 2"],
        analytics: ["Analytique", "Groupe de consommateurs 3"],
      },
      { "orders-log": "OrderPlaced" },
      {
        publish: [
          "Un événement, plusieurs lecteurs",
          "Le service de commandes ajoute OrderPlaced au journal et passe à la suite — il n'attend personne.",
          "Le service e-mail le lit et envoie une confirmation.",
          "L'indexeur de recherche lit le même événement à son rythme.",
          "L'analytique était arrêtée depuis une heure ; au redémarrage, elle reprend à sa position enregistrée et rattrape son retard — rien n'est perdu.",
        ],
      },
    ),
  },
  "fan-out": {
    name: "Fan-out (fils en push ou en pull)",
    summary:
      "Livrer un élément à de nombreux destinataires — soit copié à l'écriture, soit rassemblé à la lecture.",
    explanation: [
      "Les fils (Instagram, Twitter, notifications) ont un choix à faire. Le fan-out à l'écriture copie un nouveau post dans le fil de chaque abonné, pour des lectures instantanées. Le fan-out à la lecture rassemble les posts de tous vos abonnements quand vous ouvrez le fil.",
      "La plupart des vrais systèmes sont hybrides : push pour les comptes normaux, pull pour les célébrités aux millions d'abonnés.",
    ],
    howItWorks: [
      "Écriture : événement → workers de diffusion → ajout du postId à la liste en cache de chaque abonné.",
      "Lecture : récupérer la liste en cache, y fusionner les posts récents des célébrités, classer, compléter.",
    ],
    tradeoffs: [
      "Push : énorme amplification des écritures pour les comptes populaires, travail gaspillé pour les utilisateurs inactifs.",
      "Pull : lectures lentes qui touchent de nombreuses sources.",
    ],
    diagram: diagram(
      {
        author: ["Auteur", "Publie quelque chose"],
        posts: ["Service des posts", "Stocke le post"],
        events: ["Événements nouveau post", "Un par post"],
        fanout: ["Workers de diffusion", "Copient les id de posts dans les fils des abonnés"],
        feeds: ["Cache des fils", "Une liste par abonné"],
        reader: ["Abonné", "Ouvre son fil"],
        "feed-svc": ["Service des fils", "Lit la liste, fusionne les célébrités"],
        "posts-db": ["Stockage des posts", "Tous les posts, par auteur"],
      },
      { "fanout-feeds": "Push", "feed-cache": "Lecture de la liste", "feed-posts": "Pull des posts de célébrités" },
      {
        push: [
          "Push (fan-out à l'écriture)",
          "Un utilisateur ordinaire avec 300 abonnés publie.",
          "Le post est stocké une seule fois.",
          "Un événement « nouveau post » est publié.",
          "Les workers de diffusion le récupèrent.",
          "Ils ajoutent l'id du post en tête des 300 fils d'abonnés — 300 écritures bon marché maintenant, pour que chaque lecture soit instantanée ensuite.",
        ],
        pull: [
          "Pull (fan-out à la lecture)",
          "Un abonné ouvre son fil.",
          "Sa liste préconstruite contient les posts des comptes ordinaires.",
          "Les posts des célébrités qu'il suit (des millions d'abonnés, donc jamais poussés) sont récupérés maintenant et fusionnés.",
        ],
      },
    ),
  },
  "geospatial-indexing": {
    name: "Indexation géospatiale",
    summary: "Ranger les positions dans des cellules pour que « qu'y a-t-il près de moi ? » devienne une recherche rapide.",
    explanation: [
      "Les VTC et la livraison ont besoin instantanément des chauffeurs ou restaurants proches. La carte est divisée en cellules (Geohash, S2, H3) ; chaque position est rangée sous sa cellule, et une recherche de proximité lit la cellule et ses voisines.",
    ],
    howItWorks: [
      "Positions en direct en mémoire, indexées par cellule ; mises à jour toutes les quelques secondes.",
      "Des cellules plus petites dans les villes denses, plus grandes ailleurs.",
      "Classer les candidats par ETA routier, pas par distance à vol d'oiseau.",
    ],
    tradeoffs: [
      "À cause des frontières entre cellules, il faut aussi chercher dans les cellules voisines.",
      "Les cellules chaudes des zones animées nécessitent des shards supplémentaires.",
    ],
    diagram: diagram(
      {
        driver: ["Appli chauffeur", "Envoie le GPS toutes les 4 s"],
        location: ["Service de localisation", "Déplace les chauffeurs entre cellules"],
        geo: ["Index géographique", "id de cellule → chauffeurs"],
        rider: ["Appli passager", "Demande une course"],
        matching: ["Appariement", "Cherche dans la cellule du passager et ses voisines"],
      },
      { "location-geo": "Mise à jour de cellule", "matching-geo": "Cellules voisines" },
      {
        match: [
          "Trouver les chauffeurs proches",
          "La position d'un chauffeur arrive.",
          "Son id passe dans la cellule qui couvre cette position.",
          "Un passager demande une course.",
          "L'appariement lit la cellule du passager et ses 8 voisines — quelques lectures au lieu de parcourir tous les chauffeurs de la ville.",
        ],
      },
    ),
  },
  "horizontal-scaling": {
    name: "Montée en charge horizontale",
    summary: "Absorber plus de charge en ajoutant des machines plutôt qu'en les agrandissant.",
    explanation: [
      "Les services sans état peuvent être dupliqués librement derrière un répartiteur de charge : n'importe quelle instance peut servir n'importe quelle requête, car l'état vit dans des bases et des caches partagés. L'autoscaling ajoute ou retire des instances selon le trafic.",
    ],
    howItWorks: [
      "Garder les services sans état ; stocker les sessions dans un cache ou dans des jetons.",
      "Placer un répartiteur de charge devant et autoscaler selon le CPU, la latence ou la profondeur des files.",
      "Les couches avec état (bases de données) montent plutôt en charge par sharding et réplication.",
    ],
    tradeoffs: [
      "Plus d'instances, c'est plus d'appels réseau et plus de pièces à observer.",
      "Les composants avec état (connexions, bases) ne montent pas en charge aussi simplement.",
    ],
    diagram: diagram(
      {
        users: ["Utilisateurs", "Le trafic augmente au fil de la journée"],
        lb: ["Répartiteur de charge", "Répartit les requêtes entre les instances saines"],
        i1: ["Instance 1", "Sans état"],
        i2: ["Instance 2", "Sans état"],
        i3: ["Instance 3 (nouvelle)", "Ajoutée par l'autoscaler"],
        cache: ["Cache de sessions", "L'état partagé vit hors des instances"],
        metrics: ["Métriques et autoscaler", "Surveille le CPU et la latence"],
      },
      { "metrics-i3": "Lancement" },
      {
        "scale-out": [
          "Monter en charge",
          "Le trafic double à l'heure du déjeuner.",
          "Les requêtes se répartissent sur les instances existantes…",
          "…jusqu'à ce que le CPU moyen dépasse la cible.",
          "L'autoscaler lance une autre instance identique.",
          "Une fois saine, le répartiteur de charge commence à lui envoyer du trafic.",
          "Comme les sessions vivent dans le cache partagé, n'importe quelle instance peut servir n'importe quel utilisateur.",
        ],
      },
    ),
  },
  idempotency: {
    name: "Idempotence",
    summary: "Rendre une opération sûre à répéter, pour que les nouvelles tentatives ne produisent jamais d'effet double.",
    explanation: [
      "Le réseau peut tomber après le traitement d'une requête mais avant l'arrivée de la réponse. Le client réessaie — et sans protection, un paiement est débité deux fois ou une commande créée deux fois.",
    ],
    howItWorks: [
      "Les clients envoient une clé d'idempotence ; le serveur stocke clé → résultat et renvoie le résultat enregistré en cas de répétition.",
      "Des contraintes d'unicité (par ex. un seul « j'aime » par utilisateur et par post) rendent les écritures naturellement idempotentes.",
      "Les consommateurs d'événements dédupliquent par id d'événement ou d'entité.",
    ],
    tradeoffs: ["Les clés doivent être stockées (avec expiration) et vérifiées de façon atomique."],
    diagram: diagram(
      {
        client: ["Client", "Réessaie en cas de timeout"],
        api: ["API de paiement", "Vérifie d'abord la clé d'idempotence"],
        keys: ["Stockage d'idempotence", "clé → réponse enregistrée"],
        psp: ["Réseau de cartes", "Déplace réellement l'argent"],
      },
      { "client-api": "POST /charges + Idempotency-Key", "api-keys": "Clé déjà vue ?", "api-psp": "Débit" },
      {
        first: [
          "Première tentative",
          "Le client envoie un débit avec la clé abc-123.",
          "La clé est nouvelle ; elle est réservée de façon atomique.",
          "La carte est débitée.",
          "La réponse est enregistrée sous abc-123 — mais le réseau coupe avant que le client ne la reçoive.",
        ],
        retry: [
          "Nouvelle tentative",
          "Le client expire et réessaie avec la même clé abc-123.",
          "La clé est trouvée, la réponse enregistrée est renvoyée. La carte n'est pas débitée deux fois.",
        ],
      },
    ),
  },
  "leader-election": {
    name: "Élection de leader et coordination",
    summary:
      "S'accorder sur le nœud qui commande ou sur le propriétaire de chaque shard, grâce à un service de coordination cohérent.",
    explanation: [
      "Certaines tâches doivent tourner sur un seul nœud (planificateurs, propriétaires de shards, attribution de plages de clés). Un stockage fondé sur un consensus, comme etcd ou ZooKeeper, accorde des baux ; si le leader meurt, son bail expire et un autre nœud prend le relais.",
    ],
    howItWorks: [
      "Des baux avec TTL et des battements de cœur.",
      "Des observateurs (watches) préviennent les nœuds quand la configuration ou la propriété change.",
    ],
    tradeoffs: ["Le cluster de coordination doit lui-même être petit, fiable et rapide."],
    diagram: diagram(
      {
        w1: ["Worker 1", "Leader actuel"],
        w2: ["Worker 2", "Suiveur"],
        w3: ["Worker 3", "Suiveur"],
        etcd: ["Stockage de coordination", "Accorde un bail à un seul worker"],
        job: ["Tâche nocturne", "Doit tourner exactement une fois"],
      },
      { "w1-etcd": "Détient le bail", "w2-etcd": "Observe", "w3-etcd": "Observe", "w1-job": "Exécute", "w2-job": "Exécute" },
      {
        failover: [
          "Le leader tombe",
          "Le worker 1 détient le bail de leader et le renouvelle toutes les quelques secondes.",
          "Seul le leader exécute la tâche nocturne.",
          "Le worker 1 plante ; son bail expire. Les workers 2 et 3 se le disputent et le stockage l'accorde à un seul — le worker 2.",
          "Le worker 2 reprend la tâche. Il n'y a jamais deux leaders avec un bail valide en même temps.",
        ],
      },
    ),
  },
  microservices: {
    name: "Microservices",
    summary: "Découper un système en petits services, chacun propriétaire d'un domaine et de ses propres données.",
    explanation: [
      "Chaque service (utilisateurs, commandes, paiements…) est déployé et mis à l'échelle indépendamment et communique par API ou par événements. Les équipes avancent ainsi indépendamment et les chemins chauds montent en charge séparément.",
    ],
    howItWorks: [
      "Une passerelle d'API route les appels externes ; les services communiquent en gRPC/REST et par événements.",
      "Chaque service possède sa base de données — pas de tables partagées.",
      "Timeouts, nouvelles tentatives et disjoncteurs évitent les pannes en cascade.",
    ],
    tradeoffs: [
      "Appels réseau, pannes partielles et transactions distribuées (sagas) deviennent des problèmes quotidiens.",
      "Les petites équipes s'en sortent souvent mieux avec d'abord un monolithe bien structuré.",
    ],
    diagram: diagram(
      {
        client: ["Client", "Une seule API pour le monde extérieur"],
        gateway: ["Passerelle d'API", "Route vers les services"],
        orders: ["Service de commandes", "Possède les commandes"],
        payments: ["Service de paiement", "Possède les paiements"],
        users: ["Service utilisateurs", "Possède les utilisateurs"],
        "orders-db": ["Base des commandes", "Seul le service de commandes y accède"],
        "payments-db": ["Base des paiements", "Seul le service de paiement y accède"],
        events: ["Flux d'événements", "Les services annoncent ce qui s'est passé"],
      },
      { "orders-payments": "Débit", "orders-events": "OrderPlaced" },
      {
        order: [
          "Passer une commande",
          "Le client appelle une seule API publique.",
          "La passerelle route vers le service de commandes.",
          "Le service de commandes écrit dans sa propre base — aucun autre service ne la partage.",
          "Il appelle le service de paiement en gRPC avec un timeout et un budget de nouvelles tentatives.",
          "Le service de paiement enregistre le débit dans sa propre base.",
          "Un événement OrderPlaced permet à d'autres équipes de réagir sans que le service de commandes ne les connaisse.",
        ],
      },
    ),
  },
  "multi-region": {
    name: "Déploiement multi-régions",
    summary:
      "Faire tourner le système dans plusieurs régions géographiques pour réduire la latence et survivre à une panne régionale.",
    explanation: [
      "Les utilisateurs sont dirigés vers la région saine la plus proche par géo-DNS ou anycast. Les données sont répliquées entre régions — de façon asynchrone pour la plupart, avec précaution pour tout ce qui doit être fortement cohérent.",
    ],
    howItWorks: [
      "Actif-passif : une région sert le trafic, une autre est en attente.",
      "Actif-actif : toutes les régions servent du trafic ; il faut éviter les conflits (rattacher chaque utilisateur à une région) ou les résoudre.",
      "Partitionner par région (Uber par ville) garde l'essentiel du trafic en local.",
    ],
    tradeoffs: [
      "Les écritures inter-régions sont lentes ; une cohérence forte mondiale coûte cher.",
      "Double l'infrastructure et la complexité opérationnelle.",
    ],
    diagram: diagram(
      {
        eu: ["Utilisateurs UE", "Proches de Francfort"],
        us: ["Utilisateurs US", "Proches de la Virginie"],
        dns: ["Géo-DNS", "Dirige vers la région saine la plus proche"],
        "eu-app": ["Région UE", "Copie complète de l'application"],
        "us-app": ["Région US", "Copie complète de l'application"],
        "eu-db": ["Base UE", "Primaire pour les utilisateurs UE"],
        "us-db": ["Base US", "Primaire pour les utilisateurs US"],
      },
      { "eu-us-repl": "Réplication asynchrone" },
      {
        normal: [
          "Un jour normal",
          "Un utilisateur à Berlin ouvre l'application.",
          "Le géo-DNS l'envoie vers la région UE — des dizaines de millisecondes plus proche que les États-Unis.",
          "Ses données vivent dans la base UE.",
          "Les changements sont répliqués vers les États-Unis de façon asynchrone pour la reprise après sinistre.",
        ],
        outage: [
          "Panne d'une région",
          "La région UE tombe ; les contrôles de santé échouent.",
          "Le géo-DNS envoie alors les utilisateurs UE vers la région US.",
          "La copie US les sert — plus lentement, et sans les écritures qui n'avaient pas encore été répliquées (le RPO).",
        ],
      },
    ),
  },
  "presigned-urls": {
    name: "Imports pré-signés",
    summary:
      "Laisser les clients envoyer de gros fichiers directement dans le stockage objet grâce à une URL signée de courte durée.",
    explanation: [
      "Faire transiter des gigaoctets par vos serveurs d'API gaspille bande passante et CPU. L'API renvoie plutôt une URL signée qui autorise un seul import vers un seul emplacement pendant quelques minutes ; le client envoie le fichier directement au stockage.",
    ],
    howItWorks: [
      "Imports en plusieurs parties / reprenables pour les gros fichiers ; les empreintes des morceaux permettent la déduplication.",
      "Un événement du stockage ou un rappel du client déclenche ensuite le traitement.",
    ],
    tradeoffs: ["Le serveur doit valider le fichier après l'import (type, taille, logiciels malveillants)."],
    diagram: diagram(
      {
        app: ["Application", "A une vidéo de 200 Mo à envoyer"],
        api: ["API", "Autorise et signe les URL"],
        storage: ["Stockage objet", "Accepte l'import signé"],
        processor: ["Traitement", "S'exécute à l'arrivée du fichier"],
      },
      { "app-api": "Demande d'URL d'import", "app-storage": "PUT du fichier (URL signée)", "storage-processor": "Objet créé" },
      {
        upload: [
          "Importer directement",
          "L'application demande à l'API l'autorisation d'importer ; l'API vérifie l'utilisateur et renvoie une URL signée pour un seul objet, valable 10 minutes.",
          "L'application envoie directement au stockage — les gigaoctets ne passent jamais par les serveurs d'API.",
          "Le stockage émet un événement « objet créé », qui déclenche validation et traitement.",
        ],
      },
    ),
  },
  "rate-limiting": {
    name: "Limitation de débit",
    summary:
      "Plafonner le nombre de requêtes qu'un client peut faire sur une période, pour éviter les abus et protéger la capacité.",
    explanation: [
      "Chaque requête est attribuée à un client (clé d'API, utilisateur, IP) et comparée à une règle comme 100 requêtes par minute. Au-delà, la requête est rejetée avec un HTTP 429 au lieu d'atteindre le backend.",
    ],
    howItWorks: [
      "Seau à jetons : les jetons se rechargent à rythme constant ; chaque requête en consomme un ; autorise de courtes rafales.",
      "Fenêtre fixe : un compteur par minute — simple, mais autorise des rafales doubles aux bords des fenêtres.",
      "Fenêtre glissante : combine les fenêtres adjacentes pour des limites plus régulières.",
      "Les compteurs vivent dans un stockage en mémoire partagé et sont mis à jour de façon atomique.",
    ],
    tradeoffs: [
      "Ajoute une vérification à chaque requête ; elle doit être rapide et laisser passer en cas de panne (fail open).",
      "Des limites globales exactes entre régions coûtent cher ; on se contente généralement d'approximations.",
    ],
    diagram: diagram(
      {
        client: ["Client d'API", "Envoie des requêtes avec une clé d'API"],
        gateway: ["Passerelle d'API", "Consulte le limiteur avant de transmettre"],
        limiter: ["Limiteur de débit", "Un seau à jetons par client"],
        counters: ["Stockage des compteurs", "Jetons restants par client"],
        backend: ["Backend", "Service protégé"],
      },
      { "gw-limiter": "Autorisé ?", "limiter-counters": "Prendre un jeton", "gw-backend": "Autorisée" },
      {
        allowed: [
          "Autorisée",
          "Une requête arrive.",
          "La passerelle consulte le limiteur.",
          "Un script atomique recharge le seau pour le temps écoulé et prend un jeton — il en reste 7.",
          "La requête est transmise avec X-RateLimit-Remaining: 7.",
        ],
        rejected: [
          "Rejetée",
          "Le client envoie une rafale de 50 requêtes en une seconde.",
          "La passerelle consulte le limiteur.",
          "Le seau est vide. La passerelle répond 429 Too Many Requests avec Retry-After — le backend ne la voit jamais.",
        ],
      },
    ),
  },
  "read-replicas": {
    name: "Réplicas en lecture",
    summary: "Copier la base primaire sur des serveurs supplémentaires qui servent les requêtes de lecture.",
    explanation: [
      "Les écritures vont vers une seule base primaire ; les changements sont diffusés vers des réplicas qui répondent aux lectures. Comme l'essentiel du trafic est en lecture, cela multiplie la capacité à faible coût et fournit une cible de bascule prête à l'emploi.",
    ],
    howItWorks: [
      "Réplication asynchrone pour monter en charge (léger retard), synchrone pour ne perdre aucune donnée lors d'une bascule.",
      "Envoyer vers la primaire les lectures qui doivent voir vos propres écritures (par ex. juste après avoir publié).",
    ],
    tradeoffs: [
      "Le retard de réplication signifie que les réplicas peuvent renvoyer des données légèrement anciennes.",
      "N'aide pas le débit d'écriture — pour cela il faut du sharding.",
    ],
    diagram: diagram(
      {
        app: ["Serveurs applicatifs", "Écritures vers la primaire, lectures vers les réplicas"],
        primary: ["Primaire", "Accepte toutes les écritures"],
        r1: ["Réplica 1", "Copie en lecture seule"],
        r2: ["Réplica 2", "Copie en lecture seule"],
      },
      {
        "app-primary": "Écritures",
        "primary-r1": "Réplication",
        "primary-r2": "Réplication",
        "app-r1": "Lectures",
        "app-r2": "Lectures",
      },
      {
        "write-read": [
          "Écrire, puis lire",
          "Un utilisateur modifie son nom ; l'écriture va vers la primaire.",
          "La primaire diffuse le changement vers les réplicas quelques millisecondes plus tard.",
          "Les deux réplicas l'appliquent.",
          "La plupart des lectures vont vers les réplicas, ce qui multiplie la capacité de lecture. Les lectures qui doivent voir immédiatement l'écriture de l'utilisateur vont plutôt vers la primaire.",
        ],
      },
    ),
  },
  saga: {
    name: "Pattern saga",
    summary:
      "Exécuter une transaction multi-services comme une suite d'étapes locales, en annulant les étapes terminées si une étape ultérieure échoue.",
    explanation: [
      "Le passage en caisse touche le stock, le paiement et l'expédition, chacun avec sa propre base : une transaction ACID unique n'est pas possible. Une saga exécute chaque étape localement et définit une action de compensation (libérer le stock, rembourser) en cas d'échec d'une étape ultérieure.",
    ],
    howItWorks: [
      "Orchestration : un moteur de workflow appelle chaque étape et sa compensation.",
      "Chorégraphie : les services réagissent aux événements des autres.",
      "Chaque étape et chaque compensation doivent être idempotentes et pouvoir être rejouées.",
    ],
    tradeoffs: [
      "Les états intermédiaires sont visibles (une commande reste PENDING un moment).",
      "Les compensations doivent être conçues avec soin — certaines actions ne peuvent pas être annulées, seulement contrebalancées.",
    ],
    diagram: diagram(
      {
        orders: ["Service de commandes", "Lance la saga"],
        saga: ["Orchestrateur de saga", "Exécute étapes et compensations"],
        inventory: ["Stock", "Réserver / libérer le stock"],
        payment: ["Paiement", "Débiter / rembourser"],
        shipping: ["Expédition", "Créer l'envoi"],
      },
      { "orders-saga": "Démarrer" },
      {
        happy: [
          "Toutes les étapes réussissent",
          "Une commande est créée en PENDING et la saga démarre.",
          "Étape 1 : réserver le stock — validé dans la propre base du stock.",
          "Étape 2 : débiter la carte — validé dans la base du paiement.",
          "Étape 3 : créer l'envoi. La commande passe en CONFIRMED.",
        ],
        compensate: [
          "Le paiement échoue",
          "L'étape 1 réussit : le stock est réservé.",
          "L'étape 2 échoue : la carte est refusée.",
          "Compensation : l'orchestrateur libère la réservation. Il n'y a pas d'annulation globale — chaque étape terminée est défaite par sa propre action de compensation.",
        ],
      },
    ),
  },
  "search-indexing": {
    name: "Indexation pour la recherche",
    summary:
      "Maintenir un index inversé pour que les requêtes textuelles trouvent les documents correspondants en quelques millisecondes.",
    explanation: [
      "Les bases de données sont mauvaises pour « trouver les casques sans fil à moins de 100 $ ». Un moteur de recherche découpe le texte en un index inversé (terme → documents), gère filtres et facettes, et classe les résultats.",
    ],
    howItWorks: [
      "Alimenter l'index à partir d'événements de changement (CDC) pour qu'il reste proche de la source de vérité.",
      "Sharder l'index et ajouter des réplicas pour le débit de requêtes.",
      "L'autocomplétion utilise des index de préfixes ou des tries.",
    ],
    tradeoffs: [
      "L'index est légèrement en retard sur la base de données.",
      "Réindexer de gros catalogues prend du temps ; utilisez des alias pour basculer d'un index à l'autre.",
    ],
    diagram: diagram(
      {
        app: ["Service catalogue", "Écrit les produits"],
        db: ["Base de données", "Source de vérité"],
        cdc: ["Flux de changements", "Chaque insertion / mise à jour / suppression"],
        indexer: ["Indexeur", "Construit les documents de recherche"],
        index: ["Index de recherche", "Index inversé + facettes"],
        search: ["Service de recherche", "Analyse et classe les requêtes"],
        user: ["Client", "Tape « casque sans fil »"],
      },
      { "search-index": "Requête" },
      {
        index: [
          "Garder l'index à jour",
          "Un nouveau produit est enregistré.",
          "Le journal de changements de la base publie l'insertion.",
          "L'indexeur en fait un document de recherche (titre découpé en termes, marque, prix, note).",
          "Il est ajouté à l'index inversé en quelques secondes.",
        ],
        query: [
          "Rechercher",
          "Le client recherche « casque sans fil ».",
          "Chaque terme renvoie directement aux produits qui le contiennent ; les résultats sont croisés, filtrés par facettes et classés — en quelques millisecondes, sans parcourir de table.",
        ],
      },
    ),
  },
  sharding: {
    name: "Sharding (partitionnement)",
    summary:
      "Répartir un gros jeu de données sur de nombreuses machines selon une clé, pour que chacune n'en stocke et n'en serve qu'une partie.",
    explanation: [
      "Quand une seule base ne tient plus le volume d'écriture ou la taille des données, celles-ci sont découpées en shards. Chaque shard est une base indépendante qui contient les lignes dont la clé de sharding lui est attribuée.",
      "Le choix de la clé de sharding est la décision la plus importante : les requêtes qui incluent la clé touchent un seul shard ; les autres doivent interroger tous les shards.",
    ],
    howItWorks: [
      "Sharding par hachage : shard = hash(clé) mod N (ou un anneau de hachage) — répartit la charge uniformément.",
      "Sharding par plages : des plages de clés contiguës par shard — bien pour les parcours de plages, risque de points chauds.",
      "Par annuaire : une table de correspondance associe les clés aux shards, ce qui permet le rééquilibrage.",
      "Clés typiques : userId, conversationId, videoId, merchantId, ville.",
    ],
    tradeoffs: [
      "Les jointures et transactions entre shards deviennent difficiles, voire impossibles.",
      "Les clés chaudes (une célébrité, une vidéo virale) peuvent encore surcharger un shard.",
      "Re-sharder quand les données grossissent demande de l'anticipation (shards virtuels, hachage cohérent).",
    ],
    diagram: diagram(
      {
        app: ["Application", "Lit et écrit des utilisateurs"],
        router: ["Routeur de shards", "Calcule le shard à partir de la clé"],
        map: ["Carte des shards", "Quelle plage de clés vit sur quel shard"],
        s0: ["Shard 0", "hash(userId) mod 3 = 0"],
        s1: ["Shard 1", "hash(userId) mod 3 = 1"],
        s2: ["Shard 2", "hash(userId) mod 3 = 2"],
      },
      { "router-map": "Consultation" },
      {
        single: [
          "Requête par clé",
          "L'application demande le profil de l'utilisateur 42.",
          "Le routeur hache la clé : hash(42) mod 3 = 1, et confirme dans la carte que le shard 1 la possède.",
          "Seul le shard 1 est interrogé. Chaque shard détient un tiers des données et un tiers de la charge.",
        ],
        scatter: [
          "Requête sans la clé",
          "L'application demande « tous les utilisateurs inscrits aujourd'hui » — aucun id utilisateur dans la requête.",
          "Le routeur doit interroger chaque shard…",
          "…en parallèle…",
          "…puis fusionner les résultats. C'est pourquoi la clé de sharding doit correspondre à vos requêtes les plus fréquentes.",
        ],
      },
    ),
  },
  "prefix-trie": {
    name: "Tries et recherche par préfixe",
    summary:
      "Stocker les chaînes par préfixes pour que « meilleures suggestions pour ce que l'utilisateur a tapé » tienne en une seule recherche.",
    explanation: [
      "L'autocomplétion doit répondre à chaque frappe. Un trie associe chaque préfixe à ses enfants ; stocker les k meilleures complétions à chaque nœud réduit une recherche à une descente le long du préfixe, sans classement au moment de la requête.",
    ],
    howItWorks: [
      "Construire les tries hors ligne à partir des journaux de requêtes, pondérés par fréquence et récence.",
      "Sharder par plages de préfixes et garder les préfixes chauds dans un cache en mémoire.",
      "Rafraîchir régulièrement ; intégrer les requêtes tendance depuis un flux.",
    ],
    tradeoffs: [
      "Gourmand en mémoire ; les listes top-k précalculées sont en retard sur les tendances soudaines.",
    ],
    diagram: diagram(
      {
        box: ["Champ de recherche", "Envoie le préfixe pendant la saisie"],
        suggest: ["Service de suggestions", "Une recherche par frappe"],
        trie: ["Shards de trie", "Top-k des complétions stocké à chaque préfixe"],
        logs: ["Journal des requêtes", "Ce que les gens ont cherché"],
        builder: ["Constructeur de tries", "Reconstruit les tries chaque jour"],
      },
      { "box-suggest": "GET /suggest?q=sys", "suggest-trie": "Nœud « sys »", "builder-trie": "Publication" },
      {
        suggest: [
          "Suggérer",
          "L'utilisateur tape « sys ».",
          "Le service descend s → y → s et renvoie la liste top-k stockée à ce nœud — aucun classement au moment de la requête.",
        ],
        build: [
          "Reconstruire",
          "Chaque nuit, le constructeur compte les requêtes de la veille.",
          "Il reconstruit les tries avec des listes top-k fraîches à chaque préfixe et les publie.",
        ],
      },
    ),
  },
  "id-generation": {
    name: "Génération d'identifiants uniques",
    summary:
      "Créer des identifiants uniques, souvent triables dans le temps, sur de nombreuses machines sans goulot central.",
    explanation: [
      "Les colonnes auto-incrémentées ne fonctionnent pas entre shards. Les ID de type Snowflake combinent un horodatage, un id de machine et une séquence par machine sur 64 bits : ils sont uniques et se trient dans le temps. Les liens courts utilisent des compteurs issus de plages pré-allouées, encodés en Base62.",
    ],
    howItWorks: [
      "Snowflake : 41 bits de temps + 10 bits de worker + 12 bits de séquence.",
      "Allocation de plages : chaque générateur réserve un bloc de numéros auprès d'un stockage de coordination.",
      "UUIDv7 fournit des ID aléatoires ordonnés dans le temps sans coordination.",
    ],
    tradeoffs: ["Le décalage d'horloge peut casser l'ordre ; des ID séquentiels peuvent être devinables."],
    diagram: diagram(
      {
        s1: ["Serveur 1 (worker 7)", "Génère des ID localement"],
        s2: ["Serveur 2 (worker 8)", "Génère des ID localement"],
        ranges: ["Registre des workers", "Attribue une seule fois un id de worker unique à chaque serveur"],
        db: ["Stockage des tweets", "Les ID se trient dans le temps"],
      },
      { "s1-ranges": "Réserve un id de worker", "s2-ranges": "Réserve un id de worker" },
      {
        generate: [
          "Générer des ID",
          "Au démarrage, chaque serveur réserve un id de worker unique — la seule coordination nécessaire.",
          "Le serveur 1 construit ses ID avec le temps + le worker 7 + une séquence : aucun appel réseau par ID.",
          "Le serveur 2 fait de même avec le worker 8 — les ID ne peuvent jamais entrer en collision, et tous se trient par date de création.",
        ],
      },
    ),
  },
  webrtc: {
    name: "Appels WebRTC",
    summary:
      "Audio et vidéo en temps réel entre navigateurs et applications, avec des serveurs uniquement pour la signalisation et le relais si nécessaire.",
    explanation: [
      "Les pairs échangent leurs informations de connexion via un serveur de signalisation (souvent en WebSocket), puis tentent de se connecter directement. STUN découvre les adresses publiques ; quand un pare-feu bloque les chemins directs, un serveur TURN relaie le média. Les appels de groupe utilisent un SFU qui transmet chaque flux aux autres participants.",
    ],
    howItWorks: [
      "Signalisation : offre/réponse et candidats ICE via WebSocket.",
      "STUN pour la découverte NAT ; TURN relaie environ 10 à 20 % des appels.",
      "SFU pour les groupes ; le simulcast permet à chaque participant de recevoir une qualité adaptée.",
    ],
    tradeoffs: [
      "La bande passante TURN et SFU est le principal coût.",
      "L'enregistrement et la conformité nécessitent des pipelines supplémentaires.",
    ],
    diagram: diagram(
      {
        alice: ["Alice", "Lance un appel"],
        bob: ["Bob", "Répond"],
        signal: ["Signalisation", "Relaie les offres et les candidats réseau"],
        turn: ["Relais TURN", "Utilisé seulement quand le direct échoue"],
      },
      { "alice-signal": "Offre", "bob-signal": "Réponse", "alice-turn": "Média", "bob-turn": "Média" },
      {
        call: [
          "Établir un appel",
          "Le navigateur d'Alice crée une offre (codecs, clés) et l'envoie via le serveur de signalisation.",
          "L'application de Bob répond ; les deux échangent les candidats réseau trouvés via STUN.",
          "La plupart des appels se connectent alors directement en pair à pair. Si un pare-feu l'empêche, le média passe plutôt par le relais TURN…",
          "…qui le transmet à Bob. Les serveurs ne transportent le média que lorsqu'il le faut.",
        ],
      },
    ),
  },
  websockets: {
    name: "WebSockets et push en temps réel",
    summary: "Garder une connexion persistante ouverte pour que le serveur puisse pousser les mises à jour instantanément.",
    explanation: [
      "La messagerie, le suivi en direct et les cotations ne peuvent pas attendre un polling. Chaque client garde une connexion de longue durée vers une passerelle ; le serveur pousse les messages dès qu'ils arrivent.",
    ],
    howItWorks: [
      "Un registre des connexions associe userId → nœud de passerelle.",
      "Les passerelles échangent les messages via un pub/sub pour que n'importe quel nœud puisse joindre n'importe quel utilisateur.",
      "Des battements de cœur détectent les connexions mortes ; les clients se reconnectent avec un délai croissant.",
    ],
    tradeoffs: [
      "Serveurs avec état : déploiements et pannes provoquent des tempêtes de reconnexions.",
      "Chaque nœud garde des dizaines de milliers de sockets — il faut des E/S asynchrones et un équilibrage L4.",
    ],
    diagram: diagram(
      {
        alice: ["Alice", "Connectée au nœud 1"],
        bob: ["Bob", "Connecté au nœud 2"],
        lb: ["Répartiteur L4", "Répartit les connexions de longue durée"],
        n1: ["Nœud de passerelle 1", "Tient la socket d'Alice"],
        n2: ["Nœud de passerelle 2", "Tient la socket de Bob"],
        registry: ["Registre des connexions", "utilisateur → nœud"],
        bus: ["Bus pub/sub", "Livraison de nœud à nœud"],
      },
      { "n1-registry": "Où est Bob ?", "n1-bus": "Vers le nœud 2" },
      {
        message: [
          "Message entre nœuds",
          "Alice envoie « salut » sur sa socket ouverte.",
          "Il arrive au nœud de passerelle 1.",
          "Le nœud 1 cherche Bob — il est sur le nœud 2.",
          "Le nœud 1 publie le message sur le canal du nœud 2.",
          "Le nœud 2 le reçoit…",
          "…et le pousse instantanément sur la socket de Bob — sans polling.",
        ],
      },
    ),
  },
};
