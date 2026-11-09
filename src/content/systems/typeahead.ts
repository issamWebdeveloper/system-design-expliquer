import type { SystemDesignInput } from "@/types/schema";

export const typeahead: SystemDesignInput = {
  slug: "typeahead",
  name: "Search autocomplete",
  tagline: "Suggestions on every keystroke in under 100 ms",
  description:
    "Suggestions are precomputed: an offline job turns query logs into tries that store the top completions at every prefix, so answering a keystroke is a single lookup. Tries are sharded by prefix, hot prefixes sit in memory and even at the CDN edge, and a stream job boosts queries that are trending right now.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["prefix-trie", "caching", "sharding", "leader-election", "event-driven"],

  requirements: {
    functional: [
      "Return the top 5–10 completions for the text typed so far",
      "Rank by popularity, freshness and (optionally) the user's history and locale",
      "Reflect trending queries within minutes",
      "Filter offensive or blocked suggestions",
    ],
    nonFunctional: [
      "p99 under ~100 ms end to end so suggestions keep up with typing",
      "Very read-heavy: one request per keystroke",
      "Highly available; stale suggestions are acceptable, missing ones aren't",
    ],
  },

  apis: [
    { method: "GET", path: "/suggest?q=&locale=&limit=", purpose: "Top completions for a prefix (cacheable)" },
    { method: "POST", path: "/search", purpose: "The submitted query, which also feeds the query log" },
  ],

  estimates: [
    { label: "Searches", value: "≈ 100 M/day", derivation: "Assumption" },
    { label: "Suggestion requests", value: "≈ 10 k/s avg, ~30 k/s peak", derivation: "100 M searches × ~8 keystrokes ÷ 86,400 s; debouncing cuts this" },
    { label: "Trie size", value: "≈ 10–20 GB per locale", derivation: "~100 M distinct queries × prefixes × top-k lists; split across shards" },
    { label: "Latency budget", value: "< 50 ms server-side", derivation: "Leaves room for the network within a 100 ms target" },
  ],

  dataModel: [
    {
      entity: "Trie node",
      store: "Key-value store (serialised trie shards)",
      key: "locale + prefix",
      fields: ["topK [{query, score}]", "children"],
      why: "Precomputed top-k per prefix means no ranking at query time",
    },
    {
      entity: "Query log",
      store: "Event stream → object storage",
      key: "time",
      fields: ["query", "locale", "userId?", "clicked"],
      why: "Raw material for rebuilding tries and spotting trends",
    },
    {
      entity: "Shard map",
      store: "Coordination store",
      key: "prefix range",
      fields: ["shardId", "trieVersion"],
      why: "Lets every server route a prefix to the right shard and swap versions atomically",
    },
  ],

  nodes: [
    { id: "client", kind: "web-client", label: "Search box", role: "Sends the prefix after a short debounce" },
    { id: "edge", kind: "cdn", label: "Edge cache", role: "Caches suggestions for very common short prefixes" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Routing and rate limiting" },
    { id: "suggest-svc", kind: "service", label: "Suggestion service", role: "Finds the shard for a prefix and returns its top-k" },
    { id: "hot-cache", kind: "cache", label: "Hot prefix cache", role: "In-memory top-k for the most typed prefixes" },
    { id: "trie-store", kind: "nosql-db", label: "Trie shards", role: "Serialised tries, sharded by prefix range" },
    { id: "shard-map", kind: "coordination", label: "Shard map", role: "Prefix range → shard and active trie version" },
    { id: "query-log", kind: "event-stream", label: "Query log", role: "Every submitted search" },
    { id: "log-archive", kind: "object-storage", label: "Log archive", role: "Days of query history for rebuilding" },
    { id: "builder", kind: "batch-processing", label: "Trie builder", role: "Aggregates logs and builds new tries offline" },
    { id: "trending", kind: "stream-processor", label: "Trending detector", role: "Counts queries in short windows and boosts spikes" },
  ],

  edges: [
    { id: "client-edge", from: "client", to: "edge", label: "GET /suggest" },
    { id: "edge-gateway", from: "edge", to: "gateway", label: "Miss" },
    { id: "gateway-suggest", from: "gateway", to: "suggest-svc", protocol: "grpc" },
    { id: "suggest-shardmap", from: "suggest-svc", to: "shard-map", label: "Which shard?" },
    { id: "suggest-cache", from: "suggest-svc", to: "hot-cache" },
    { id: "suggest-trie", from: "suggest-svc", to: "trie-store" },
    { id: "gateway-log", from: "gateway", to: "query-log", label: "Submitted searches", protocol: "stream" },
    { id: "log-archive-write", from: "query-log", to: "log-archive", protocol: "stream" },
    { id: "archive-builder", from: "log-archive", to: "builder", label: "Daily logs" },
    { id: "builder-trie", from: "builder", to: "trie-store", label: "Publish new tries" },
    { id: "builder-shardmap", from: "builder", to: "shard-map", label: "Switch version" },
    { id: "log-trending", from: "query-log", to: "trending", protocol: "stream" },
    { id: "trending-cache", from: "trending", to: "hot-cache", label: "Boost trending" },
  ],

  flows: [
    {
      id: "suggest",
      name: "Type a letter",
      steps: [
        { edge: "client-edge", text: "After ~100 ms without typing, the box sends the prefix; very common prefixes are answered at the edge." },
        { edge: "edge-gateway", text: "Less common prefixes reach the gateway." },
        { edge: "gateway-suggest", text: "The suggestion service takes the request." },
        { edge: "suggest-shardmap", text: "Its locally cached shard map says which shard owns this prefix." },
        { edge: "suggest-cache", text: "Hot prefixes come straight from memory…" },
        { edge: "suggest-trie", text: "…others are one lookup in the trie shard, which already holds the top-k list." },
      ],
    },
    {
      id: "rebuild",
      name: "Refresh suggestions",
      steps: [
        { edge: "gateway-log", text: "Every submitted search is logged." },
        { edge: "log-archive-write", text: "Logs are archived to object storage." },
        { edge: "archive-builder", text: "A daily job counts queries with time decay and filters blocked terms." },
        { edge: "builder-trie", text: "It builds new tries with top-k lists at each prefix and uploads them." },
        { edge: "builder-shardmap", text: "The shard map flips to the new version atomically." },
        { edge: "log-trending", text: "Meanwhile a stream job watches for sudden spikes…" },
        { edge: "trending-cache", text: "…and injects trending queries into the hot cache within minutes." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "A request on every keystroke",
      fix: "Debounce on the client, cache short prefixes at the edge and in memory, and keep lookups O(prefix length).",
      nodes: ["client", "edge", "hot-cache"],
    },
    {
      problem: "Uneven shards (far more queries start with 's' than 'x')",
      fix: "Split by measured traffic rather than alphabet, and replicate hot shards.",
      nodes: ["trie-store", "shard-map"],
    },
    {
      problem: "Tries go stale between rebuilds",
      fix: "Blend a fast trending layer on top of the daily build.",
      nodes: ["trending", "hot-cache"],
    },
  ],

  scaling: [
    "Replicate each trie shard several times and load-balance reads.",
    "Build tries per locale and serve them from the nearest region.",
    "Stateless suggestion servers scale horizontally.",
    "Rebuild offline so query serving never competes with aggregation work.",
  ],

  extensions: [
    "Personalised suggestions mixed in from the user's own history.",
    "Spelling correction for typos.",
    "Rich suggestions (entities with images) for people, places and products.",
  ],
};
