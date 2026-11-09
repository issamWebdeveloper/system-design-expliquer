import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const dropbox: SystemTranslation = {
  tagline: "La synchronisation de fichiers sur tous vos appareils",
  description:
    "Le client de synchronisation découpe les fichiers en blocs de 4 Mo et calcule l'empreinte de chacun. Seuls les blocs que le serveur n'a jamais vus sont envoyés, directement vers le stockage objet : modifier un gros fichier ou stocker un doublon ne coûte presque rien. Un service de métadonnées enregistre chaque version de fichier comme une liste d'empreintes de blocs et l'ajoute à un journal des changements ; les autres appareils sont prévenus « quelque chose a changé » par une connexion longue et ne récupèrent que les nouveaux blocs.",
  requirements: {
    functional: [
      "Envoyer, télécharger, renommer, déplacer et supprimer fichiers et dossiers",
      "Synchronisation automatique entre les appareils d'un utilisateur",
      "Partager fichiers et dossiers avec d'autres utilisateurs",
      "Historique des versions et restauration",
      "Travailler hors ligne et réconcilier à la reconnexion",
    ],
    nonFunctional: [
      "Ne jamais perdre un fichier ; stockage à très haute durabilité",
      "Synchronisation en quelques secondes après un changement",
      "Efficace : ne renvoyer que les parties modifiées des gros fichiers",
      "Cohérence forte des métadonnées (jamais deux « dernières » versions sans copie de conflit)",
    ],
  },
  apis: apis(
    "{ path, blockHashes[], baseVersion } → empreintes des blocs manquants, ou nouvelle version",
    "Envoyer un bloc (via une URL pré-signée)",
    "Tout ce qui a changé depuis le curseur de l'appareil",
    "Télécharger un bloc",
    "Connexion longue qui annonce « nouveaux changements disponibles »",
    "Partager un dossier avec un autre utilisateur",
  ),
  estimates: estimates(
    ["Utilisateurs", "≈ 50 M, dont 10 M par jour", "Hypothèse"],
    ["Données stockées", "≈ 1 Eo logique", "50 M × ~20 Go utilisés en moyenne ; la déduplication réduit le stockage physique"],
    ["Changements de fichiers", "≈ 12 k/s", "10 M d'utilisateurs actifs × 100 changements ÷ 86 400 s"],
    ["Transfert", "≈ 2 Po/jour (~185 Gbit/s)", "10 M d'utilisateurs × ~200 Mo synchronisés par jour"],
  ),
  dataModel: dataModel(
    ["Version de fichier", "Base relationnelle, shardée par espace de noms (utilisateur ou dossier partagé)", "Mises à jour transactionnelles et détection des conflits par dossier"],
    ["Journal des changements", "Base relationnelle (ajout seul par espace de noms)", "Les appareils reprennent la synchronisation depuis un curseur dans ce journal"],
    ["Bloc", "Stockage objet", "Adressé par son contenu : les blocs identiques ne sont stockés qu'une fois"],
  ),
  nodes: nodes({
    desktop: ["Client de bureau", "Surveille les dossiers, découpe et hache les fichiers"],
    mobile: ["Application mobile", "Parcourt et télécharge à la demande"],
    lb: ["Répartiteur de charge", "Répartit le trafic de l'API"],
    "meta-svc": ["Service de métadonnées", "Valide les versions de fichiers et fournit les listes de changements"],
    notify: ["Service de notification", "Prévient les appareils connectés que leurs dossiers ont changé"],
    "meta-db": ["Métadonnées et journal", "Versions des fichiers et journal des changements par dossier"],
    "meta-cache": ["Cache des métadonnées", "Listes de dossiers chaudes et vérifications d'existence de blocs"],
    blocks: ["Stockage des blocs", "Blocs de 4 Mo adressés par contenu"],
    events: ["Événements de changement", "Un événement par changement validé"],
  }),
  edges: edges({
    "desktop-lb": "Valider / lister les changements",
    "meta-cache-rw": "Blocs connus ?",
    "desktop-blocks": "Envoyer les blocs manquants (pré-signé)",
    "mobile-blocks": "Télécharger les blocs",
    "desktop-notify": "S'abonner",
  }),
  flows: flows({
    upload: [
      "Enregistrer un fichier",
      "Le client détecte un changement, découpe le fichier en blocs de 4 Mo, les hache et demande à valider la nouvelle version.",
      "Le service de métadonnées reçoit la liste des empreintes de blocs.",
      "Il vérifie quels blocs existent déjà — généralement la plupart.",
      "Le client envoie seulement les blocs manquants, directement vers le stockage.",
      "Le client relance la validation ; la nouvelle version et une entrée de journal sont écrites dans une seule transaction. Si la version de base est périmée, une copie de conflit est créée.",
      "Un événement de changement est publié.",
      "Le service de notification trouve les autres appareils connectés de l'utilisateur.",
      "Chaque appareil reçoit « nouveaux changements »…",
      "…et demande les changements depuis son curseur.",
      "Il ne télécharge que les blocs qu'il n'a pas déjà.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Renvoyer des fichiers entiers pour de petites modifications", "Découpage en blocs avec empreintes de contenu ; seuls les blocs modifiés circulent. Les fichiers identiques entre utilisateurs ne sont stockés qu'une fois."],
    ["Des millions d'appareils inactifs qui interrogent pour avoir les changements", "Des connexions de notification longues qui disent seulement « quelque chose a changé » ; les appareils récupèrent ensuite un delta."],
    ["Deux appareils qui modifient le même fichier hors ligne", "Les validations portent la version de base ; une différence crée une copie en conflit au lieu d'écraser."],
    ["Les gros dossiers partagés deviennent des points chauds de métadonnées", "Sharder par espace de noms et mettre les listes en cache ; paginer les listes de changements."],
  ),
  scaling: [
    "Sharder les métadonnées par espace de noms pour que le journal de chaque dossier tienne sur un seul shard.",
    "Le stockage objet monte en charge tout seul ; répliquer les blocs entre zones ou régions.",
    "Faire monter la couche de notification horizontalement avec un registre des connexions.",
    "Garder les envois de blocs hors des serveurs d'API grâce aux URL pré-signées.",
  ],
  extensions: [
    "Synchronisation LAN entre appareils du même réseau.",
    "Synchronisation sélective et fichiers fantômes téléchargés à la demande.",
    "Recherche plein texte dans les documents.",
    "Chiffrement côté client.",
  ],
};
