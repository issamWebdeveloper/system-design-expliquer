import type { SystemDesignInput } from "@/types/schema";

export const stockBrokerage: SystemDesignInput = {
  slug: "stock-brokerage",
  name: "Stock brokerage",
  tagline: "Live quotes, order placement and portfolios",
  description:
    "Two very different flows share one platform. Market data streams from exchanges, is normalised, and is pushed to millions of screens over WebSockets. Orders go the other way: an order management system validates each one, a risk system checks margin and limits, and an exchange gateway sends it over FIX. Fills flow back to update positions and a funds ledger.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["websockets", "ledger", "idempotency", "event-driven", "back-pressure"],

  requirements: {
    functional: [
      "Live prices, charts and market depth",
      "Place, modify and cancel market, limit and stop orders",
      "Margin and risk checks before an order leaves",
      "Positions, holdings, P&L and funds",
      "Order and trade notifications",
    ],
    nonFunctional: [
      "Order path latency in milliseconds",
      "Market open bursts (many times normal load)",
      "Every order and fill auditable; balances always correct",
      "Regulatory compliance and high availability during market hours",
    ],
  },

  apis: [
    { method: "WS", path: "/marketdata?symbols=", purpose: "Subscribe to live quotes and depth" },
    { method: "POST", path: "/orders", purpose: "Place an order (client order id for idempotency)" },
    { method: "PATCH", path: "/orders/{id}", purpose: "Modify price or quantity" },
    { method: "DELETE", path: "/orders/{id}", purpose: "Cancel" },
    { method: "GET", path: "/portfolio", purpose: "Holdings, positions, P&L and funds" },
  ],

  estimates: [
    { label: "Active traders", value: "≈ 5 M daily", derivation: "Assumption" },
    { label: "Orders", value: "≈ 10 M/day, peaks 10–20 k/s", derivation: "Heavily concentrated at market open" },
    { label: "Quote updates in", value: "≈ 100 k+ ticks/s", derivation: "Thousands of instruments updating many times a second" },
    { label: "WebSocket fan-out", value: "Millions of messages/s", derivation: "5 M clients × watchlist symbols; conflated per client" },
  ],

  dataModel: [
    {
      entity: "Order",
      store: "Relational DB",
      key: "orderId (+ clientOrderId unique)",
      fields: ["userId", "symbol", "side", "type", "qty", "price", "status", "exchangeOrderId"],
      why: "Auditable state machine: new → open → partially filled → filled / cancelled",
    },
    {
      entity: "Trade (fill)",
      store: "Relational DB (append-only)",
      key: "tradeId",
      fields: ["orderId", "qty", "price", "time"],
      why: "Immutable record from the exchange",
    },
    {
      entity: "Funds ledger",
      store: "Relational DB (double-entry)",
      key: "entryId",
      fields: ["userId", "amount", "type (deposit/block/settle)", "orderId"],
      why: "Margin blocked at order time, settled on fills",
    },
    {
      entity: "Quote",
      store: "In-memory cache",
      key: "symbol",
      fields: ["last", "bid", "ask", "volume", "time"],
      why: "Latest snapshot for new subscribers",
    },
  ],

  nodes: [
    { id: "app", kind: "mobile-client", label: "Trading app", role: "Watchlists, charts, orders" },
    { id: "web", kind: "web-client", label: "Web terminal", role: "Charts and order entry" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, sessions, rate limits" },
    { id: "oms", kind: "service", label: "Order management (OMS)", role: "Validates, tracks and routes orders" },
    { id: "rms", kind: "service", label: "Risk management (RMS)", role: "Margin, limits and exposure checks" },
    { id: "exchange-gw", kind: "service", label: "Exchange gateway", role: "FIX sessions with exchanges" },
    { id: "exchanges", kind: "partner-api", label: "Stock exchanges", role: "Match orders; publish market data" },
    { id: "md-ingest", kind: "stream-processor", label: "Market data ingest", role: "Normalises exchange feeds" },
    { id: "md-stream", kind: "event-stream", label: "Market data stream", role: "Normalised ticks" },
    { id: "quote-cache", kind: "cache", label: "Quote cache", role: "Latest quote per symbol" },
    { id: "ws", kind: "realtime-gateway", label: "Streaming gateway", role: "Pushes quotes and order updates to clients" },
    { id: "order-db", kind: "relational-db", label: "Orders & trades", role: "Order book of record" },
    { id: "ledger", kind: "relational-db", label: "Funds & positions", role: "Ledger and holdings" },
    { id: "trade-events", kind: "event-stream", label: "Order & trade events", role: "Status changes and fills" },
    { id: "notify", kind: "notifications", label: "Alerts", role: "Order executed, price alerts" },
  ],

  edges: [
    { id: "app-gateway", from: "app", to: "gateway", label: "Orders" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "app-ws", from: "app", to: "ws", label: "Live quotes", protocol: "ws" },
    { id: "web-ws", from: "web", to: "ws", protocol: "ws" },
    { id: "gateway-oms", from: "gateway", to: "oms", protocol: "grpc" },
    { id: "oms-rms", from: "oms", to: "rms", label: "Margin check", protocol: "grpc" },
    { id: "rms-ledger", from: "rms", to: "ledger", label: "Block funds" },
    { id: "oms-db", from: "oms", to: "order-db" },
    { id: "oms-exchange-gw", from: "oms", to: "exchange-gw", protocol: "grpc" },
    { id: "exchange-gw-exchanges", from: "exchange-gw", to: "exchanges", label: "FIX" },
    { id: "exchanges-md", from: "exchanges", to: "md-ingest", label: "Feeds", protocol: "stream" },
    { id: "md-stream-write", from: "md-ingest", to: "md-stream", protocol: "stream" },
    { id: "md-cache", from: "md-stream", to: "quote-cache", protocol: "stream" },
    { id: "md-ws", from: "md-stream", to: "ws", protocol: "stream" },
    { id: "exchange-gw-events", from: "exchange-gw", to: "trade-events", label: "Fills", protocol: "stream" },
    { id: "events-ledger", from: "trade-events", to: "ledger", label: "Settle positions", protocol: "async" },
    { id: "events-ws", from: "trade-events", to: "ws", label: "Order updates", protocol: "stream" },
    { id: "events-notify", from: "trade-events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "order",
      name: "Place a buy order",
      steps: [
        { edge: "app-gateway", text: "The trader buys 100 shares at a limit price, with a client order id." },
        { edge: "gateway-oms", text: "The OMS validates the order (market hours, tick size, quantity)." },
        { edge: "oms-rms", text: "Risk checks margin and exposure limits." },
        { edge: "rms-ledger", text: "The required funds are blocked in the ledger." },
        { edge: "oms-db", text: "The order is recorded as OPEN." },
        { edge: "oms-exchange-gw", text: "It's handed to the exchange gateway." },
        { edge: "exchange-gw-exchanges", text: "The order goes to the exchange over FIX and gets matched." },
        { edge: "exchange-gw-events", text: "Fill reports come back and are published." },
        { edge: "events-ledger", text: "Positions are updated and blocked funds settled." },
        { edge: "events-ws", text: "The app sees 'filled' instantly." },
      ],
    },
    {
      id: "quotes",
      name: "Live quotes",
      steps: [
        { edge: "exchanges-md", text: "Exchanges broadcast ticks." },
        { edge: "md-stream-write", text: "Ingest normalises them into one format." },
        { edge: "md-cache", text: "The latest quote per symbol is cached for new subscribers." },
        { edge: "md-ws", text: "The streaming gateway pushes updates for each client's watchlist, merging fast-changing ticks so slow clients aren't flooded." },
        { edge: "app-ws", text: "Prices update on screen." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Market-open surge",
      fix: "Pre-scale before the open, queue orders in sequence per user, and keep the order path in memory with asynchronous persistence.",
      nodes: ["gateway", "oms"],
    },
    {
      problem: "Fanning out ticks to millions",
      fix: "Topic-per-symbol subscriptions and per-client conflation — send only the latest value at a capped rate.",
      nodes: ["ws", "md-stream"],
    },
    {
      problem: "Duplicate orders from retries",
      fix: "Unique client order ids; the OMS rejects repeats.",
      nodes: ["oms", "order-db"],
    },
  ],

  scaling: [
    "Partition OMS and RMS by user so each user's orders stay in order.",
    "Separate the market-data path from the order path.",
    "Active-passive standby with fast failover during market hours.",
  ],

  extensions: [
    "Options and derivatives with more complex margining.",
    "Algorithmic and basket orders.",
    "Tax reports and contract notes.",
  ],
};
