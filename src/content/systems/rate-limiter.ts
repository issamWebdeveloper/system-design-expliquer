import type { SystemDesignInput } from "@/types/schema";

export const rateLimiter: SystemDesignInput = {
  slug: "rate-limiter",
  name: "API rate limiter",
  tagline: "Fair-use limits checked on every request in under a millisecond",
  description:
    "Every API request passes through a limiter at the gateway, which atomically updates a counter (or token bucket) for that client in a shared in-memory store and returns allow or deny. Rules live in a config database and are pushed out to every limiter instance, so changes apply in seconds without redeploys. If the counter store is down, the limiter fails open rather than taking the API down with it.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["rate-limiting", "consistent-hashing", "caching", "leader-election"],

  requirements: {
    functional: [
      "Limit requests per client identity (user, API key or IP), e.g. 100 per minute",
      "Different limits per endpoint, plan or tier",
      "Return HTTP 429 with Retry-After and X-RateLimit-* headers when over the limit",
      "Admins can add or change rules without redeploying",
      "Report usage and denials for monitoring and billing",
    ],
    nonFunctional: [
      "Adds less than ~1–2 ms to each request",
      "Limits hold across many gateway instances (distributed, not per-server)",
      "Highly available; if the limiter fails, traffic keeps flowing (fail open)",
      "Small over-counting or under-counting at window edges is acceptable",
    ],
  },

  apis: [
    { method: "GRPC", path: "Check(clientId, route) → allow, remaining, resetAt", purpose: "Called by the gateway on every request" },
    { method: "GET", path: "/v1/usage?client=&route=", purpose: "Current usage and remaining quota" },
    { method: "POST", path: "/v1/rules", purpose: "Create a rule: { scope, match, limit, window, algorithm }" },
    { method: "PUT", path: "/v1/rules/{ruleId}", purpose: "Change a limit; propagates to all limiters within seconds" },
  ],

  estimates: [
    { label: "Checks (worst case)", value: "≈ 1.7 M/s", derivation: "1 M clients × 100 req/min ÷ 60 s" },
    { label: "Active counters", value: "≈ 5 M", derivation: "One per active client × rule" },
    { label: "Counter memory", value: "≈ 0.5–1 GB", derivation: "5 M × ~100–200 bytes per key" },
    { label: "Counter-store shards", value: "≈ 20", derivation: "1.7 M ops/s ÷ ~100 k ops/s per Redis shard" },
    { label: "Latency budget", value: "< 1 ms", derivation: "One round trip to an in-memory store in the same zone" },
  ],

  dataModel: [
    {
      entity: "Rule",
      store: "Relational DB (source of truth)",
      key: "ruleId",
      fields: ["scope (key/user/ip)", "match (route, plan)", "limit", "windowSec", "algorithm", "priority"],
      why: "Small, edited rarely, needs history and validation",
    },
    {
      entity: "Token bucket",
      store: "In-memory store (Redis hash)",
      key: "rl:{clientId}:{ruleId}",
      fields: ["tokens", "lastRefill"],
      why: "Refill and take in one atomic script; allows short bursts up to the bucket size",
    },
    {
      entity: "Fixed / sliding window counter",
      store: "In-memory store (Redis)",
      key: "rl:{clientId}:{ruleId}:{windowStart}",
      fields: ["count (TTL = window)"],
      why: "INCR + EXPIRE; sliding window blends the current and previous window counts",
    },
  ],

  nodes: [
    { id: "clients", kind: "web-client", label: "API clients", role: "Apps and integrations calling the API" },
    { id: "admin", kind: "web-client", label: "Admin console", role: "Edit limits per plan or customer" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Enforcement point: asks the limiter, returns 429 or forwards" },
    { id: "limiter", kind: "service", label: "Rate limiter", role: "Matches the request to rules and runs the algorithm (gateway plugin or sidecar)" },
    { id: "counters", kind: "cache", label: "Counter store", role: "Shared counters and token buckets, updated atomically with Lua scripts" },
    { id: "backend", kind: "service", label: "Backend APIs", role: "The services being protected" },
    { id: "rules-svc", kind: "service", label: "Rules service", role: "Validates and stores rule changes" },
    { id: "rules-db", kind: "relational-db", label: "Rules DB", role: "All rate-limit rules" },
    { id: "config", kind: "coordination", label: "Config distribution", role: "Pushes rule updates to every limiter (watch)" },
    { id: "metrics", kind: "observability", label: "Metrics & alerts", role: "Allowed/denied counts per client and route" },
  ],

  edges: [
    { id: "clients-gateway", from: "clients", to: "gateway", label: "API request" },
    { id: "gateway-limiter", from: "gateway", to: "limiter", label: "Allow?", protocol: "grpc" },
    { id: "limiter-counters", from: "limiter", to: "counters", label: "Atomic check + update" },
    { id: "gateway-backend", from: "gateway", to: "backend", label: "Allowed requests" },
    { id: "admin-rules", from: "admin", to: "rules-svc", label: "Edit rule" },
    { id: "rules-db-write", from: "rules-svc", to: "rules-db" },
    { id: "rules-config", from: "rules-svc", to: "config", label: "Publish" },
    { id: "config-limiter", from: "config", to: "limiter", label: "Rule updates", protocol: "async" },
    { id: "limiter-metrics", from: "limiter", to: "metrics", protocol: "async" },
  ],

  flows: [
    {
      id: "check",
      name: "Check a request",
      steps: [
        { edge: "clients-gateway", text: "A request arrives with an API key." },
        { edge: "gateway-limiter", text: "The gateway asks the limiter; the limiter finds the most specific rule from its local in-memory copy." },
        { edge: "limiter-counters", text: "One Lua script refills the bucket based on elapsed time, takes a token if available, and returns what's left — atomic, so concurrent gateways can't over-admit." },
        { edge: "gateway-backend", text: "Allowed: the request is forwarded with X-RateLimit-Remaining headers. Denied: the gateway returns 429 with Retry-After instead." },
        { edge: "limiter-metrics", text: "Allow/deny counts are emitted asynchronously." },
      ],
    },
    {
      id: "rule",
      name: "Change a limit",
      steps: [
        { edge: "admin-rules", text: "An admin raises a customer's limit to 1,000 per minute." },
        { edge: "rules-db-write", text: "The rule is validated and stored." },
        { edge: "rules-config", text: "The new version is published to the config store." },
        { edge: "config-limiter", text: "Every limiter is watching and swaps in the new rules within seconds — no redeploy." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Race conditions between gateway instances",
      fix: "Read-modify-write inside a single Lua script (or INCR) so each check is atomic in the store.",
      nodes: ["limiter", "counters"],
    },
    {
      problem: "The counter store adds latency to every request",
      fix: "Keep it in the same zone, pipeline calls, and for very high limits keep a local counter that syncs in batches.",
      nodes: ["counters", "limiter"],
    },
    {
      problem: "A single noisy client becomes a hot key",
      fix: "Hot keys are fine for one shard up to ~100 k ops/s; beyond that, split the bucket across sub-keys or count locally first.",
      nodes: ["counters"],
    },
    {
      problem: "Counter store outage",
      fix: "Fail open (allow) with a short timeout, fall back to per-instance local limits, and alert.",
      nodes: ["limiter", "metrics"],
    },
    {
      problem: "Global limits across regions",
      fix: "Give each region a share of the limit and rebalance periodically — exact global counts would need slow cross-region calls.",
      nodes: ["counters"],
    },
  ],

  scaling: [
    "Shard counters by clientId with consistent hashing across a Redis cluster.",
    "Run the limiter inside the gateway process or as a sidecar so there's no extra network hop.",
    "Cache rules locally in every limiter; the config store only pushes changes.",
    "Add counter-store shards as request volume grows; the limiter itself is stateless.",
  ],

  extensions: [
    "Concurrency limits (in-flight requests) in addition to rate limits.",
    "Adaptive limits that tighten automatically when backends are overloaded.",
    "Quotas billed per plan, with usage exported to billing.",
    "Per-IP limits at the CDN/WAF layer to absorb floods before they reach the gateway.",
  ],
};
