import type { SystemDesignInput } from "@/types/schema";

export const webrtc: SystemDesignInput = {
  slug: "webrtc",
  name: "Video calling (WebRTC)",
  tagline: "1:1 and group calls with signalling, TURN and SFUs",
  description:
    "Servers never mix the video. A signalling service (over WebSockets) lets participants swap connection offers; most 1:1 calls then connect peer-to-peer, with TURN relays for the ones blocked by firewalls. Group calls send each participant's stream once to a Selective Forwarding Unit, which forwards it to everyone else, and can fork it to a recording pipeline.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["webrtc", "websockets", "multi-region", "horizontal-scaling"],

  requirements: {
    functional: [
      "1:1 and group audio/video calls in browsers and apps",
      "Screen sharing and in-call chat",
      "Join rooms by link with authentication",
      "Optional recording",
    ],
    nonFunctional: [
      "Under ~150 ms one-way latency for natural conversation",
      "Works behind corporate firewalls and mobile NATs",
      "Adapts quality to each participant's bandwidth",
      "Media encrypted in transit",
    ],
  },

  apis: [
    { method: "POST", path: "/rooms", purpose: "Create a room; returns roomId and join tokens" },
    { method: "WS", path: "/signal?room=&token=", purpose: "Exchange SDP offers/answers and ICE candidates" },
    { method: "GET", path: "/ice-servers", purpose: "Short-lived STUN/TURN credentials" },
    { method: "POST", path: "/rooms/{roomId}/recordings", purpose: "Start recording" },
  ],

  estimates: [
    { label: "Concurrent calls", value: "≈ 100 k", derivation: "Assumption" },
    { label: "Relayed share", value: "≈ 20% of 1:1 calls", derivation: "Typical share that can't connect directly" },
    { label: "TURN egress", value: "≈ 60 Gbps", derivation: "100 k × 20% × 2 streams × 1.5 Mbps" },
    { label: "SFU fan-out", value: "N−1 streams out per stream in", derivation: "A 10-person call sends each stream to 9 others; simulcast lowers quality for small tiles" },
  ],

  dataModel: [
    {
      entity: "Room",
      store: "In-memory cache",
      key: "roomId",
      fields: ["participants", "sfuNodeId", "createdAt", "recording"],
      why: "Short-lived state, read on every signalling message",
    },
    {
      entity: "Recording",
      store: "Object storage",
      key: "roomId/recordingId",
      fields: ["mp4/webm", "duration"],
      why: "Large media files",
    },
  ],

  nodes: [
    { id: "caller", kind: "web-client", label: "Caller (browser)", role: "Captures camera/mic, encodes and sends" },
    { id: "callee", kind: "mobile-client", label: "Callee (app)", role: "Same, on mobile networks" },
    { id: "signal", kind: "realtime-gateway", label: "Signalling service", role: "Relays offers, answers and ICE candidates" },
    { id: "identity", kind: "identity", label: "Auth", role: "Room tokens" },
    { id: "rooms", kind: "service", label: "Room service", role: "Creates rooms, assigns an SFU, issues TURN credentials" },
    { id: "room-state", kind: "cache", label: "Room state", role: "Participants and assigned media server" },
    { id: "turn", kind: "webrtc-media", label: "STUN / TURN relays", role: "NAT discovery and relays for blocked connections" },
    { id: "sfu", kind: "webrtc-media", label: "SFU media servers (Go)", role: "Forward each stream to the other participants" },
    { id: "recorder", kind: "service", label: "Recording workers", role: "Mix forked streams into a file (FFmpeg)" },
    { id: "recordings", kind: "object-storage", label: "Recordings", role: "Finished recordings" },
    { id: "metrics", kind: "observability", label: "Call quality metrics", role: "Packet loss, jitter, bitrate per call" },
  ],

  edges: [
    { id: "caller-signal", from: "caller", to: "signal", label: "Offer, ICE", protocol: "ws" },
    { id: "callee-signal", from: "callee", to: "signal", label: "Answer, ICE", protocol: "ws" },
    { id: "signal-identity", from: "signal", to: "identity", label: "Verify token" },
    { id: "signal-rooms", from: "signal", to: "rooms", protocol: "grpc" },
    { id: "rooms-state", from: "rooms", to: "room-state" },
    { id: "caller-turn", from: "caller", to: "turn", label: "Relayed media" },
    { id: "callee-turn", from: "callee", to: "turn" },
    { id: "caller-sfu", from: "caller", to: "sfu", label: "Group media" },
    { id: "callee-sfu", from: "callee", to: "sfu" },
    { id: "sfu-recorder", from: "sfu", to: "recorder", label: "Forked streams", protocol: "stream" },
    { id: "recorder-store", from: "recorder", to: "recordings" },
    { id: "sfu-metrics", from: "sfu", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "one-to-one",
      name: "Start a 1:1 call",
      steps: [
        { edge: "caller-signal", text: "The caller connects to signalling and sends an SDP offer." },
        { edge: "signal-identity", text: "The token proves they may join this room." },
        { edge: "signal-rooms", text: "The room service records the call and returns short-lived TURN credentials." },
        { edge: "callee-signal", text: "The callee receives the offer and replies with an answer; both trade ICE candidates." },
        { edge: "caller-turn", text: "STUN finds public addresses. Most calls now connect directly; if not, media flows through a TURN relay." },
      ],
    },
    {
      id: "group",
      name: "Group call with recording",
      steps: [
        { edge: "signal-rooms", text: "For more than two people the room service assigns an SFU near the participants." },
        { edge: "rooms-state", text: "The assignment is stored so late joiners use the same SFU." },
        { edge: "caller-sfu", text: "Each participant uploads their stream once (in several qualities with simulcast)." },
        { edge: "callee-sfu", text: "The SFU forwards the right quality of every other stream to each participant." },
        { edge: "sfu-recorder", text: "When recording starts, the SFU forks the streams to a recording worker." },
        { edge: "recorder-store", text: "The mixed file is uploaded when the call ends." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Relay bandwidth cost",
      fix: "Prefer direct connections; deploy TURN in many regions and use TURN over TLS on 443 only when needed.",
      nodes: ["turn"],
    },
    {
      problem: "Large calls overwhelm one SFU",
      fix: "Cascade SFUs (servers forward to each other) and cap video for inactive speakers.",
      nodes: ["sfu"],
    },
    {
      problem: "Poor networks cause freezes",
      fix: "Simulcast and congestion control let the SFU switch each viewer to a lower layer.",
      nodes: ["sfu", "metrics"],
    },
  ],

  scaling: [
    "Place SFUs and TURN servers in many regions; choose by participant location.",
    "Keep signalling stateless with room state in a shared cache.",
    "Autoscale SFUs on bandwidth, not CPU.",
  ],

  extensions: [
    "Live captions using speech-to-text on forked audio.",
    "Large-audience broadcast by converting to HLS.",
    "End-to-end encryption with insertable streams.",
  ],
};
