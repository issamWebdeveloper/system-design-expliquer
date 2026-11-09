import type { ConceptFamily, ConceptInput } from "@/types/schema";

/*
 * Cross-cutting ideas that show up in many systems. Systems and components link
 * here by slug; "Seen in" lists on concept pages are derived from those links.
 */
// `family` is merged in from conceptFamilyBySlug below (and required by the schema).
export const conceptInputs: Omit<ConceptInput, "family">[] = [
  {
    slug: "caching",
    name: "Caching",
    summary: "Keep copies of frequently read data in fast memory so most requests never reach the database.",
    explanation: [
      "Most large systems are read-heavy and a small fraction of data gets most of the reads. Putting that hot data in an in-memory store (or at a CDN edge) cuts latency from milliseconds to microseconds and shields the database from load.",
      "The hard parts are deciding what to cache, how long to keep it, and what happens when the underlying data changes.",
    ],
    howItWorks: [
      "Cache-aside: read the cache; on a miss, read the DB and populate the cache. The most common pattern.",
      "Write-through: write to cache and DB together so the cache is always fresh.",
      "Write-back: write to cache and flush to the DB later — fast but risks loss.",
      "Eviction (LRU/LFU) and TTLs bound memory; versioned keys avoid explicit invalidation.",
    ],
    tradeoffs: [
      "Stale reads until the TTL expires or the key is invalidated.",
      "Cache stampede when a hot key expires — use request coalescing or early refresh.",
      "Another system to run, monitor and size.",
    ],
    related: ["read-replicas", "consistent-hashing", "sharding"],
  },
  {
    slug: "sharding",
    name: "Sharding (partitioning)",
    summary: "Split one big dataset across many machines by a key so each holds and serves only part of it.",
    explanation: [
      "When a single database can't handle the write volume or data size, the data is split into shards. Each shard is an independent database holding the rows whose shard key maps to it.",
      "Choosing the shard key is the most important decision: queries that include the key hit one shard; queries that don't must fan out to all of them.",
    ],
    howItWorks: [
      "Hash sharding: shard = hash(key) mod N (or a hash ring) — spreads load evenly.",
      "Range sharding: contiguous key ranges per shard — good for range scans, risks hotspots.",
      "Directory-based: a lookup table maps keys to shards, which allows rebalancing.",
      "Typical keys: userId, conversationId, videoId, merchantId, city.",
    ],
    tradeoffs: [
      "Cross-shard joins and transactions become hard or impossible.",
      "Hot keys (a celebrity, a viral video) can still overload one shard.",
      "Resharding as data grows needs planning (virtual shards, consistent hashing).",
    ],
    related: ["consistent-hashing", "read-replicas", "horizontal-scaling"],
  },
  {
    slug: "read-replicas",
    name: "Read replicas",
    summary: "Copy the primary database to extra servers that serve read queries.",
    explanation: [
      "Writes go to one primary; changes are streamed to replicas that answer reads. Since most traffic is reads, this multiplies capacity cheaply and gives a ready failover target.",
    ],
    howItWorks: [
      "Asynchronous replication for scale (small lag), synchronous for zero data loss on failover.",
      "Route reads that must see your own writes (e.g. right after posting) to the primary.",
    ],
    tradeoffs: [
      "Replication lag means replicas can return slightly old data.",
      "Doesn't help write throughput — that needs sharding.",
    ],
    related: ["sharding", "caching", "multi-region"],
  },
  {
    slug: "horizontal-scaling",
    name: "Horizontal scaling",
    summary: "Handle more load by adding more machines rather than bigger ones.",
    explanation: [
      "Stateless services can be copied freely behind a load balancer: any instance can serve any request because state lives in shared databases and caches. Autoscaling adds or removes instances as traffic changes.",
    ],
    howItWorks: [
      "Keep services stateless; store sessions in a cache or tokens.",
      "Put a load balancer in front and autoscale on CPU, latency or queue depth.",
      "Stateful tiers (databases) scale out with sharding and replication instead.",
    ],
    tradeoffs: [
      "More instances means more network calls and more moving parts to observe.",
      "Stateful components (connections, databases) don't scale this simply.",
    ],
    related: ["microservices", "sharding", "caching"],
  },
  {
    slug: "consistent-hashing",
    name: "Consistent hashing",
    summary: "Map keys to servers on a hash ring so adding or removing a server moves only a small share of keys.",
    explanation: [
      "With plain hash mod N, changing N remaps almost every key — a disaster for caches and connection routing. Consistent hashing places servers and keys on the same ring; each key belongs to the next server clockwise, so a change only affects neighbours.",
    ],
    howItWorks: [
      "Each server gets many virtual nodes on the ring to even out load.",
      "Used for cache clusters, wide-column databases, WebSocket session routing and rate-limit counters.",
    ],
    tradeoffs: [
      "Still needs replication for availability; a lost node's keys must be rebuilt or read from replicas.",
    ],
    related: ["sharding", "caching", "websockets"],
  },
  {
    slug: "multi-region",
    name: "Multi-region deployment",
    summary: "Run the system in several geographic regions for lower latency and to survive a regional outage.",
    explanation: [
      "Users are routed to the nearest healthy region by geo-DNS or anycast. Data is replicated between regions — asynchronously for most data, carefully for anything that must be strongly consistent.",
    ],
    howItWorks: [
      "Active-passive: one region serves, another is on standby.",
      "Active-active: all regions serve traffic; conflicts must be avoided (partition users by home region) or resolved.",
      "Partitioning by region (Uber by city) keeps most traffic local.",
    ],
    tradeoffs: [
      "Cross-region writes are slow; global strong consistency is expensive.",
      "Doubles infrastructure and operational complexity.",
    ],
    related: ["read-replicas", "sharding"],
  },
  {
    slug: "rate-limiting",
    name: "Rate limiting",
    summary: "Cap how many requests a client can make in a time window to prevent abuse and protect capacity.",
    explanation: [
      "Every request is attributed to a client (API key, user, IP) and checked against a rule such as 100 requests per minute. Over the limit, the request is rejected with HTTP 429 instead of reaching the backend.",
    ],
    howItWorks: [
      "Token bucket: tokens refill at a steady rate; each request takes one; allows short bursts.",
      "Fixed window: count per minute — simple but allows 2× bursts at window edges.",
      "Sliding window: blends adjacent windows for smoother limits.",
      "Counters live in a shared in-memory store and are updated atomically.",
    ],
    tradeoffs: [
      "Adds a check to every request; must be fast and fail open.",
      "Exact global limits across regions are costly; approximations are usual.",
    ],
    related: ["back-pressure", "caching"],
  },
  {
    slug: "authentication",
    name: "Authentication & tokens",
    summary: "Verify who a user is once, then give them a token every service can check cheaply.",
    explanation: [
      "Users sign in with a password, social login or OTP. The identity service issues a short-lived signed token (often a JWT) plus a refresh token. The gateway verifies the signature on every request without a database lookup.",
    ],
    howItWorks: [
      "OAuth 2.0 / OpenID Connect for login flows and third-party access.",
      "Short access-token lifetimes plus refresh tokens limit damage from leaks.",
      "Services authorise using claims in the token (user id, roles, plan).",
    ],
    tradeoffs: [
      "Revoking a stateless token before expiry needs a deny-list.",
      "Never store passwords yourself without a proven hashing scheme — prefer a managed identity provider.",
    ],
    related: ["rate-limiting", "microservices"],
  },
  {
    slug: "microservices",
    name: "Microservices",
    summary: "Split a system into small services, each owning one domain and its own data.",
    explanation: [
      "Each service (users, orders, payments …) is deployed and scaled independently and communicates over APIs or events. This lets teams move independently and scale hot paths separately.",
    ],
    howItWorks: [
      "An API gateway routes external calls; services talk via gRPC/REST and events.",
      "Each service owns its database — no shared tables.",
      "Timeouts, retries and circuit breakers prevent cascading failures.",
    ],
    tradeoffs: [
      "Network calls, partial failures and distributed transactions (sagas) become everyday problems.",
      "Small teams often do better with a well-structured monolith first.",
    ],
    related: ["event-driven", "saga", "horizontal-scaling"],
  },
  {
    slug: "event-driven",
    name: "Event-driven architecture",
    summary: "Services publish events about what happened; others react asynchronously.",
    explanation: [
      "Instead of the order service calling shipping, email and analytics directly, it publishes 'order placed' to a durable log. Each consumer reads at its own pace, so the producer stays fast and new consumers can be added without changing it.",
    ],
    howItWorks: [
      "A partitioned, replayable log (Kafka-style) keeps events in order per key.",
      "Consumers track their own offsets and can replay history to rebuild state.",
      "Use an outbox table so a DB write and its event are published together.",
    ],
    tradeoffs: [
      "Eventual consistency: consumers lag behind the producer.",
      "Debugging spans many services; needs good tracing.",
      "Consumers must be idempotent because events can be delivered more than once.",
    ],
    related: ["idempotency", "fan-out", "change-data-capture", "back-pressure"],
  },
  {
    slug: "fan-out",
    name: "Fan-out (push vs pull feeds)",
    summary: "Deliver one item to many recipients — either copied at write time or gathered at read time.",
    explanation: [
      "Feeds (Instagram, Twitter, notifications) face a choice. Fan-out on write copies a new post into every follower's feed so reads are instant. Fan-out on read gathers posts from everyone you follow when you open the feed.",
      "Most real systems are hybrid: push for normal accounts, pull for celebrities with millions of followers.",
    ],
    howItWorks: [
      "Write path: event → fan-out workers → append postId to each follower's cached list.",
      "Read path: fetch the cached list, merge recent celebrity posts, rank, hydrate.",
    ],
    tradeoffs: [
      "Push: huge write amplification for popular accounts, wasted work for inactive users.",
      "Pull: slow reads that touch many sources.",
    ],
    related: ["event-driven", "caching"],
  },
  {
    slug: "idempotency",
    name: "Idempotency",
    summary: "Make an operation safe to repeat, so retries never cause double effects.",
    explanation: [
      "Networks fail after a request is processed but before the response arrives. The client retries — and without protection, a payment is charged twice or an order is created twice.",
    ],
    howItWorks: [
      "Clients send an idempotency key; the server stores key → result and returns the stored result on repeats.",
      "Unique constraints (e.g. one like per user per post) make writes naturally idempotent.",
      "Event consumers dedupe by event or entity id.",
    ],
    tradeoffs: [
      "Keys must be stored (with expiry) and checked atomically.",
    ],
    related: ["event-driven", "saga", "ledger"],
  },
  {
    slug: "saga",
    name: "Saga pattern",
    summary: "Run a multi-service transaction as a series of local steps, undoing completed steps if a later one fails.",
    explanation: [
      "Checkout touches inventory, payment and shipping, each with its own database, so a single ACID transaction isn't available. A saga executes each step locally and defines a compensating action (release stock, refund) for when a later step fails.",
    ],
    howItWorks: [
      "Orchestration: a workflow engine calls each step and its compensation.",
      "Choreography: services react to each other's events.",
      "Every step and compensation must be idempotent and retryable.",
    ],
    tradeoffs: [
      "Intermediate states are visible (an order is PENDING for a while).",
      "Compensations must be designed carefully — some actions can't be undone, only offset.",
    ],
    related: ["microservices", "idempotency", "event-driven"],
  },
  {
    slug: "ledger",
    name: "Double-entry ledger",
    summary: "Record every money movement as balanced debits and credits so money can never appear or vanish.",
    explanation: [
      "Instead of updating a balance column, payments systems append entries: debit one account, credit another, summing to zero. Balances are derived from entries, and the full history is an audit trail.",
    ],
    howItWorks: [
      "Entries are append-only; mistakes are fixed by new reversing entries.",
      "Periodic balance snapshots keep reads fast.",
      "Reconciliation compares the ledger with bank settlement files.",
    ],
    tradeoffs: [
      "More rows and stricter discipline than a simple balance field.",
    ],
    related: ["idempotency", "saga"],
  },
  {
    slug: "distributed-locks",
    name: "Distributed locks & holds",
    summary: "Stop two processes from claiming the same thing at once — a seat, a driver, a time slot.",
    explanation: [
      "Bookings and dispatch need exclusivity across many servers. A short-lived lock or hold in a shared store marks an item as taken while the rest of the process finishes.",
    ],
    howItWorks: [
      "Set a key only if absent, with a TTL (SET NX EX) so crashed holders release automatically.",
      "Or use database row locks / conditional updates (available ≥ qty).",
      "Fencing tokens prevent a stale holder from acting after its lock expired.",
    ],
    tradeoffs: [
      "Clock and network issues make cache-based locks imperfect; critical money paths should rely on database constraints.",
    ],
    related: ["caching", "idempotency"],
  },
  {
    slug: "back-pressure",
    name: "Back-pressure & queues",
    summary: "When producers outpace consumers, buffer and slow down instead of falling over.",
    explanation: [
      "Spikes (a viral upload, a flash sale) arrive faster than workers can process. A queue absorbs the burst so the cost is delay, not failure, and signals upstream to slow down when it grows too long.",
    ],
    howItWorks: [
      "Queue between request path and heavy work (transcoding, emails, fan-out).",
      "Autoscale consumers on queue depth.",
      "Dead-letter queues for messages that keep failing.",
      "Reject or shed low-priority load when queues are full.",
    ],
    tradeoffs: [
      "Users see delays during spikes; queues need monitoring.",
    ],
    related: ["event-driven", "rate-limiting"],
  },
  {
    slug: "websockets",
    name: "WebSockets & real-time push",
    summary: "Keep a persistent connection open so the server can push updates instantly.",
    explanation: [
      "Chat, live tracking and tickers can't wait for polling. Each client holds one long-lived connection to a gateway; the server pushes messages as they happen.",
    ],
    howItWorks: [
      "A connection registry maps userId → gateway node.",
      "Gateways exchange messages over pub/sub so any node can reach any user.",
      "Heartbeats detect dead connections; clients reconnect with backoff.",
    ],
    tradeoffs: [
      "Stateful servers: deploys and failures cause reconnect storms.",
      "Each node holds tens of thousands of sockets — needs async I/O and L4 load balancing.",
    ],
    related: ["consistent-hashing", "event-driven"],
  },
  {
    slug: "adaptive-bitrate-streaming",
    name: "Adaptive bitrate streaming",
    summary: "Encode video at several qualities in small segments so the player can switch quality as bandwidth changes.",
    explanation: [
      "Videos are transcoded into renditions (240p–4K) and cut into 2–10 second segments listed in a manifest (HLS or DASH). The player measures throughput and picks the best quality for the next segment, avoiding buffering.",
    ],
    howItWorks: [
      "Transcode in parallel chunks; store segments in object storage.",
      "Serve manifests and segments from a CDN.",
      "Per-title encoding tunes bitrates to content complexity.",
    ],
    tradeoffs: [
      "Many renditions multiply storage and encoding cost.",
    ],
    related: ["caching", "presigned-urls"],
  },
  {
    slug: "presigned-urls",
    name: "Pre-signed uploads",
    summary: "Let clients upload large files straight to object storage using a short-lived signed URL.",
    explanation: [
      "Streaming gigabytes through your API servers wastes bandwidth and CPU. Instead the API returns a signed URL that allows one upload to one location for a few minutes; the client sends the file directly to storage.",
    ],
    howItWorks: [
      "Multipart/resumable uploads for big files; chunk hashes enable dedupe.",
      "A storage event or client callback triggers processing afterwards.",
    ],
    tradeoffs: [
      "The server must validate the file after upload (type, size, malware).",
    ],
    related: ["adaptive-bitrate-streaming", "event-driven"],
  },
  {
    slug: "search-indexing",
    name: "Search indexing",
    summary: "Maintain an inverted index so text queries find matching documents in milliseconds.",
    explanation: [
      "Databases are poor at 'find products matching wireless headphones under $100'. A search engine tokenises text into an inverted index (term → documents), supports filters and facets, and ranks results.",
    ],
    howItWorks: [
      "Feed the index from change events (CDC) so it stays close to the source of truth.",
      "Shard the index and add replicas for query throughput.",
      "Autocomplete uses prefix indexes or tries.",
    ],
    tradeoffs: [
      "The index lags slightly behind the database.",
      "Reindexing large catalogues takes time; use aliases to swap indexes.",
    ],
    related: ["change-data-capture", "sharding"],
  },
  {
    slug: "geospatial-indexing",
    name: "Geospatial indexing",
    summary: "Bucket locations into cells so 'what's near me' becomes a quick lookup.",
    explanation: [
      "Ride-hailing and delivery need nearby drivers or restaurants instantly. The map is divided into cells (Geohash, S2, H3); each location is stored under its cell, and a nearby search reads the cell and its neighbours.",
    ],
    howItWorks: [
      "Live positions in memory keyed by cell; updated every few seconds.",
      "Smaller cells in dense cities, larger elsewhere.",
      "Rank candidates by road ETA, not straight-line distance.",
    ],
    tradeoffs: [
      "Cell boundaries mean you must also search neighbouring cells.",
      "Hot cells in busy areas need extra shards.",
    ],
    related: ["sharding", "caching"],
  },
  {
    slug: "leader-election",
    name: "Leader election & coordination",
    summary: "Agree on which node is in charge or who owns which shard, using a consistent coordination service.",
    explanation: [
      "Some jobs must run on exactly one node (schedulers, shard owners, key-range allocation). A consensus-backed store such as etcd or ZooKeeper grants leases; if the leader dies, its lease expires and another node takes over.",
    ],
    howItWorks: [
      "Leases with TTL and heartbeats.",
      "Watches notify nodes when configuration or ownership changes.",
    ],
    tradeoffs: [
      "The coordination cluster itself must be small, reliable and fast.",
    ],
    related: ["distributed-locks", "consistent-hashing"],
  },
  {
    slug: "id-generation",
    name: "Unique ID generation",
    summary: "Create unique, often time-sortable IDs across many machines without a central bottleneck.",
    explanation: [
      "Auto-increment columns don't work across shards. Snowflake-style IDs combine a timestamp, a machine id and a per-machine sequence into 64 bits, so they're unique and sort by time. Short links use counters from pre-allocated ranges encoded in Base62.",
    ],
    howItWorks: [
      "Snowflake: 41 bits time + 10 bits worker + 12 bits sequence.",
      "Range allocation: each generator claims a block of numbers from a coordination store.",
      "UUIDv7 offers time-ordered random IDs without coordination.",
    ],
    tradeoffs: [
      "Clock skew can break ordering; sequential IDs can be guessable.",
    ],
    related: ["sharding", "leader-election"],
  },
  {
    slug: "change-data-capture",
    name: "Change data capture",
    summary: "Stream every database change as an event so other systems stay in sync without dual writes.",
    explanation: [
      "Writing to a database and then separately to a search index or cache can leave them inconsistent if one write fails. CDC tails the database's own change log and publishes each insert, update and delete, so downstream copies follow the source of truth.",
    ],
    howItWorks: [
      "Tools read the write-ahead log or binlog and publish to an event stream.",
      "Consumers update search indexes, caches and warehouses.",
    ],
    tradeoffs: [
      "Downstream copies are eventually consistent.",
      "Schema changes must be coordinated with consumers.",
    ],
    related: ["event-driven", "search-indexing"],
  },
  {
    slug: "bloom-filter",
    name: "Bloom filters",
    summary: "A tiny probabilistic set that answers 'definitely not seen' or 'probably seen' using a few bits per item.",
    explanation: [
      "Checking billions of items (URLs a crawler has visited, usernames taken) against a database is slow. A Bloom filter hashes each item to a few bit positions; if any bit is unset, the item was never added. False positives are possible, false negatives are not.",
    ],
    howItWorks: [
      "k hash functions set k bits per inserted item.",
      "Lookups check the same k bits; all set means 'probably present'.",
      "Size the bit array for the expected item count and acceptable false-positive rate (~10 bits per item ≈ 1%).",
    ],
    tradeoffs: [
      "Can't delete items (use counting Bloom filters) and never gives a definite 'yes'.",
    ],
    related: ["caching", "sharding"],
  },
  {
    slug: "prefix-trie",
    name: "Tries & prefix search",
    summary: "Store strings by their prefixes so 'top suggestions for what the user has typed so far' is one lookup.",
    explanation: [
      "Autocomplete must respond on every keystroke. A trie maps each prefix to its children; storing the top-k completions at each node makes a lookup a single walk down the prefix, with no ranking at query time.",
    ],
    howItWorks: [
      "Build tries offline from query logs, weighting by frequency and recency.",
      "Shard by prefix range and keep hot prefixes in an in-memory cache.",
      "Refresh periodically; blend in trending queries from a stream.",
    ],
    tradeoffs: [
      "Memory-hungry; precomputed top-k lists lag behind sudden trends.",
    ],
    related: ["caching", "sharding", "search-indexing"],
  },
  {
    slug: "webrtc",
    name: "WebRTC calling",
    summary: "Real-time audio and video between browsers and apps, with servers only for signalling and relaying when needed.",
    explanation: [
      "Peers exchange connection details through a signalling server (often over WebSockets), then try to connect directly. STUN discovers public addresses; when firewalls block direct paths, a TURN server relays the media. Group calls use an SFU that forwards each stream to the other participants.",
    ],
    howItWorks: [
      "Signalling: offer/answer and ICE candidates over WebSockets.",
      "STUN for NAT discovery; TURN relays roughly 10–20% of calls.",
      "SFU for groups; simulcast lets each viewer receive a suitable quality.",
    ],
    tradeoffs: [
      "TURN and SFU bandwidth is the main cost.",
      "Recording and compliance need extra pipelines.",
    ],
    related: ["websockets", "multi-region"],
  },
];

/** Colour family for each concept (validated: every concept must have one). */
export const conceptFamilyBySlug: Record<string, ConceptFamily> = {
  caching: "data",
  sharding: "data",
  "read-replicas": "data",
  "search-indexing": "data",
  "change-data-capture": "data",
  ledger: "data",
  "horizontal-scaling": "scale",
  "consistent-hashing": "scale",
  "multi-region": "scale",
  "geospatial-indexing": "scale",
  "id-generation": "scale",
  "bloom-filter": "scale",
  "prefix-trie": "scale",
  "event-driven": "messaging",
  "fan-out": "messaging",
  "back-pressure": "messaging",
  websockets: "messaging",
  saga: "messaging",
  "adaptive-bitrate-streaming": "messaging",
  "presigned-urls": "messaging",
  webrtc: "messaging",
  idempotency: "reliability",
  "distributed-locks": "reliability",
  "leader-election": "reliability",
  "rate-limiting": "reliability",
  microservices: "reliability",
  authentication: "security",
};
