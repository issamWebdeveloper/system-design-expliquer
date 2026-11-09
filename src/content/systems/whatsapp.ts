import type { SystemDesignInput } from "@/types/schema";

export const whatsapp: SystemDesignInput = {
  slug: "whatsapp",
  name: "WhatsApp / Messenger",
  tagline: "Billions of real-time messages per day",
  description:
    "Each phone keeps one persistent WebSocket connection to a chat server. A session registry records which server each user is connected to, so a message can be stored, routed to the recipient's server over an internal bus and pushed down their socket in milliseconds. If the recipient is offline the message waits in the store and a push notification wakes their phone.",
  category: "media-social",
  difficulty: 2,
  concepts: ["websockets", "consistent-hashing", "sharding", "presigned-urls", "idempotency", "multi-region"],

  requirements: {
    functional: [
      "One-to-one and group chats with instant delivery",
      "Persistent history, synced across a user's devices",
      "Sent, delivered and read receipts; typing indicators; online/last-seen presence",
      "Send photos, video, voice notes and documents",
      "Push notifications when the app is closed",
    ],
    nonFunctional: [
      "Sub-second delivery between online users",
      "No message is lost once the sender sees a single tick",
      "Messages appear in the same order for everyone in a conversation",
      "Millions of concurrent connections and billions of messages per day",
      "End-to-end encryption: servers relay ciphertext only",
    ],
  },

  apis: [
    { method: "WS", path: "/socket → send(conversationId, clientMsgId, payload)", purpose: "Send a message over the open connection; clientMsgId makes retries idempotent" },
    { method: "WS", path: "/socket ← message / ack / receipt / typing / presence", purpose: "Server pushes new messages, delivery acks, read receipts and presence changes" },
    { method: "GET", path: "/conversations?cursor=", purpose: "List chats with their latest message" },
    { method: "GET", path: "/conversations/{id}/messages?before=", purpose: "Load older history when scrolling up" },
    { method: "POST", path: "/conversations", purpose: "Create a group and add members" },
    { method: "POST", path: "/media", purpose: "Get a pre-signed URL to upload an attachment" },
  ],

  estimates: [
    { label: "Daily active users", value: "≈ 100 M", derivation: "Assumption: 10% of ~1 B registered users" },
    { label: "Messages", value: "≈ 2 B/day (~23 k/s)", derivation: "100 M users × 20 messages ÷ 86,400 s; peaks 3–5×" },
    { label: "Message storage", value: "≈ 1 TB/day", derivation: "2 B × ~500 bytes incl. metadata, before 3× replication" },
    { label: "Concurrent connections", value: "≈ 10 M", derivation: "Online at peak; ~50 k sockets per server → ~200 chat servers" },
    { label: "Text bandwidth", value: "≈ 12 MB/s", derivation: "23 k msg/s × 500 bytes; media goes via storage and CDN instead" },
  ],

  dataModel: [
    {
      entity: "Message",
      store: "Wide-column DB (e.g. Cassandra)",
      key: "conversationId + messageId (time-sortable)",
      fields: ["senderId", "ciphertext", "attachmentUrl", "createdAt"],
      why: "Append-only, partitioned per conversation so history is one range scan",
    },
    {
      entity: "Delivery status",
      store: "Wide-column DB",
      key: "messageId + recipientId",
      fields: ["deliveredAt", "readAt"],
      why: "Receipts per recipient, especially in groups",
    },
    {
      entity: "Conversation / Membership",
      store: "Relational DB",
      key: "conversationId + userId",
      fields: ["type (direct/group)", "name", "role", "lastReadMessageId"],
      why: "Small, relational, needs consistent membership checks",
    },
    {
      entity: "Session",
      store: "In-memory cache",
      key: "userId + deviceId",
      fields: ["chatServerId", "connectedAt", "lastSeen"],
      why: "Looked up on every message to find where to deliver; expires on disconnect",
    },
    {
      entity: "User",
      store: "Relational DB",
      key: "userId",
      fields: ["phone", "name", "avatarUrl", "publicKeys"],
      why: "Account data and encryption keys",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Keeps a socket open, encrypts messages end-to-end" },
    { id: "web", kind: "web-client", label: "Web / desktop", role: "Linked device that syncs with the phone" },
    { id: "chat-lb", kind: "load-balancer", label: "Connection load balancer", role: "Spreads long-lived WebSocket connections (L4)" },
    { id: "api-lb", kind: "load-balancer", label: "API load balancer", role: "Routes HTTPS requests for history, groups and media" },
    { id: "chat-gw", kind: "realtime-gateway", label: "Chat servers", role: "Hold user connections; receive, store and push messages" },
    { id: "api-svc", kind: "service", label: "API service", role: "Login, conversation list, history, groups" },
    { id: "notify-svc", kind: "service", label: "Offline notifier", role: "Sends a push when the recipient isn't connected" },
    { id: "bus", kind: "event-stream", label: "Message bus", role: "Routes messages between chat servers" },
    { id: "sessions", kind: "cache", label: "Session registry", role: "userId → chat server, plus presence" },
    { id: "message-db", kind: "wide-column-db", label: "Message store", role: "Every message, partitioned by conversation" },
    { id: "user-db", kind: "relational-db", label: "Users & groups", role: "Accounts, conversations and memberships" },
    { id: "media-store", kind: "object-storage", label: "Media storage", role: "Encrypted attachments" },
    { id: "cdn", kind: "cdn", label: "Media CDN", role: "Downloads of popular attachments" },
    { id: "push", kind: "notifications", label: "Push notifications", role: "APNs / FCM wake-ups" },
  ],

  edges: [
    { id: "mobile-chat", from: "mobile", to: "chat-lb", label: "WebSocket", protocol: "ws" },
    { id: "web-chat", from: "web", to: "chat-lb", protocol: "ws" },
    { id: "chat-lb-gw", from: "chat-lb", to: "chat-gw", protocol: "ws" },
    { id: "mobile-api", from: "mobile", to: "api-lb", label: "HTTPS" },
    { id: "web-api", from: "web", to: "api-lb" },
    { id: "api-lb-svc", from: "api-lb", to: "api-svc" },
    { id: "gw-sessions", from: "chat-gw", to: "sessions", label: "Find recipient" },
    { id: "gw-store", from: "chat-gw", to: "message-db", label: "Persist" },
    { id: "gw-bus", from: "chat-gw", to: "bus", label: "Route", protocol: "stream" },
    { id: "bus-gw", from: "bus", to: "chat-gw", label: "Deliver", protocol: "stream" },
    { id: "bus-notify", from: "bus", to: "notify-svc", label: "Offline", protocol: "async" },
    { id: "notify-push", from: "notify-svc", to: "push" },
    { id: "api-history", from: "api-svc", to: "message-db", label: "History" },
    { id: "api-users", from: "api-svc", to: "user-db" },
    { id: "mobile-upload", from: "mobile", to: "media-store", label: "Upload (pre-signed)" },
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Download" },
    { id: "cdn-origin", from: "cdn", to: "media-store" },
  ],

  flows: [
    {
      id: "online",
      name: "Message to an online friend",
      steps: [
        { edge: "mobile-chat", text: "Alice's app sends the encrypted message over its open socket, tagged with a client message ID." },
        { edge: "chat-lb-gw", text: "It arrives at the chat server holding Alice's connection." },
        { edge: "gw-store", text: "The server stores it; Alice now sees one tick (sent)." },
        { edge: "gw-sessions", text: "It looks up which chat server Bob is connected to." },
        { edge: "gw-bus", text: "The message is published for Bob's server." },
        { edge: "bus-gw", text: "Bob's server pushes it down his socket. His app acks, and Alice sees two ticks (delivered)." },
      ],
    },
    {
      id: "offline",
      name: "Message to an offline friend",
      steps: [
        { edge: "mobile-chat", text: "Alice sends a message while Bob's phone is asleep." },
        { edge: "chat-lb-gw", text: "It reaches the chat server holding Alice's connection." },
        { edge: "gw-store", text: "It's stored durably, so nothing is lost." },
        { edge: "gw-sessions", text: "The registry shows Bob has no live connection." },
        { edge: "gw-bus", text: "The message is routed as an offline delivery." },
        { edge: "bus-notify", text: "The offline notifier picks it up." },
        { edge: "notify-push", text: "A push notification wakes Bob's phone." },
        { edge: "mobile-api", text: "Bob's app reconnects and asks for anything it missed." },
        { edge: "api-history", text: "Missed messages are read from the store, newest-to-oldest, and receipts flow back to Alice." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Each chat server can hold only so many open sockets",
      fix: "Run hundreds of servers with async I/O behind an L4 balancer; drain connections gradually on deploys to avoid reconnect storms.",
      nodes: ["chat-lb", "chat-gw"],
    },
    {
      problem: "The session registry is hit on every message",
      fix: "Shard it by userId with consistent hashing, keep it in memory, and cache recent lookups on each chat server.",
      nodes: ["sessions"],
    },
    {
      problem: "Billions of writes per day",
      fix: "Write-optimised store partitioned by conversation; batch writes; add nodes as volume grows.",
      nodes: ["message-db"],
    },
    {
      problem: "Large groups multiply every message",
      fix: "Store each group message once and fan out only delivery notifications; cap group size.",
      nodes: ["bus", "chat-gw"],
    },
  ],

  scaling: [
    "Shard messages by conversationId and users by userId.",
    "Replicate the message store (replication factor 3) across zones; any node can fail without loss.",
    "Route users to the nearest region with geo-DNS; forward cross-region messages over the bus.",
    "Keep API servers stateless; only chat servers hold connection state, and that state is rebuilt on reconnect.",
    "Send media via object storage and CDN so chat servers only carry small text payloads.",
  ],

  extensions: [
    "End-to-end encryption with per-device keys (Signal protocol).",
    "Voice and video calls using WebRTC with TURN relays.",
    "Message search on the device (since servers can't read content).",
    "Disappearing messages with TTL on storage.",
  ],
};
