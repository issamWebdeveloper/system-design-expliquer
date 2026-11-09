import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const googleMaps: SystemTranslation = {
  tagline: "Tuiles de carte, recherche de lieux, itinéraires et trafic en direct",
  description:
    "Une carte est surtout statique : un pipeline hors ligne découpe le monde en tuiles à chaque niveau de zoom, servies par un CDN. Les lieux se trouvent grâce à un index de recherche géographique. Le calcul d'itinéraire s'appuie sur un graphe routier prétraité, dont les poids sont mis à jour par le trafic en direct calculé à partir de millions de positions GPS anonymes de téléphones, et un modèle de ML transforme le tout en temps de trajet estimés.",
  requirements: {
    functional: [
      "Déplacer et zoomer sur une carte du monde",
      "Rechercher lieux et adresses (géocodage) et trouver l'adresse d'un point (géocodage inverse)",
      "Itinéraires en voiture, transports en commun, vélo ou à pied avec temps estimé",
      "Navigation pas à pas avec trafic en direct et recalcul d'itinéraire",
    ],
    nonFunctional: [
      "Les tuiles se chargent instantanément partout",
      "Itinéraires en moins d'une seconde, même à l'échelle d'un continent",
      "Le trafic reflète la réalité en quelques minutes",
      "Les données de localisation sont anonymisées",
    ],
  },
  apis: apis(
    "Tuile vectorielle pour le zoom z et la tuile x, y (en cache CDN)",
    "Lieux et adresses près d'un point",
    "Adresse d'un point",
    "{ origin, destination, mode, departAt } → itinéraires avec temps estimé",
    "Lots de points GPS anonymes envoyés par les téléphones en navigation",
  ),
  estimates: estimates(
    ["Utilisateurs quotidiens", "≈ 100 M", "Hypothèse"],
    ["Requêtes de tuiles", "≈ 115 k/s", "100 M d'utilisateurs × 5 vues de carte × 20 tuiles ÷ 86 400 s — presque toutes servies par le CDN"],
    ["Requêtes d'itinéraire", "≈ 2–3 k/s en moyenne", "100 M d'utilisateurs × 2 itinéraires ÷ 86 400 s"],
    ["Sondes GPS", "≈ 2 M/s", "10 M d'appareils en navigation × un point toutes les 5 s"],
    ["Stockage des tuiles", "Des dizaines de To", "Tuiles vectorielles du zoom 0 à 18 pour le monde entier, plus l'imagerie à part"],
  ),
  dataModel: dataModel(
    ["Tuile de carte", "Stockage objet + CDN", "Prérendue et immuable par version — idéale pour le cache"],
    ["Tronçon de route", "Stockage de graphe, partitionné par région", "Le calcul d'itinéraire parcourt ce graphe ; partitions et raccourcis accélèrent les longs trajets"],
    ["Vitesse en direct", "Cache en mémoire", "Réécrite chaque minute à partir de l'agrégation des sondes"],
    ["Lieu", "Index de recherche avec champs géographiques", "Classement par texte et par distance"],
  ),
  nodes: nodes({
    mobile: ["Application mobile", "Carte, recherche, navigation ; envoie un GPS anonyme pendant la navigation"],
    web: ["Application web", "Carte, recherche et itinéraires"],
    cdn: ["CDN des tuiles", "Sert les tuiles de carte depuis la périphérie"],
    gateway: ["Passerelle d'API", "Authentification, quotas et routage"],
    "places-svc": ["Lieux et géocodage", "Recherche textuelle classée par distance ; géocodage inverse"],
    "routing-svc": ["Moteur d'itinéraires", "Plus courts chemins sur le graphe routier avec poids en direct"],
    eta: ["Modèle de temps de trajet", "Prédit la durée à partir des vitesses actuelles et historiques"],
    probes: ["Flux des sondes GPS", "Points de localisation anonymes"],
    traffic: ["Agrégation du trafic", "Rattache les points aux routes et calcule les vitesses actuelles"],
    speeds: ["Vitesses en direct", "Vitesse actuelle par tronçon de route"],
    "road-graph": ["Graphe routier", "Réseau routier partitionné avec raccourcis précalculés"],
    "places-index": ["Index des lieux", "Lieux et adresses avec champs géographiques"],
    tiles: ["Stockage des tuiles", "Tuiles vectorielles prérendues"],
    "map-pipeline": ["Pipeline des données cartographiques", "Transforme les données sources en tuiles, graphe et index"],
  }),
  edges: edges({
    "mobile-cdn": "Tuiles",
    "cdn-tiles": "Origine",
    "mobile-gateway": "Recherche / itinéraire",
    "routing-speeds": "Poids en direct",
    "routing-eta": "Temps estimé",
    "mobile-probes": "GPS pendant la navigation",
    "pipeline-tiles": "Rendu",
    "pipeline-graph": "Construction",
    "pipeline-index": "Indexation",
  }),
  flows: flows({
    view: [
      "Ouvrir la carte",
      "L'application détermine quelles tuiles couvrent l'écran à ce zoom et les demande.",
      "Presque toutes les tuiles sont déjà en périphérie ; les rares autres sont récupérées une fois dans le stockage.",
    ],
    route: [
      "Obtenir un itinéraire",
      "L'utilisateur cherche une destination.",
      "Le service des lieux traite la requête.",
      "Il fait correspondre le texte et classe par distance à l'utilisateur.",
      "L'utilisateur demande un itinéraire.",
      "Le moteur parcourt le graphe partitionné en sautant de longues distances grâce aux raccourcis précalculés.",
      "Les poids viennent des vitesses actuelles : l'itinéraire contourne les bouchons.",
      "Le modèle de temps de trajet ajuste la durée selon les tendances historiques à cette heure.",
    ],
    traffic: [
      "Trafic en direct",
      "Les téléphones en navigation envoient des lots de points GPS anonymisés.",
      "Les points sont rattachés aux tronçons de route et moyennés par minute.",
      "Les vitesses mises à jour alimentent le calcul d'itinéraire et la couche rouge/orange/verte.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Des milliards de requêtes de tuiles", "Prérendre des tuiles immuables et versionnées, servies par le CDN ; les clients les mettent aussi en cache."],
    ["Un simple plus court chemin est trop lent à l'échelle d'un continent", "Partitionner le graphe et précalculer des raccourcis (contraction hierarchies) pour que les requêtes touchent peu de nœuds."],
    ["Des millions de points GPS par seconde", "Regrouper sur l'appareil, partitionner le flux par région et agréger par tronçon et par minute."],
  ),
  scaling: [
    "Partitionner itinéraires et trafic par région géographique ; la plupart des trajets restent dans une seule.",
    "Répliquer l'index des lieux par région, avec les données locales en priorité.",
    "Reconstruire tuiles et graphe de façon incrémentale quand les données cartographiques changent.",
    "Garder les vitesses en direct en mémoire, shardées par tronçon.",
  ],
  extensions: [
    "Itinéraires en transports en commun avec horaires.",
    "Cartes hors ligne téléchargées par région.",
    "Imagerie au niveau de la rue.",
    "Avis, photos et horaires d'ouverture des lieux.",
  ],
};
