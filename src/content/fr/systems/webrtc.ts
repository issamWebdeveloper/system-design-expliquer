import type { SystemTranslation } from "../../translation";
import { apis, bottlenecks, dataModel, edges, estimates, flows, nodes } from "../helpers";

export const webrtc: SystemTranslation = {
  name: "Appels vidéo (WebRTC)",
  tagline: "Appels à deux et en groupe avec signalisation, TURN et SFU",
  description:
    "Les serveurs ne mixent jamais la vidéo. Un service de signalisation (sur WebSockets) permet aux participants d'échanger leurs offres de connexion ; la plupart des appels à deux se connectent ensuite en pair à pair, avec des relais TURN pour ceux que bloquent les pare-feu. Dans les appels de groupe, chaque participant envoie son flux une seule fois à une unité de transfert sélectif (SFU), qui le relaie à tous les autres et peut le dupliquer vers un pipeline d'enregistrement.",
  requirements: {
    functional: [
      "Appels audio/vidéo à deux et en groupe dans les navigateurs et les applications",
      "Partage d'écran et discussion pendant l'appel",
      "Rejoindre un salon par lien avec authentification",
      "Enregistrement facultatif",
    ],
    nonFunctional: [
      "Moins de ~150 ms de latence dans un sens pour une conversation naturelle",
      "Fonctionne derrière les pare-feu d'entreprise et les NAT mobiles",
      "Adapte la qualité à la bande passante de chaque participant",
      "Médias chiffrés en transit",
    ],
  },
  apis: apis(
    "Crée un salon ; renvoie le roomId et les jetons d'accès",
    "Échanger offres/réponses SDP et candidats ICE",
    "Identifiants STUN/TURN de courte durée",
    "Démarrer l'enregistrement",
  ),
  estimates: estimates(
    ["Appels simultanés", "≈ 100 k", "Hypothèse"],
    ["Part relayée", "≈ 20 % des appels à deux", "Part typique qui ne peut pas se connecter directement"],
    ["Trafic sortant TURN", "≈ 60 Gbit/s", "100 k × 20 % × 2 flux × 1,5 Mbit/s"],
    ["Diffusion par la SFU", "N−1 flux sortants par flux entrant", "Un appel à 10 envoie chaque flux aux 9 autres ; le simulcast réduit la qualité des petites vignettes"],
  ),
  dataModel: dataModel(
    ["Salon", "Cache en mémoire", "État de courte durée, lu à chaque message de signalisation"],
    ["Enregistrement", "Stockage objet", "Gros fichiers multimédias"],
  ),
  nodes: nodes({
    caller: ["Appelant (navigateur)", "Capture caméra et micro, encode et envoie"],
    callee: ["Appelé (application)", "Pareil, sur réseau mobile"],
    signal: ["Service de signalisation", "Relaie offres, réponses et candidats ICE"],
    identity: ["Authentification", "Jetons de salon"],
    rooms: ["Service des salons", "Crée les salons, attribue une SFU, émet les identifiants TURN"],
    "room-state": ["État des salons", "Participants et serveur média attribué"],
    turn: ["Relais STUN / TURN", "Découverte du NAT et relais pour les connexions bloquées"],
    sfu: ["Serveurs média SFU (Go)", "Relaient chaque flux aux autres participants"],
    recorder: ["Workers d'enregistrement", "Mixent les flux dupliqués dans un fichier (FFmpeg)"],
    recordings: ["Enregistrements", "Enregistrements terminés"],
    metrics: ["Métriques de qualité d'appel", "Perte de paquets, gigue, débit par appel"],
  }),
  edges: edges({
    "caller-signal": "Offre, ICE",
    "callee-signal": "Réponse, ICE",
    "signal-identity": "Vérifier le jeton",
    "caller-turn": "Médias relayés",
    "caller-sfu": "Médias du groupe",
    "sfu-recorder": "Flux dupliqués",
  }),
  flows: flows({
    "one-to-one": [
      "Lancer un appel à deux",
      "L'appelant se connecte à la signalisation et envoie une offre SDP.",
      "Le jeton prouve qu'il peut rejoindre ce salon.",
      "Le service des salons enregistre l'appel et renvoie des identifiants TURN de courte durée.",
      "L'appelé reçoit l'offre et répond ; les deux échangent leurs candidats ICE.",
      "STUN trouve les adresses publiques. La plupart des appels se connectent alors directement ; sinon, les médias passent par un relais TURN.",
    ],
    group: [
      "Appel de groupe avec enregistrement",
      "Au-delà de deux personnes, le service des salons attribue une SFU proche des participants.",
      "L'attribution est conservée pour que les retardataires utilisent la même SFU.",
      "Chaque participant envoie son flux une seule fois (en plusieurs qualités grâce au simulcast).",
      "La SFU transmet à chaque participant la bonne qualité de tous les autres flux.",
      "Quand l'enregistrement démarre, la SFU duplique les flux vers un worker d'enregistrement.",
      "Le fichier mixé est envoyé à la fin de l'appel.",
    ],
  }),
  bottlenecks: bottlenecks(
    ["Coût de la bande passante des relais", "Préférer les connexions directes ; déployer TURN dans de nombreuses régions et n'utiliser TURN sur TLS (port 443) qu'en cas de besoin."],
    ["Les gros appels saturent une seule SFU", "Chaîner les SFU (les serveurs se relaient entre eux) et limiter la vidéo des participants silencieux."],
    ["Les mauvais réseaux provoquent des gels", "Le simulcast et le contrôle de congestion permettent à la SFU de basculer chaque spectateur vers une couche plus légère."],
  ),
  scaling: [
    "Placer SFU et serveurs TURN dans de nombreuses régions ; choisir selon la position des participants.",
    "Garder la signalisation sans état, avec l'état des salons dans un cache partagé.",
    "Faire monter les SFU en charge selon la bande passante, pas le CPU.",
  ],
  extensions: [
    "Sous-titres en direct par reconnaissance vocale sur l'audio dupliqué.",
    "Diffusion à un large public en convertissant en HLS.",
    "Chiffrement de bout en bout avec les insertable streams.",
  ],
};
