import type { SystemDesignInput } from "@/types/schema";

export const astrotalk: SystemDesignInput = {
  slug: "astrotalk",
  name: "AstroTalk",
  tagline: "Pay-per-minute chat and calls with astrologers",
  description:
    "Users top up a prepaid wallet and start chat, voice or video sessions with online astrologers, billed per minute. Before a session starts the system reserves enough balance for a few minutes; a metering service then deducts each minute in the ledger and ends the session when funds run out. Chats run over WebSockets, calls over WebRTC or a telephony partner, and birth-chart calculations are computed on demand.",
  category: "bookings",
  difficulty: 2,
  concepts: ["websockets", "ledger", "idempotency", "webrtc", "event-driven"],

  requirements: {
    functional: [
      "Browse astrologers by language, specialty, price and rating; see who is online",
      "Prepaid wallet with top-ups",
      "Instant chat, voice or video sessions billed per minute",
      "Scheduled sessions, birth charts (kundli) and horoscopes",
      "Astrologer earnings and payouts",
    ],
    nonFunctional: [
      "Billing is exact: never charge for time not delivered, never let balance go negative",
      "Thousands of concurrent sessions with real-time messaging",
      "Astrologer online status accurate within seconds",
    ],
  },

  apis: [
    { method: "GET", path: "/astrologers?online=true&lang=", purpose: "Available astrologers with per-minute price" },
    { method: "POST", path: "/wallet/topups", purpose: "Add money to the wallet" },
    { method: "POST", path: "/sessions", purpose: "Start a chat/call; reserves balance for the first minutes" },
    { method: "WS", path: "/sessions/{id}/chat", purpose: "Messages, typing, session timer" },
    { method: "POST", path: "/sessions/{id}/end", purpose: "End and settle the session" },
  ],

  estimates: [
    { label: "Sessions", value: "≈ 100 k/day", derivation: "Assumption" },
    { label: "Concurrent sessions", value: "≈ 5–10 k at peak", derivation: "Average ~10 minutes, evening peak" },
    { label: "Billing ticks", value: "≈ 170 /s at peak", derivation: "10 k sessions ÷ one charge per minute" },
    { label: "Astrologers online", value: "≈ 5 k", derivation: "Assumption" },
  ],

  dataModel: [
    {
      entity: "Wallet ledger",
      store: "Relational DB (append-only)",
      key: "entryId",
      fields: ["userId", "amount", "type (topup/charge/refund)", "sessionId", "minute"],
      why: "Balances derived from entries; (sessionId, minute) is unique so a minute can't be charged twice",
    },
    {
      entity: "Session",
      store: "Relational DB",
      key: "sessionId",
      fields: ["userId", "astrologerId", "mode", "ratePerMin", "startedAt", "endedAt", "status"],
      why: "Lifecycle and billing basis",
    },
    {
      entity: "Presence",
      store: "In-memory cache",
      key: "astrologerId",
      fields: ["status (online/busy/offline)", "lastSeen"],
      why: "Updated constantly; read on every browse",
    },
  ],

  nodes: [
    { id: "user", kind: "mobile-client", label: "User app", role: "Browse, top up, chat and call" },
    { id: "astrologer", kind: "mobile-client", label: "Astrologer app", role: "Go online, take sessions, see earnings" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth and routing" },
    { id: "discovery", kind: "service", label: "Discovery", role: "Lists astrologers with live presence" },
    { id: "presence", kind: "cache", label: "Presence", role: "Online/busy status" },
    { id: "session-svc", kind: "service", label: "Session service", role: "Starts, tracks and ends sessions" },
    { id: "wallet-svc", kind: "service", label: "Wallet service", role: "Balance, reservations and top-ups" },
    { id: "meter", kind: "service", label: "Billing meter", role: "Charges each minute; ends sessions on low balance" },
    { id: "ledger", kind: "relational-db", label: "Wallet ledger", role: "Double-entry wallet movements" },
    { id: "chat", kind: "realtime-gateway", label: "Chat gateway", role: "Session messages and timers" },
    { id: "calls", kind: "webrtc-media", label: "Calls (WebRTC / telephony)", role: "Voice and video sessions" },
    { id: "charts", kind: "serverless", label: "Chart computation", role: "Birth charts from date, time and place" },
    { id: "payment-svc", kind: "service", label: "Top-ups & payouts", role: "Wallet top-ups, astrologer payouts" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards" },
    { id: "events", kind: "event-stream", label: "Session events", role: "Started, minute charged, ended" },
    { id: "notify", kind: "notifications", label: "Push", role: "Session requests and offers" },
  ],

  edges: [
    { id: "user-gateway", from: "user", to: "gateway" },
    { id: "astrologer-gateway", from: "astrologer", to: "gateway" },
    { id: "gateway-discovery", from: "gateway", to: "discovery", protocol: "grpc" },
    { id: "discovery-presence", from: "discovery", to: "presence" },
    { id: "gateway-session", from: "gateway", to: "session-svc", protocol: "grpc" },
    { id: "session-wallet", from: "session-svc", to: "wallet-svc", label: "Reserve balance", protocol: "grpc" },
    { id: "wallet-ledger", from: "wallet-svc", to: "ledger" },
    { id: "session-events", from: "session-svc", to: "events", protocol: "stream" },
    { id: "events-meter", from: "events", to: "meter", protocol: "async" },
    { id: "meter-wallet", from: "meter", to: "wallet-svc", label: "Charge minute", protocol: "grpc" },
    { id: "meter-session", from: "meter", to: "session-svc", label: "End on low balance" },
    { id: "user-chat", from: "user", to: "chat", protocol: "ws" },
    { id: "astrologer-chat", from: "astrologer", to: "chat", protocol: "ws" },
    { id: "user-calls", from: "user", to: "calls", label: "Voice / video" },
    { id: "astrologer-calls", from: "astrologer", to: "calls" },
    { id: "gateway-charts", from: "gateway", to: "charts", label: "Kundli" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "payment-ledger", from: "payment-svc", to: "ledger", label: "Top-ups" },
    { id: "session-notify", from: "session-svc", to: "notify" },
  ],

  flows: [
    {
      id: "session",
      name: "Paid chat session",
      steps: [
        { edge: "user-gateway", text: "The user opens the list of online astrologers." },
        { edge: "gateway-discovery", text: "Discovery returns astrologers…" },
        { edge: "discovery-presence", text: "…filtered to those online and not busy." },
        { edge: "gateway-session", text: "The user starts a chat at ₹30/min." },
        { edge: "session-wallet", text: "The wallet reserves balance for the first 3 minutes; too little balance means no session." },
        { edge: "wallet-ledger", text: "The reservation is recorded." },
        { edge: "session-notify", text: "The astrologer gets a request and accepts." },
        { edge: "user-chat", text: "Both are connected through the chat gateway." },
        { edge: "session-events", text: "'Session started' is published." },
        { edge: "events-meter", text: "The billing meter starts its per-minute clock." },
        { edge: "meter-wallet", text: "Each minute is charged exactly once (unique per session and minute)." },
        { edge: "meter-session", text: "When the balance can't cover the next minute, the session is ended with a warning first." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Billing drift and double charges",
      fix: "Append-only ledger with a unique key per (session, minute); settle from server-side timestamps, not the client.",
      nodes: ["meter", "ledger"],
    },
    {
      problem: "Balance running out mid-session",
      fix: "Reserve a few minutes up front, top up the reservation as time passes, warn before ending.",
      nodes: ["wallet-svc", "meter"],
    },
    {
      problem: "Stale presence showing busy astrologers as online",
      fix: "Heartbeats with short TTLs; mark busy when a session starts.",
      nodes: ["presence", "session-svc"],
    },
  ],

  scaling: [
    "Scale chat and call tiers independently from the API.",
    "Shard the ledger by userId.",
    "Precompute popular horoscopes; compute personal charts on demand and cache them.",
  ],

  extensions: [
    "Live group sessions with gifting.",
    "Scheduled consultations with reminders.",
    "Product store (gemstones, puja services).",
  ],
};
