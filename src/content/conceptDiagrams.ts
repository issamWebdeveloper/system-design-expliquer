import type { ConceptInput, ConceptVisual } from "@/types/schema";

/*
 * Diagrams for concept pages: a small architecture showing the idea in action,
 * with one or more step-through scenarios, plus an optional interactive visual.
 * Merged into the concepts by slug in content/index.ts.
 */

type Diagram = NonNullable<ConceptInput["diagram"]>;
type Node = Diagram["nodes"][number];
type Edge = Diagram["edges"][number];

const n = (id: string, kind: string, label: string, role: string): Node => ({ id, kind, label, role });
const e = (id: string, from: string, to: string, label?: string, protocol?: Edge["protocol"]): Edge => ({
  id,
  from,
  to,
  label,
  protocol,
});
const s = (edge: string, text: string) => ({ edge, text });

export const conceptDiagrams: Record<string, { diagram?: Diagram; visual?: ConceptVisual }> = {
  caching: {
    diagram: {
      nodes: [
        n("app", "web-client", "App", "Asks for product 42"),
        n("svc", "service", "Product service", "Applies cache-aside"),
        n("cache", "cache", "Cache", "Hot products, 5-minute TTL"),
        n("db", "relational-db", "Database", "Source of truth"),
      ],
      edges: [
        e("app-svc", "app", "svc", "GET /products/42"),
        e("svc-cache", "svc", "cache", "get / set / delete"),
        e("svc-db", "svc", "db", "read / write"),
      ],
      flows: [
        {
          id: "hit",
          name: "Cache hit",
          steps: [
            s("app-svc", "The app requests product 42."),
            s("svc-cache", "The service looks up product:42 in the cache — it's there, so it returns in under a millisecond. The database is never touched."),
          ],
        },
        {
          id: "miss",
          name: "Cache miss",
          steps: [
            s("app-svc", "The app requests a product nobody has viewed recently."),
            s("svc-cache", "The cache lookup misses."),
            s("svc-db", "The service reads the row from the database (a few milliseconds)."),
            s("svc-cache", "It stores the result in the cache with a TTL, so the next reader gets a hit."),
          ],
        },
        {
          id: "write",
          name: "Update (invalidate)",
          steps: [
            s("app-svc", "An admin changes the product's price."),
            s("svc-db", "The service writes the new price to the database first."),
            s("svc-cache", "Then it deletes product:42 from the cache; the next read repopulates it with fresh data."),
          ],
        },
      ],
    },
  },

  sharding: {
    diagram: {
      nodes: [
        n("app", "web-client", "App", "Reads and writes users"),
        n("router", "service", "Shard router", "Computes the shard from the key"),
        n("map", "coordination", "Shard map", "Which key range lives on which shard"),
        n("s0", "relational-db", "Shard 0", "hash(userId) mod 3 = 0"),
        n("s1", "relational-db", "Shard 1", "hash(userId) mod 3 = 1"),
        n("s2", "relational-db", "Shard 2", "hash(userId) mod 3 = 2"),
      ],
      edges: [
        e("app-router", "app", "router"),
        e("router-map", "router", "map", "Lookup"),
        e("router-s0", "router", "s0"),
        e("router-s1", "router", "s1"),
        e("router-s2", "router", "s2"),
      ],
      flows: [
        {
          id: "single",
          name: "Query by key",
          steps: [
            s("app-router", "The app asks for user 42's profile."),
            s("router-map", "The router hashes the key: hash(42) mod 3 = 1, and confirms in the shard map that shard 1 owns it."),
            s("router-s1", "Only shard 1 is queried. Each shard holds a third of the data and a third of the load."),
          ],
        },
        {
          id: "scatter",
          name: "Query without the key",
          steps: [
            s("app-router", "The app asks for 'all users who signed up today' — no user id in the query."),
            s("router-s0", "The router must ask every shard…"),
            s("router-s1", "…in parallel…"),
            s("router-s2", "…and merge the results. That's why the shard key should match your most common queries."),
          ],
        },
      ],
    },
  },

  "read-replicas": {
    diagram: {
      nodes: [
        n("app", "service", "App servers", "Send writes to the primary, reads to replicas"),
        n("primary", "relational-db", "Primary", "Accepts all writes"),
        n("r1", "relational-db", "Replica 1", "Read-only copy"),
        n("r2", "relational-db", "Replica 2", "Read-only copy"),
      ],
      edges: [
        e("app-primary", "app", "primary", "Writes"),
        e("primary-r1", "primary", "r1", "Replication", "async"),
        e("primary-r2", "primary", "r2", "Replication", "async"),
        e("app-r1", "app", "r1", "Reads"),
        e("app-r2", "app", "r2", "Reads"),
      ],
      flows: [
        {
          id: "write-read",
          name: "Write, then read",
          steps: [
            s("app-primary", "A user updates their name; the write goes to the primary."),
            s("primary-r1", "The primary streams the change to replicas a few milliseconds later."),
            s("primary-r2", "Both replicas apply it."),
            s("app-r1", "Most reads go to replicas, multiplying read capacity. Reads that must see the user's own write right away go to the primary instead."),
          ],
        },
      ],
    },
  },

  "horizontal-scaling": {
    diagram: {
      nodes: [
        n("users", "web-client", "Users", "Traffic grows through the day"),
        n("lb", "load-balancer", "Load balancer", "Spreads requests across healthy instances"),
        n("i1", "service", "Instance 1", "Stateless"),
        n("i2", "service", "Instance 2", "Stateless"),
        n("i3", "service", "Instance 3 (new)", "Added by the autoscaler"),
        n("cache", "cache", "Session cache", "Shared state lives outside the instances"),
        n("metrics", "observability", "Metrics & autoscaler", "Watches CPU and latency"),
      ],
      edges: [
        e("users-lb", "users", "lb"),
        e("lb-i1", "lb", "i1"),
        e("lb-i2", "lb", "i2"),
        e("lb-i3", "lb", "i3"),
        e("i1-cache", "i1", "cache"),
        e("i2-cache", "i2", "cache"),
        e("i3-cache", "i3", "cache"),
        e("metrics-i3", "metrics", "i3", "Launch", "async"),
      ],
      flows: [
        {
          id: "scale-out",
          name: "Scale out",
          steps: [
            s("users-lb", "Traffic doubles at lunchtime."),
            s("lb-i1", "Requests spread across the existing instances…"),
            s("lb-i2", "…until average CPU crosses the target."),
            s("metrics-i3", "The autoscaler launches another identical instance."),
            s("lb-i3", "Once healthy, the load balancer starts sending it traffic."),
            s("i3-cache", "Because sessions live in the shared cache, any instance can serve any user."),
          ],
        },
      ],
    },
  },

  "consistent-hashing": {
    visual: "hash-ring",
    diagram: {
      nodes: [
        n("client", "service", "Client library", "Hashes each key onto the ring"),
        n("a", "cache", "Node A", "Owns the arc before it"),
        n("b", "cache", "Node B", "Owns the arc before it"),
        n("c", "cache", "Node C", "Owns the arc before it"),
      ],
      edges: [e("client-a", "client", "a"), e("client-b", "client", "b"), e("client-c", "client", "c")],
      flows: [
        {
          id: "route",
          name: "Route a key",
          steps: [
            s("client-b", "hash('user:42') lands just before node B on the ring, so B owns it."),
            s("client-c", "If B fails, only B's keys move — to the next node clockwise, C. A's keys don't move at all."),
          ],
        },
      ],
    },
  },

  "multi-region": {
    diagram: {
      nodes: [
        n("eu", "web-client", "EU users", "Close to Frankfurt"),
        n("us", "web-client", "US users", "Close to Virginia"),
        n("dns", "dns", "Geo-DNS", "Routes to the nearest healthy region"),
        n("eu-app", "service", "EU region", "Full copy of the app"),
        n("us-app", "service", "US region", "Full copy of the app"),
        n("eu-db", "relational-db", "EU database", "Primary for EU users"),
        n("us-db", "relational-db", "US database", "Primary for US users"),
      ],
      edges: [
        e("eu-dns", "eu", "dns"),
        e("us-dns", "us", "dns"),
        e("dns-eu", "dns", "eu-app"),
        e("dns-us", "dns", "us-app"),
        e("eu-app-db", "eu-app", "eu-db"),
        e("us-app-db", "us-app", "us-db"),
        e("eu-us-repl", "eu-db", "us-db", "Async replication", "async"),
      ],
      flows: [
        {
          id: "normal",
          name: "Normal day",
          steps: [
            s("eu-dns", "A user in Berlin opens the app."),
            s("dns-eu", "Geo-DNS sends them to the EU region — tens of milliseconds closer than the US."),
            s("eu-app-db", "Their data lives in the EU database."),
            s("eu-us-repl", "Changes replicate to the US asynchronously for disaster recovery."),
          ],
        },
        {
          id: "outage",
          name: "Region outage",
          steps: [
            s("eu-dns", "The EU region goes down; health checks fail."),
            s("dns-us", "Geo-DNS routes EU users to the US region instead."),
            s("us-app-db", "The US copy serves them — slower, and missing any writes that hadn't replicated yet (the RPO)."),
          ],
        },
      ],
    },
  },

  "rate-limiting": {
    visual: "token-bucket",
    diagram: {
      nodes: [
        n("client", "web-client", "API client", "Sends requests with an API key"),
        n("gateway", "api-gateway", "API gateway", "Asks the limiter before forwarding"),
        n("limiter", "service", "Rate limiter", "Token bucket per client"),
        n("counters", "cache", "Counter store", "Tokens left per client"),
        n("backend", "service", "Backend", "Protected service"),
      ],
      edges: [
        e("client-gw", "client", "gateway"),
        e("gw-limiter", "gateway", "limiter", "Allow?"),
        e("limiter-counters", "limiter", "counters", "Take a token"),
        e("gw-backend", "gateway", "backend", "Allowed"),
      ],
      flows: [
        {
          id: "allowed",
          name: "Allowed",
          steps: [
            s("client-gw", "A request arrives."),
            s("gw-limiter", "The gateway asks the limiter."),
            s("limiter-counters", "An atomic script refills the bucket for elapsed time and takes one token — 7 left."),
            s("gw-backend", "The request is forwarded with X-RateLimit-Remaining: 7."),
          ],
        },
        {
          id: "rejected",
          name: "Rejected",
          steps: [
            s("client-gw", "The client bursts 50 requests in a second."),
            s("gw-limiter", "The gateway asks the limiter."),
            s("limiter-counters", "The bucket is empty. The gateway answers 429 Too Many Requests with Retry-After — the backend never sees it."),
          ],
        },
      ],
    },
  },

  authentication: {
    diagram: {
      nodes: [
        n("browser", "web-client", "Browser", "The user signing in"),
        n("app", "service", "Your app", "Starts login, exchanges the code"),
        n("idp", "identity", "Identity provider", "Checks credentials, issues tokens"),
        n("gateway", "api-gateway", "API gateway", "Verifies token signatures"),
        n("api", "service", "API", "Trusts claims in the token"),
      ],
      edges: [
        e("browser-app", "browser", "app", "Log in"),
        e("browser-idp", "browser", "idp", "Redirect + password"),
        e("app-idp", "app", "idp", "Code → tokens"),
        e("browser-gw", "browser", "gateway", "Bearer token"),
        e("gw-api", "gateway", "api", "Verified claims"),
      ],
      flows: [
        {
          id: "oidc",
          name: "Sign in (OIDC)",
          steps: [
            s("browser-app", "The user clicks 'Log in'."),
            s("browser-idp", "They're redirected to the identity provider and enter their password (the app never sees it)."),
            s("app-idp", "The provider redirects back with a one-time code; the app's server exchanges it for an ID token, a short-lived access token and a refresh token."),
            s("browser-gw", "API calls carry the access token (a signed JWT)."),
            s("gw-api", "The gateway checks the signature and expiry with the provider's public key — no database lookup — and forwards the user's id and roles."),
          ],
        },
      ],
    },
  },

  microservices: {
    diagram: {
      nodes: [
        n("client", "web-client", "Client", "One API for the outside world"),
        n("gateway", "api-gateway", "API gateway", "Routes to services"),
        n("orders", "service", "Order service", "Owns orders"),
        n("payments", "service", "Payment service", "Owns payments"),
        n("users", "service", "User service", "Owns users"),
        n("orders-db", "relational-db", "Orders DB", "Only the order service touches it"),
        n("payments-db", "relational-db", "Payments DB", "Only the payment service touches it"),
        n("events", "event-stream", "Event stream", "Services announce what happened"),
      ],
      edges: [
        e("client-gw", "client", "gateway"),
        e("gw-orders", "gateway", "orders", undefined, "grpc"),
        e("gw-users", "gateway", "users", undefined, "grpc"),
        e("orders-db-rw", "orders", "orders-db"),
        e("orders-payments", "orders", "payments", "Charge", "grpc"),
        e("payments-db-rw", "payments", "payments-db"),
        e("orders-events", "orders", "events", "OrderPlaced", "stream"),
      ],
      flows: [
        {
          id: "order",
          name: "Place an order",
          steps: [
            s("client-gw", "The client calls one public API."),
            s("gw-orders", "The gateway routes to the order service."),
            s("orders-db-rw", "The order service writes to its own database — no other service shares it."),
            s("orders-payments", "It calls the payment service over gRPC with a timeout and retry budget."),
            s("payments-db-rw", "Payments records the charge in its own database."),
            s("orders-events", "An OrderPlaced event lets other teams react without the order service knowing about them."),
          ],
        },
      ],
    },
  },

  "event-driven": {
    diagram: {
      nodes: [
        n("orders", "service", "Order service", "Producer"),
        n("log", "event-stream", "Event log", "Durable, ordered, replayable"),
        n("email", "service", "Email service", "Consumer group 1"),
        n("search", "stream-processor", "Search indexer", "Consumer group 2"),
        n("analytics", "data-warehouse", "Analytics", "Consumer group 3"),
      ],
      edges: [
        e("orders-log", "orders", "log", "OrderPlaced", "stream"),
        e("log-email", "log", "email", undefined, "async"),
        e("log-search", "log", "search", undefined, "async"),
        e("log-analytics", "log", "analytics", undefined, "async"),
      ],
      flows: [
        {
          id: "publish",
          name: "One event, many readers",
          steps: [
            s("orders-log", "The order service appends OrderPlaced to the log and moves on — it doesn't wait for anyone."),
            s("log-email", "The email service reads it and sends a confirmation."),
            s("log-search", "The search indexer reads the same event at its own pace."),
            s("log-analytics", "Analytics was down for an hour; when it restarts it resumes from its saved offset and catches up — nothing is lost."),
          ],
        },
      ],
    },
  },

  "fan-out": {
    diagram: {
      nodes: [
        n("author", "mobile-client", "Author", "Posts something"),
        n("posts", "service", "Post service", "Stores the post"),
        n("events", "event-stream", "New-post events", "One per post"),
        n("fanout", "service", "Fan-out workers", "Copy post ids to followers' feeds"),
        n("feeds", "cache", "Feed cache", "A list per follower"),
        n("reader", "mobile-client", "Follower", "Opens their feed"),
        n("feed-svc", "service", "Feed service", "Reads the list, merges celebrities"),
        n("posts-db", "wide-column-db", "Posts store", "Every post by author"),
      ],
      edges: [
        e("author-posts", "author", "posts"),
        e("posts-db-write", "posts", "posts-db"),
        e("posts-events", "posts", "events", undefined, "stream"),
        e("events-fanout", "events", "fanout", undefined, "async"),
        e("fanout-feeds", "fanout", "feeds", "Push"),
        e("reader-feed", "reader", "feed-svc"),
        e("feed-cache", "feed-svc", "feeds", "Read list"),
        e("feed-posts", "feed-svc", "posts-db", "Pull celebrity posts"),
      ],
      flows: [
        {
          id: "push",
          name: "Push (fan-out on write)",
          steps: [
            s("author-posts", "A normal user with 300 followers posts."),
            s("posts-db-write", "The post is stored once."),
            s("posts-events", "A new-post event is published."),
            s("events-fanout", "Fan-out workers pick it up."),
            s("fanout-feeds", "They prepend the post id to all 300 followers' feed lists — 300 cheap writes now, so every read later is instant."),
          ],
        },
        {
          id: "pull",
          name: "Pull (fan-out on read)",
          steps: [
            s("reader-feed", "A follower opens their feed."),
            s("feed-cache", "Their pre-built list holds posts from normal accounts."),
            s("feed-posts", "Posts from celebrities they follow (millions of followers, so never pushed) are pulled now and merged in."),
          ],
        },
      ],
    },
  },

  idempotency: {
    diagram: {
      nodes: [
        n("client", "web-client", "Client", "Retries on timeout"),
        n("api", "service", "Payments API", "Checks the idempotency key first"),
        n("keys", "cache", "Idempotency store", "key → saved response"),
        n("psp", "payments", "Card network", "Actually moves money"),
      ],
      edges: [
        e("client-api", "client", "api", "POST /charges + Idempotency-Key"),
        e("api-keys", "api", "keys", "Seen this key?"),
        e("api-psp", "api", "psp", "Charge"),
      ],
      flows: [
        {
          id: "first",
          name: "First attempt",
          steps: [
            s("client-api", "The client sends a charge with key abc-123."),
            s("api-keys", "The key is new; it's reserved atomically."),
            s("api-psp", "The card is charged."),
            s("api-keys", "The response is saved under abc-123 — but the network drops before the client hears back."),
          ],
        },
        {
          id: "retry",
          name: "Retry",
          steps: [
            s("client-api", "The client times out and retries with the same key abc-123."),
            s("api-keys", "The key is found, so the saved response is returned. The card is not charged twice."),
          ],
        },
      ],
    },
  },

  saga: {
    diagram: {
      nodes: [
        n("orders", "service", "Order service", "Starts the saga"),
        n("saga", "workflow", "Saga orchestrator", "Runs steps and compensations"),
        n("inventory", "service", "Inventory", "Reserve / release stock"),
        n("payment", "service", "Payment", "Charge / refund"),
        n("shipping", "service", "Shipping", "Create shipment"),
      ],
      edges: [
        e("orders-saga", "orders", "saga", "Start", "async"),
        e("saga-inventory", "saga", "inventory", undefined, "grpc"),
        e("saga-payment", "saga", "payment", undefined, "grpc"),
        e("saga-shipping", "saga", "shipping", undefined, "grpc"),
      ],
      flows: [
        {
          id: "happy",
          name: "All steps succeed",
          steps: [
            s("orders-saga", "An order is placed as PENDING and the saga starts."),
            s("saga-inventory", "Step 1: reserve stock — committed in inventory's own database."),
            s("saga-payment", "Step 2: charge the card — committed in payment's database."),
            s("saga-shipping", "Step 3: create the shipment. The order becomes CONFIRMED."),
          ],
        },
        {
          id: "compensate",
          name: "Payment fails",
          steps: [
            s("saga-inventory", "Step 1 succeeds: stock is reserved."),
            s("saga-payment", "Step 2 fails: the card is declined."),
            s("saga-inventory", "Compensation: the orchestrator releases the reservation. There's no global rollback — each completed step is undone by its own compensating action."),
          ],
        },
      ],
    },
  },

  ledger: {
    visual: "ledger-table",
    diagram: {
      nodes: [
        n("payments", "service", "Payment service", "Emits a 'captured' event"),
        n("events", "event-stream", "Payment events", "Ordered per payment"),
        n("ledger-svc", "service", "Ledger service", "Turns events into balanced entries"),
        n("ledger", "relational-db", "Ledger", "Append-only journal"),
        n("bank", "partner-api", "Bank settlement", "What really moved"),
        n("recon", "batch-processing", "Reconciliation", "Compares the two nightly"),
      ],
      edges: [
        e("payments-events", "payments", "events", undefined, "stream"),
        e("events-ledger", "events", "ledger-svc", undefined, "async"),
        e("ledger-write", "ledger-svc", "ledger", "Debit = credit"),
        e("bank-recon", "bank", "recon", "Settlement file"),
        e("recon-ledger", "recon", "ledger", "Match"),
      ],
      flows: [
        {
          id: "post",
          name: "Post and reconcile",
          steps: [
            s("payments-events", "A $100 card payment is captured."),
            s("events-ledger", "The ledger service consumes the event (deduplicated by payment id)."),
            s("ledger-write", "It appends entries that sum to zero: debit the card-clearing account $100, credit the merchant $97 and fee revenue $3."),
            s("bank-recon", "Overnight, the bank sends what actually settled."),
            s("recon-ledger", "Every line is matched to ledger entries; anything unmatched is flagged for a human."),
          ],
        },
      ],
    },
  },

  "distributed-locks": {
    diagram: {
      nodes: [
        n("a", "service", "Server A", "Wants seat 12A"),
        n("b", "service", "Server B", "Also wants seat 12A"),
        n("locks", "cache", "Lock store", "lock:seat:12A with a TTL"),
        n("db", "relational-db", "Bookings DB", "Checks the fencing token"),
      ],
      edges: [
        e("a-lock", "a", "locks", "SET NX EX 30"),
        e("b-lock", "b", "locks", "SET NX EX 30"),
        e("a-db", "a", "db", "Write with token 33"),
        e("b-db", "b", "db", "Write with token 34"),
      ],
      flows: [
        {
          id: "contend",
          name: "Two servers, one seat",
          steps: [
            s("a-lock", "Server A sets lock:seat:12A only if it doesn't exist — it succeeds and gets fencing token 33."),
            s("b-lock", "Server B tries the same a moment later and fails, so it tells its user the seat is taken."),
            s("a-db", "A completes the booking, presenting token 33, then deletes the lock."),
          ],
        },
        {
          id: "crash",
          name: "Holder crashes",
          steps: [
            s("a-lock", "Server A takes the lock (token 33) and then freezes in a long pause."),
            s("b-lock", "After 30 s the lock expires; B takes it with token 34 and books the seat."),
            s("b-db", "B's write is stored with token 34."),
            s("a-db", "A wakes up and tries to write with token 33 — the database rejects it because 34 has been seen. That's what fencing tokens prevent."),
          ],
        },
      ],
    },
  },

  "back-pressure": {
    diagram: {
      nodes: [
        n("api", "service", "API", "Accepts uploads quickly"),
        n("queue", "message-queue", "Job queue", "Absorbs bursts"),
        n("workers", "service", "Workers", "Process at their own pace"),
        n("dlq", "message-queue", "Dead-letter queue", "Messages that keep failing"),
        n("autoscale", "observability", "Autoscaler", "Scales on queue depth"),
      ],
      edges: [
        e("api-queue", "api", "queue", "Enqueue", "async"),
        e("queue-workers", "queue", "workers", undefined, "async"),
        e("workers-dlq", "workers", "dlq", "After 5 failures", "async"),
        e("autoscale-workers", "autoscale", "workers", "Add workers"),
      ],
      flows: [
        {
          id: "spike",
          name: "Traffic spike",
          steps: [
            s("api-queue", "A viral moment brings 10× the usual uploads; the API just enqueues jobs and replies 'accepted'."),
            s("queue-workers", "Workers keep pulling at a steady rate; the queue grows instead of the system falling over."),
            s("autoscale-workers", "Queue depth crosses a threshold, so more workers are added until the backlog drains."),
          ],
        },
        {
          id: "poison",
          name: "Poison message",
          steps: [
            s("queue-workers", "One job crashes a worker every time it's tried."),
            s("workers-dlq", "After 5 attempts it moves to the dead-letter queue, so it stops blocking everything else and can be inspected."),
          ],
        },
      ],
    },
  },

  websockets: {
    diagram: {
      nodes: [
        n("alice", "mobile-client", "Alice", "Connected to node 1"),
        n("bob", "mobile-client", "Bob", "Connected to node 2"),
        n("lb", "load-balancer", "L4 load balancer", "Spreads long-lived connections"),
        n("n1", "realtime-gateway", "Gateway node 1", "Holds Alice's socket"),
        n("n2", "realtime-gateway", "Gateway node 2", "Holds Bob's socket"),
        n("registry", "cache", "Connection registry", "user → node"),
        n("bus", "event-stream", "Pub/sub bus", "Node-to-node delivery"),
      ],
      edges: [
        e("alice-lb", "alice", "lb", undefined, "ws"),
        e("bob-lb", "bob", "lb", undefined, "ws"),
        e("lb-n1", "lb", "n1", undefined, "ws"),
        e("lb-n2", "lb", "n2", undefined, "ws"),
        e("n1-registry", "n1", "registry", "Where is Bob?"),
        e("n1-bus", "n1", "bus", "To node 2", "stream"),
        e("bus-n2", "bus", "n2", undefined, "stream"),
      ],
      flows: [
        {
          id: "message",
          name: "Message across nodes",
          steps: [
            s("alice-lb", "Alice sends 'hi' over her open socket."),
            s("lb-n1", "It arrives at gateway node 1."),
            s("n1-registry", "Node 1 looks up Bob — he's on node 2."),
            s("n1-bus", "Node 1 publishes the message to node 2's channel."),
            s("bus-n2", "Node 2 receives it…"),
            s("lb-n2", "…and pushes it down Bob's socket instantly — no polling."),
          ],
        },
      ],
    },
  },

  "adaptive-bitrate-streaming": {
    diagram: {
      nodes: [
        n("upload", "object-storage", "Original upload", "One high-quality file"),
        n("transcoder", "media-transcoder", "Transcoder", "Makes a ladder of qualities"),
        n("renditions", "object-storage", "Renditions", "240p … 4K, cut into 4-s segments"),
        n("cdn", "cdn", "CDN", "Caches manifest and segments"),
        n("player", "web-client", "Player", "Measures bandwidth, picks quality per segment"),
      ],
      edges: [
        e("upload-transcoder", "upload", "transcoder", undefined, "async"),
        e("transcoder-renditions", "transcoder", "renditions", "HLS/DASH"),
        e("cdn-renditions", "cdn", "renditions", "Origin"),
        e("player-cdn", "player", "cdn", "Manifest + segments"),
      ],
      flows: [
        {
          id: "play",
          name: "Watch on a train",
          steps: [
            s("upload-transcoder", "After upload, the video is encoded at several bitrates."),
            s("transcoder-renditions", "Each rendition is cut into short segments and listed in a manifest."),
            s("player-cdn", "The player loads the manifest and starts at 720p from the nearest edge."),
            s("cdn-renditions", "Segments not yet at the edge are fetched from origin once."),
            s("player-cdn", "The train enters a tunnel; throughput drops, so the next segments come from the 360p rendition — no buffering, just lower quality until the signal returns."),
          ],
        },
      ],
    },
  },

  "presigned-urls": {
    diagram: {
      nodes: [
        n("app", "mobile-client", "App", "Has a 200 MB video to upload"),
        n("api", "service", "API", "Authorises and signs URLs"),
        n("storage", "object-storage", "Object storage", "Accepts the signed upload"),
        n("processor", "serverless", "Processor", "Runs when the upload lands"),
      ],
      edges: [
        e("app-api", "app", "api", "Request upload URL"),
        e("app-storage", "app", "storage", "PUT file (signed URL)"),
        e("storage-processor", "storage", "processor", "Object created", "async"),
      ],
      flows: [
        {
          id: "upload",
          name: "Upload directly",
          steps: [
            s("app-api", "The app asks the API for permission to upload; the API checks the user and returns a URL signed for one object, valid for 10 minutes."),
            s("app-storage", "The app uploads straight to storage — gigabytes never pass through the API servers."),
            s("storage-processor", "Storage emits an 'object created' event, which triggers validation and processing."),
          ],
        },
      ],
    },
  },

  "search-indexing": {
    diagram: {
      nodes: [
        n("app", "service", "Catalogue service", "Writes products"),
        n("db", "relational-db", "Database", "Source of truth"),
        n("cdc", "event-stream", "Change stream", "Every insert/update/delete"),
        n("indexer", "stream-processor", "Indexer", "Builds search documents"),
        n("index", "search", "Search index", "Inverted index + facets"),
        n("search", "service", "Search service", "Parses and ranks queries"),
        n("user", "web-client", "Shopper", "Types 'wireless headphones'"),
      ],
      edges: [
        e("app-db", "app", "db"),
        e("db-cdc", "db", "cdc", undefined, "cdc"),
        e("cdc-indexer", "cdc", "indexer", undefined, "stream"),
        e("indexer-index", "indexer", "index"),
        e("user-search", "user", "search"),
        e("search-index", "search", "index", "Query"),
      ],
      flows: [
        {
          id: "index",
          name: "Keep the index fresh",
          steps: [
            s("app-db", "A new product is saved."),
            s("db-cdc", "The database's change log publishes the insert."),
            s("cdc-indexer", "The indexer turns it into a search document (tokenised title, brand, price, rating)."),
            s("indexer-index", "It's added to the inverted index within seconds."),
          ],
        },
        {
          id: "query",
          name: "Search",
          steps: [
            s("user-search", "The shopper searches 'wireless headphones'."),
            s("search-index", "Each term maps straight to the products containing it; results are intersected, filtered by facets and ranked — milliseconds, no table scan."),
          ],
        },
      ],
    },
  },

  "geospatial-indexing": {
    visual: "geo-grid",
    diagram: {
      nodes: [
        n("driver", "mobile-client", "Driver app", "Sends GPS every 4 s"),
        n("location", "service", "Location service", "Moves drivers between cells"),
        n("geo", "cache", "Geo index", "cell id → drivers"),
        n("rider", "mobile-client", "Rider app", "Requests a ride"),
        n("matching", "service", "Matching", "Searches the rider's cell and neighbours"),
      ],
      edges: [
        e("driver-location", "driver", "location", undefined, "ws"),
        e("location-geo", "location", "geo", "Update cell"),
        e("rider-matching", "rider", "matching"),
        e("matching-geo", "matching", "geo", "Nearby cells"),
      ],
      flows: [
        {
          id: "match",
          name: "Find nearby drivers",
          steps: [
            s("driver-location", "A driver's position arrives."),
            s("location-geo", "Their id moves into the cell covering that position."),
            s("rider-matching", "A rider requests a ride."),
            s("matching-geo", "Matching reads the rider's cell and its 8 neighbours — a handful of lookups instead of scanning every driver in the city."),
          ],
        },
      ],
    },
  },

  "leader-election": {
    diagram: {
      nodes: [
        n("w1", "service", "Worker 1", "Current leader"),
        n("w2", "service", "Worker 2", "Follower"),
        n("w3", "service", "Worker 3", "Follower"),
        n("etcd", "coordination", "Coordination store", "Grants a lease to one worker"),
        n("job", "batch-processing", "Nightly job", "Must run exactly once"),
      ],
      edges: [
        e("w1-etcd", "w1", "etcd", "Hold lease"),
        e("w2-etcd", "w2", "etcd", "Watch"),
        e("w3-etcd", "w3", "etcd", "Watch"),
        e("w1-job", "w1", "job", "Run"),
        e("w2-job", "w2", "job", "Run"),
      ],
      flows: [
        {
          id: "failover",
          name: "Leader fails",
          steps: [
            s("w1-etcd", "Worker 1 holds the leader lease and renews it every few seconds."),
            s("w1-job", "Only the leader runs the nightly job."),
            s("w2-etcd", "Worker 1 crashes; its lease expires. Workers 2 and 3 race for it and the store grants it to exactly one — worker 2."),
            s("w2-job", "Worker 2 takes over the job. There's never a moment with two leaders holding valid leases."),
          ],
        },
      ],
    },
  },

  "id-generation": {
    visual: "snowflake-id",
    diagram: {
      nodes: [
        n("s1", "service", "Server 1 (worker 7)", "Generates IDs locally"),
        n("s2", "service", "Server 2 (worker 8)", "Generates IDs locally"),
        n("ranges", "coordination", "Worker registry", "Assigns each server a unique worker id once"),
        n("db", "wide-column-db", "Tweet store", "IDs sort by time"),
      ],
      edges: [
        e("s1-ranges", "s1", "ranges", "Claim worker id"),
        e("s2-ranges", "s2", "ranges", "Claim worker id"),
        e("s1-db", "s1", "db"),
        e("s2-db", "s2", "db"),
      ],
      flows: [
        {
          id: "generate",
          name: "Generate IDs",
          steps: [
            s("s1-ranges", "At start-up each server claims a unique worker id — the only coordination needed."),
            s("s1-db", "Server 1 builds IDs from time + worker 7 + a sequence: no network call per ID."),
            s("s2-db", "Server 2 does the same with worker 8 — the IDs can never collide, and both sort by creation time."),
          ],
        },
      ],
    },
  },

  "change-data-capture": {
    diagram: {
      nodes: [
        n("app", "service", "App", "Writes only to the database"),
        n("db", "relational-db", "Database", "Write-ahead log records every change"),
        n("connector", "service", "CDC connector", "Tails the log"),
        n("stream", "event-stream", "Change events", "One per row change"),
        n("search", "search", "Search index", "Stays in sync"),
        n("cache", "cache", "Cache invalidator", "Evicts stale keys"),
        n("warehouse", "data-warehouse", "Warehouse", "Analytics copy"),
      ],
      edges: [
        e("app-db", "app", "db"),
        e("db-connector", "db", "connector", "Read log", "cdc"),
        e("connector-stream", "connector", "stream", undefined, "stream"),
        e("stream-search", "stream", "search", undefined, "async"),
        e("stream-cache", "stream", "cache", undefined, "async"),
        e("stream-warehouse", "stream", "warehouse", undefined, "async"),
      ],
      flows: [
        {
          id: "sync",
          name: "One write, every copy updated",
          steps: [
            s("app-db", "The app updates a price in the database — and nothing else. No risky dual writes."),
            s("db-connector", "The connector reads the change from the database's own log."),
            s("connector-stream", "It publishes a change event with the before and after values."),
            s("stream-search", "The search index updates…"),
            s("stream-cache", "…the cache evicts the old value…"),
            s("stream-warehouse", "…and analytics gets the history. If any consumer is down, it catches up from the stream."),
          ],
        },
      ],
    },
  },

  "bloom-filter": {
    visual: "bloom-filter",
    diagram: {
      nodes: [
        n("parser", "service", "Link extractor", "Finds 50 links per page"),
        n("bloom", "cache", "Bloom filter", "In memory, ~10 bits per URL"),
        n("db", "wide-column-db", "URL store", "Exact record of every URL"),
        n("frontier", "message-queue", "URL frontier", "Pages still to crawl"),
      ],
      edges: [
        e("parser-bloom", "parser", "bloom", "Seen?"),
        e("parser-db", "parser", "db", "Only on 'maybe'"),
        e("parser-frontier", "parser", "frontier", "New URL", "async"),
      ],
      flows: [
        {
          id: "check",
          name: "Check a link",
          steps: [
            s("parser-bloom", "For each link, the filter is checked first. 'Definitely not seen' is the common answer — no database call at all."),
            s("parser-frontier", "Those links go straight to the frontier."),
            s("parser-db", "Only 'maybe seen' answers (including the ~1% false positives) are confirmed against the exact store."),
          ],
        },
      ],
    },
  },

  "prefix-trie": {
    visual: "prefix-trie",
    diagram: {
      nodes: [
        n("box", "web-client", "Search box", "Sends the prefix as you type"),
        n("suggest", "service", "Suggestion service", "One lookup per keystroke"),
        n("trie", "nosql-db", "Trie shards", "Top-k completions stored at each prefix"),
        n("logs", "event-stream", "Query log", "What people searched"),
        n("builder", "batch-processing", "Trie builder", "Rebuilds tries daily"),
      ],
      edges: [
        e("box-suggest", "box", "suggest", "GET /suggest?q=sys"),
        e("suggest-trie", "suggest", "trie", "Node 'sys'"),
        e("logs-builder", "logs", "builder", undefined, "stream"),
        e("builder-trie", "builder", "trie", "Publish"),
      ],
      flows: [
        {
          id: "suggest",
          name: "Suggest",
          steps: [
            s("box-suggest", "The user types 'sys'."),
            s("suggest-trie", "The service walks s → y → s and returns the top-k list stored at that node — no ranking at query time."),
          ],
        },
        {
          id: "build",
          name: "Rebuild",
          steps: [
            s("logs-builder", "Nightly, the builder counts yesterday's queries."),
            s("builder-trie", "It rebuilds the tries with fresh top-k lists at every prefix and publishes them."),
          ],
        },
      ],
    },
  },

  webrtc: {
    diagram: {
      nodes: [
        n("alice", "web-client", "Alice", "Starts a call"),
        n("bob", "mobile-client", "Bob", "Answers"),
        n("signal", "realtime-gateway", "Signalling", "Relays offers and network candidates"),
        n("turn", "webrtc-media", "TURN relay", "Used only when direct fails"),
      ],
      edges: [
        e("alice-signal", "alice", "signal", "Offer", "ws"),
        e("bob-signal", "bob", "signal", "Answer", "ws"),
        e("alice-turn", "alice", "turn", "Media"),
        e("bob-turn", "bob", "turn", "Media"),
      ],
      flows: [
        {
          id: "call",
          name: "Set up a call",
          steps: [
            s("alice-signal", "Alice's browser creates an offer (codecs, keys) and sends it through the signalling server."),
            s("bob-signal", "Bob's app answers; both exchange network candidates found via STUN."),
            s("alice-turn", "Most calls now connect directly peer-to-peer. If a firewall blocks that, media flows through the TURN relay instead…"),
            s("bob-turn", "…which forwards it to Bob. Servers only carry media when they have to."),
          ],
        },
      ],
    },
  },
};
