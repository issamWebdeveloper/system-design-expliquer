import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const nobroker: SystemTranslation = {
  tagline: "Location et vente immobilières sans agent",
  description:
    "Les propriétaires publient leurs biens avec des photos ; les annonces sont vérifiées (automatiquement et par l'équipe) avant d'apparaître dans un index de recherche géographique. Les locataires parcourent gratuitement mais débloquent les coordonnées des propriétaires avec une offre payante, puis discutent et planifient des visites. Le paiement des loyers et des services annexes passe par la même plateforme de paiement.",
  requirements: {
    functional: [
      "Les propriétaires publient des biens avec photos, prix, emplacement et équipements",
      "Les annonces sont vérifiées pour écarter agents et fausses annonces",
      "Locataires et acheteurs cherchent par quartier, budget, type et équipements, sur une carte",
      "Les offres payantes débloquent les coordonnées ; discussion et planification de visites",
      "Payer le loyer et réserver des services (déménageurs, ménage)",
    ],
    nonFunctional: [
      "Résultats de recherche en moins d'une seconde",
      "Les coordonnées restent protégées jusqu'au déblocage",
      "Spam et fraude maintenus au plus bas",
    ],
  },
  apis: apis(
    "Crée une annonce ; renvoie les URL d'envoi des photos",
    "Annonces vérifiées correspondantes",
    "Débloquer les coordonnées du propriétaire (consomme des crédits de l'offre)",
    "Demander un créneau de visite",
    "Discussion propriétaire–locataire",
  ),
  estimates: estimates(
    ["Utilisateurs", "≈ 5 M par mois, 500 k par jour", "Hypothèse tirée du PDF"],
    ["Annonces actives", "≈ 1 M", "Hypothèse"],
    ["Recherches", "≈ 60 req/s en moyenne", "500 k utilisateurs × 10 recherches ÷ 86 400 s ; pic ×5 le soir"],
    ["Photos", "≈ 20 To", "1 M d'annonces × 10 photos × ~2 Mo"],
  ),
  dataModel: dataModel(
    ["Annonce", "Base relationnelle + index de recherche", "Source de vérité plus une copie interrogeable géographiquement"],
    ["Déblocage de contact", "Base relationnelle", "Applique les limites de l'offre et garde une trace d'audit"],
    ["Message de discussion", "Base orientée colonnes larges", "Fort volume d'écriture par conversation"],
  ),
  nodes: nodes({
    tenant: ["Appli locataire / acheteur", "Chercher, débloquer, discuter, visiter"],
    owner: ["Appli propriétaire", "Publier et gérer les annonces"],
    cdn: ["CDN des photos", "Photos des annonces"],
    gateway: ["Passerelle d'API", "Authentification, limites de débit"],
    "listing-svc": ["Service des annonces", "Créer et mettre à jour les annonces"],
    verification: ["Vérification et fraude", "Signale agents, doublons et fausses annonces"],
    "search-svc": ["Service de recherche", "Recherche géographique et par filtres"],
    "search-index": ["Index des annonces", "Annonces en ligne avec points géographiques"],
    "lead-svc": ["Contacts et visites", "Contrôle des offres, déblocage des contacts, planification des visites"],
    chat: ["Discussion", "Messagerie propriétaire–locataire"],
    "payment-svc": ["Offres et paiements", "Abonnements, loyers, services"],
    psp: ["Prestataire de paiement", "UPI, cartes"],
    "main-db": ["Annonces, utilisateurs et offres", "Données transactionnelles"],
    photos: ["Photos", "Images envoyées"],
    events: ["Événements d'annonce", "Créée, vérifiée, mise à jour"],
    notify: ["Push et SMS", "Nouvelles correspondances, rappels de visite"],
  }),
  edges: edges({
    "owner-photos": "Envoi (pré-signé)",
    "tenant-cdn": "Photos",
    "verify-db": "Approuver / rejeter",
    "events-index": "Indexer les annonces en ligne",
    "lead-db": "Crédits de l'offre",
    "events-notify": "Alertes de correspondance",
  }),
  flows: flows({
    post: [
      "Publier une annonce",
      "Le propriétaire saisit les détails.",
      "Le service des annonces les valide.",
      "L'annonce est enregistrée en PENDING et les URL d'envoi des photos sont renvoyées.",
      "Les photos partent directement vers le stockage.",
      "Une fois les photos arrivées, un événement « annonce créée » est publié.",
      "Des modèles repèrent agents, doublons et fausses photos ; les cas limites vont à l'équipe.",
      "L'annonce est approuvée.",
      "Elle devient consultable.",
      "Les locataires ayant une recherche enregistrée correspondante sont alertés.",
    ],
    contact: [
      "Contacter un propriétaire",
      "Le locataire cherche dans un quartier sur la carte.",
      "Le service de recherche filtre par budget et type.",
      "Les annonces en ligne correspondantes reviennent.",
      "Le locataire touche « contacter le propriétaire ».",
      "Un crédit de l'offre est consommé et le déblocage enregistré.",
      "Ils discutent et réservent une visite.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Agents et fausses annonces", "Contrôles automatiques des photos, numéros de téléphone et habitudes de publication, plus une relecture manuelle avant la mise en ligne."],
    ["Aspiration des coordonnées des propriétaires", "Cacher les contacts derrière des déblocages authentifiés et limités en débit ; masquer les numéros dans la discussion."],
    ["Pics de recherche le soir", "Mettre en cache les recherches populaires par localité et ajouter des réplicas de recherche."],
  ),
  scaling: [
    "Partitionner annonces et recherche par ville.",
    "CDN pour toutes les photos ; redimensionner à l'envoi.",
    "Pipelines asynchrones pour la vérification et les notifications.",
  ],
  extensions: [
    "Contrats de location et signature électronique.",
    "Place de marché de services à domicile (déménagement, peinture).",
    "Estimation des prix d'un quartier à partir des annonces passées.",
  ],
};
