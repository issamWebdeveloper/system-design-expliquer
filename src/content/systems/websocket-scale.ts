import type { SystemDesignInput } from "@/types/schema";

export const websocketScale: SystemDesignInput = {
  slug: "websocket-scale",
  name: "WebSockets at scale",
  tagline: "Millions of live connections with Go on Kubernetes",
  description:
    "A reusable real-time layer: lightweight Go gateway pods hold millions of WebSocket connections behind an L4 load balancer. Backend services publish events to a durable bus; a router looks up which gateway pod each recipient is connected to and forwards the event over a per-pod pub/sub channel, which pushes it down the socket. Offline recipients' events are stored for when they reconnect.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["websockets", "consistent-hashing", "back-pressure", "event-driven", "horizontal-scaling"],

  requirements: {
    functional: [
      "Clients keep a persistent connection and receive events in real time",
      "Backend services can send to one user, a group (room) or everyone",
      "Presence: know who is online",
      "Deliver missed events after a reconnect",
    ],
    nonFunctional: [
      "Millions of concurrent connections",
      "Delivery latency under ~100 ms",
      "Gateway pods can be added, removed or restarted without losing events",
      "Per-connection memory stays small",
    ],
  },

  apis: [
    { method: "WS", path: "/connect?token=", purpose: "Open a connection; the token is checked once at connect" },
    { method: "WS", path: "← event { type, payload, seq }", purpose: "Server push; clients ack by sequence number" },
    { method: "POST", path: "/internal/publish", purpose: "Backends publish { recipients | room, event } to the bus" },
    { method: "GET", path: "/internal/presence/{userId}", purpose: "Online status and connected devices" },
  ],

  estimates: [
    { label: "Concurrent connections", value: "≈ 10 M", derivation: "Assumption" },
    { label: "Connections per pod", value: "≈ 50–100 k", derivation: "~10–20 KB per connection in Go → 1–2 GB RAM per 100 k" },
    { label: "Gateway pods", value: "≈ 100–200", derivation: "10 M ÷ 50–100 k, with headroom for failover" },
    { label: "Heartbeats", value: "≈ 330 k/s", derivation: "10 M connections ÷ one ping every 30 s" },
  ],

  dataModel: [
    {
      entity: "Connection",
      store: "In-memory registry",
      key: "userId + deviceId",
      fields: ["podId", "connectedAt", "lastSeen"],
      why: "Routing needs 'which pod holds this user?' in one lookup",
    },
    {
      entity: "Room membership",
      store: "In-memory registry",
      key: "roomId",
      fields: ["set of userIds"],
      why: "Fan-out to groups",
    },
    {
      entity: "Pending event",
      store: "Key-value DB with TTL",
      key: "userId + seq",
      fields: ["payload", "createdAt"],
      why: "Replay to clients that were offline",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "Mobile clients", role: "Hold one connection each" },
    { id: "web", kind: "web-client", label: "Web clients", role: "Hold one connection per tab" },
    { id: "nlb", kind: "load-balancer", label: "L4 load balancer", role: "Spreads long-lived TCP connections across pods" },
    { id: "gateway", kind: "realtime-gateway", label: "Gateway pods (Go)", role: "Hold sockets, verify tokens, push events" },
    { id: "identity", kind: "identity", label: "Token validation", role: "Issues and verifies JWTs" },
    { id: "registry", kind: "cache", label: "Connection registry", role: "userId → pod, rooms and presence" },
    { id: "backends", kind: "service", label: "Backend services", role: "Chat, notifications, live scores …" },
    { id: "bus", kind: "event-stream", label: "Event bus", role: "Durable, ordered stream of outgoing events" },
    { id: "router", kind: "service", label: "Fan-out router", role: "Resolves recipients to pods" },
    { id: "pubsub", kind: "message-queue", label: "Per-pod channels", role: "Low-latency pub/sub to each gateway pod" },
    { id: "pending", kind: "nosql-db", label: "Pending events", role: "Events for offline users" },
    { id: "metrics", kind: "observability", label: "Metrics", role: "Connections, lag and drops per pod" },
  ],

  edges: [
    { id: "mobile-nlb", from: "mobile", to: "nlb", protocol: "ws" },
    { id: "web-nlb", from: "web", to: "nlb", protocol: "ws" },
    { id: "nlb-gateway", from: "nlb", to: "gateway", protocol: "ws" },
    { id: "gateway-identity", from: "gateway", to: "identity", label: "Verify token" },
    { id: "gateway-registry", from: "gateway", to: "registry", label: "Register / heartbeat" },
    { id: "backends-bus", from: "backends", to: "bus", label: "Publish", protocol: "stream" },
    { id: "bus-router", from: "bus", to: "router", protocol: "async" },
    { id: "router-registry", from: "router", to: "registry", label: "Where is the user?" },
    { id: "router-pubsub", from: "router", to: "pubsub", label: "To pod channel" },
    { id: "pubsub-gateway", from: "pubsub", to: "gateway", label: "Deliver", protocol: "stream" },
    { id: "router-pending", from: "router", to: "pending", label: "Offline" },
    { id: "gateway-pending", from: "gateway", to: "pending", label: "Replay on reconnect" },
    { id: "gateway-metrics", from: "gateway", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "connect",
      name: "Connect",
      steps: [
        { edge: "mobile-nlb", text: "The app opens a WebSocket with its token." },
        { edge: "nlb-gateway", text: "The L4 balancer picks a gateway pod with spare capacity." },
        { edge: "gateway-identity", text: "The pod verifies the token once." },
        { edge: "gateway-registry", text: "It records userId → this pod, and keeps it fresh with heartbeats." },
        { edge: "gateway-pending", text: "Any events missed while offline are replayed in order." },
      ],
    },
    {
      id: "deliver",
      name: "Deliver an event",
      steps: [
        { edge: "backends-bus", text: "A backend publishes an event for a user or room." },
        { edge: "bus-router", text: "Router workers consume the bus (partitioned so each user's events stay in order)." },
        { edge: "router-registry", text: "They look up which pods hold the recipients' connections." },
        { edge: "router-pubsub", text: "The event goes to each pod's channel." },
        { edge: "pubsub-gateway", text: "The pod writes it to the sockets; clients ack by sequence number." },
        { edge: "router-pending", text: "Recipients with no live connection get the event stored for later." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Memory per connection",
      fix: "Go's lightweight goroutines plus small buffers; epoll-style readers for very large pods.",
      nodes: ["gateway"],
    },
    {
      problem: "Reconnect storms after a deploy or crash",
      fix: "Drain pods gradually, add jittered client backoff, and autoscale before rolling out.",
      nodes: ["gateway", "nlb"],
    },
    {
      problem: "Slow clients backing up the pod",
      fix: "Bounded per-connection send queues; drop or disconnect clients that fall too far behind.",
      nodes: ["gateway", "pubsub"],
    },
    {
      problem: "Broadcast to millions",
      fix: "Send once per pod, not per user, and let each pod fan out locally.",
      nodes: ["router", "pubsub"],
    },
  ],

  scaling: [
    "Autoscale gateway pods on connection count and CPU.",
    "Shard the registry with consistent hashing; entries expire if heartbeats stop.",
    "Partition the bus by recipient to keep per-user ordering.",
    "Deploy per region and forward cross-region events over the bus.",
  ],

  extensions: [
    "Server-Sent Events fallback for restrictive networks.",
    "Per-tenant rate limits on publishing.",
    "End-to-end delivery receipts surfaced to backends.",
  ],
};
