import type { SystemDesignInput } from "@/types/schema";

// Managed services expose a cluster endpoint; self-hosted clusters use cluster-aware clients or a proxy.
const endpoint = { aws: "ElastiCache cluster endpoint", gcp: "Memorystore cluster endpoint", azure: "Azure Managed Redis endpoint", oss: "Cluster-aware client / Envoy" };
const primary = { aws: "ElastiCache primary node", gcp: "Memorystore primary node", azure: "Azure Managed Redis primary", oss: "Redis primary" };
const replica = { aws: "ElastiCache replica", gcp: "Memorystore replica", azure: "Azure Managed Redis replica", oss: "Redis replica" };

export const redis: SystemDesignInput = {
  slug: "redis",
  name: "Redis Cluster",
  tagline: "Distributed in-memory data store",
  description:
    "Redis Cluster splits the key space into 16,384 hash slots spread across several primary nodes, each with one or more replicas. Clients hash each key to its slot and talk to the owning primary directly, following MOVED redirects when slots migrate. Primaries replicate asynchronously to their replicas, and the nodes themselves detect failures over the cluster bus and vote to promote a replica — no external coordinator needed.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["caching", "sharding", "consistent-hashing", "read-replicas", "leader-election"],

  requirements: {
    functional: [
      "Get, set and expire keys, plus data structures (hashes, sets, sorted sets, streams)",
      "Spread data and load across many nodes",
      "Optional reads from replicas",
      "Add or remove nodes and move data without downtime",
      "Survive the loss of a primary with automatic failover",
    ],
    nonFunctional: [
      "Sub-millisecond latency for single-key operations",
      "Linear scaling of throughput as primaries are added",
      "Failover within seconds",
      "Accept a small window of lost writes on failover (replication is asynchronous)",
    ],
  },

  apis: [
    { method: "GRPC", path: "GET / SET key [EX ttl]", purpose: "Basic key-value commands over the Redis protocol (RESP)" },
    { method: "GRPC", path: "CLUSTER SLOTS / SHARDS", purpose: "Clients fetch which node owns which slot range" },
    { method: "GRPC", path: "→ MOVED 3999 10.0.0.12:6379", purpose: "Redirect when a client asks the wrong node; it updates its slot map" },
    { method: "GRPC", path: "MULTI / EXEC on {tag} keys", purpose: "Multi-key operations work only when keys share a hash tag (same slot)" },
  ],

  estimates: [
    { label: "Hash slots", value: "16,384", derivation: "slot = CRC16(key) mod 16384; slots are the unit of sharding" },
    { label: "Throughput per primary", value: "≈ 100 k+ ops/s", derivation: "Single-threaded command execution on one core" },
    { label: "Cluster throughput", value: "≈ 300 k ops/s for 3 primaries", derivation: "Scales roughly linearly with primaries" },
    { label: "Memory per node", value: "Tens of GB", derivation: "Dataset ÷ primaries, plus overhead; replicas double total memory" },
  ],

  dataModel: [
    {
      entity: "Key",
      store: "In-memory, on the primary that owns its slot",
      key: "CRC16(key or {hash tag}) mod 16384",
      fields: ["value (string, hash, list, set, sorted set, stream)", "TTL"],
      why: "Hashing to slots spreads keys evenly; hash tags keep related keys together",
    },
    {
      entity: "Slot map",
      store: "Every node (cluster bus) and every client",
      key: "slot range",
      fields: ["primary address", "replica addresses"],
      why: "Lets clients send each command straight to the right node",
    },
    {
      entity: "Persistence",
      store: "Local disk (RDB snapshots / AOF log)",
      key: "per node",
      fields: ["snapshot", "append-only file"],
      why: "Restart recovery; replication is the main availability mechanism",
    },
  ],

  nodes: [
    { id: "app-client", kind: "web-client", label: "Application client", role: "Services using Redis for caching, sessions, counters or pub/sub" },
    { id: "proxy", kind: "cache", label: "Cluster endpoint / smart client", role: "Maps each key to its slot and the node that owns it", overrides: endpoint },
    {
      id: "failover",
      kind: "cache",
      label: "Failure detection (cluster bus)",
      role: "Nodes gossip health; a majority of primaries vote to promote a replica",
      overrides: { aws: "ElastiCache automatic failover", gcp: "Memorystore HA", azure: "Azure Managed Redis HA", oss: "Built-in cluster bus" },
    },
    { id: "primary-1", kind: "cache", label: "Primary A (slots 0–5460)", role: "Owns a third of the slots; handles writes", overrides: primary },
    { id: "replica-1", kind: "cache", label: "Replica A", role: "Copy of A; can serve reads and take over", overrides: replica },
    { id: "primary-2", kind: "cache", label: "Primary B (slots 5461–10922)", role: "Owns a third of the slots; handles writes", overrides: primary },
    { id: "replica-2", kind: "cache", label: "Replica B", role: "Copy of B", overrides: replica },
    { id: "primary-3", kind: "cache", label: "Primary C (slots 10923–16383)", role: "Owns a third of the slots; handles writes", overrides: primary },
    { id: "replica-3", kind: "cache", label: "Replica C", role: "Copy of C", overrides: replica },
    { id: "monitoring", kind: "observability", label: "Monitoring", role: "Memory, latency, hit rate and replication lag per node" },
  ],

  edges: [
    { id: "client-proxy", from: "app-client", to: "proxy", label: "Redis protocol" },
    { id: "proxy-a", from: "proxy", to: "primary-1", label: "Commands" },
    { id: "proxy-b", from: "proxy", to: "primary-2" },
    { id: "proxy-c", from: "proxy", to: "primary-3" },
    { id: "repl-a", from: "primary-1", to: "replica-1", label: "Async replication", protocol: "async" },
    { id: "repl-b", from: "primary-2", to: "replica-2", protocol: "async" },
    { id: "repl-c", from: "primary-3", to: "replica-3", protocol: "async" },
    { id: "proxy-replica-a", from: "proxy", to: "replica-1", label: "Optional reads" },
    { id: "failover-a", from: "failover", to: "primary-1", label: "Health" },
    { id: "failover-b", from: "failover", to: "primary-2" },
    { id: "failover-c", from: "failover", to: "primary-3" },
    { id: "failover-promote", from: "failover", to: "replica-1", label: "Promote" },
    { id: "monitoring-b", from: "monitoring", to: "primary-2", label: "Metrics (all nodes)" },
  ],

  flows: [
    {
      id: "write",
      name: "Write a key",
      steps: [
        { edge: "client-proxy", text: "The app runs SET user:42 …; the client hashes the key to slot 5649." },
        { edge: "proxy-b", text: "Its slot map says Primary B owns that slot, so the command goes straight there (if the map is stale, B replies MOVED and the client refreshes)." },
        { edge: "repl-b", text: "B acknowledges immediately and streams the write to its replica asynchronously." },
      ],
    },
    {
      id: "failover",
      name: "A primary fails",
      steps: [
        { edge: "failover-a", text: "Primary A stops answering; other nodes mark it as possibly failed over the cluster bus." },
        { edge: "failover-promote", text: "A majority of primaries agree, and Replica A is promoted to own slots 0–5460." },
        { edge: "proxy-replica-a", text: "Clients get MOVED replies, refresh their slot map and send A's keys to the new primary. Writes not yet replicated are lost." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Hot keys concentrate load on one primary",
      fix: "Split hot keys, cache them in the application, or read from replicas when slightly stale data is acceptable.",
      nodes: ["primary-2", "proxy"],
    },
    {
      problem: "Big keys and slow commands block the single thread",
      fix: "Avoid huge collections and O(N) commands like KEYS; use SCAN and smaller structures.",
      nodes: ["primary-1", "primary-2", "primary-3"],
    },
    {
      problem: "Writes lost on failover",
      fix: "Accept it for caches; for critical data use WAIT for replica acks or a durable store as the source of truth.",
      nodes: ["failover", "replica-1"],
    },
  ],

  scaling: [
    "Add primaries and move hash slots to them online (resharding).",
    "Add replicas for read capacity and faster failover.",
    "Use hash tags ({user:42}) so keys used together land in one slot.",
    "Run nodes across availability zones so a zone outage leaves a majority of primaries.",
  ],

  extensions: [
    "Redis Streams as a lightweight event log.",
    "Client-side caching with server-assisted invalidation.",
    "Geo-replicated active-active setups (CRDT-based) for multi-region writes.",
  ],
};
