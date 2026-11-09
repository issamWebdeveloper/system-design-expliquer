# Depth Improvements Plan

Turns the ten suggested improvements (deeper architecture, interactive capacity, database design,
cloud configs, security, reliability, cost, observability, interview prep, implementation) into a
build plan that fits the current codebase.

---

## 0. The key idea: define depth once per component kind

The site has **36 systems → 529 diagram nodes → only 36 component kinds**. Writing failure modes,
security controls, metrics and prices for 529 nodes by hand isn't realistic; writing them for 36
kinds is. Every new feature therefore has two layers:

1. **Kind-level defaults** in `src/content/components.ts` — how a *cache* fails, what a *relational DB*
   should be monitored for, how an *API gateway* is secured, how *object storage* is priced. Every
   system gets these automatically.
2. **System-level overrides** in `src/content/systems/*.ts` — only where a system is special (Uber's
   geo index, the payment ledger). Written in depth for the 10 flagship systems first.

All new fields are **optional** in the Zod schema, so sections appear as content is added and the
site never breaks mid-rollout. `npm run validate` gains checks for each new field.

---

## 1. Interactive capacity calculator  ★ build first

Foundation for cost, sizing and failure simulation.

**Schema** — `estimates` becomes a small model:

```ts
capacity: {
  inputs: [
    { id: "dau", label: "Daily active users", default: 500e6, unit: "users", min: 1e3, max: 5e9, scale: "log" },
    { id: "actionsPerUser", label: "Requests per user per day", default: 5 },
    { id: "payloadKB", label: "Average payload", default: 2, unit: "KB" },
    { id: "readRatio", label: "Reads per write", default: 100 },
    { id: "retentionDays", label: "Retention", default: 1825, unit: "days" },
    { id: "replication", label: "Replication factor", default: 3 },
    { id: "peakFactor", label: "Peak / average", default: 3 },
  ],
  outputs: [
    { id: "qps", label: "Average requests/s", formula: "dau * actionsPerUser / 86400", unit: "req/s" },
    { id: "peakQps", label: "Peak requests/s", formula: "qps * peakFactor" },
    { id: "storage", label: "Storage", formula: "writesPerDay * payloadKB * retentionDays * replication", unit: "KB" },
    …
  ],
  sizing: [  // turns outputs into infrastructure
    { node: "api", per: "peakQps", capacityPerInstance: 2000, label: "API instances" },
    { node: "cache", per: "hotDataGB", capacityPerInstance: 50, label: "Cache nodes" },
  ],
}
```

**UI**
- Sliders and inputs with log scales for big numbers; presets: *Startup · Growth · Hyperscale*.
- Every output shows its formula with live numbers substituted, keeping the teaching value.
- A sizing table (instances, shards, cache nodes, bandwidth); diagram nodes get a small "×12" badge.
- Inputs stored in the URL, so a scenario can be shared.

**Engineering**
- A tiny safe expression evaluator (no `eval`), such as `expr-eval`, or a 100-line parser.
- The validator evaluates every model with its defaults: all outputs must be finite, formulas may only
  reference declared ids, and defaults should reproduce today's published numbers.

---

## 2. Deeper database design

Extend each `dataModel` entry:

```ts
{
  entity: "Message",
  store: "wide-column-db",
  partitionKey: "conversationId",
  sortKey: "messageId (time-ordered)",
  indexes: [{ name: "by_sender", keys: ["senderId", "createdAt"], why: "Moderation lookups" }],
  queryPatterns: [
    { query: "Latest 50 messages in a conversation", uses: "partition + sort desc", cost: "1 partition read" },
    { query: "Unread count per user", uses: "counter in cache", cost: "O(1)" },
  ],
  consistency: "Quorum writes, local-quorum reads",
  ttl: "None (user-deletable)",
  sizePerRow: "≈ 500 B",
}
```

- A **"query → index" matrix** per system shows which access pattern hits which key or index. This
  is the most common interview gap.
- Hot-partition warnings computed from the capacity model (e.g. a celebrity partition exceeding
  per-partition throughput).
- Optional generated DDL / table definitions per store (PostgreSQL `CREATE TABLE`, DynamoDB key
  schema, Cassandra CQL).

---

## 3. Cloud mapping with real configurations and trade-offs

Extend each provider option in `components.ts`:

```ts
{ name: "Amazon DynamoDB",
  configs: [
    { name: "On-demand", whenToUse: "Spiky or unknown traffic", tradeoff: "≈ 6–7× cost at steady load" },
    { name: "Provisioned + auto-scaling", whenToUse: "Predictable load", tradeoff: "Throttling on sudden spikes" },
  ],
  limits: ["400 KB item size", "3,000 RCU / 1,000 WCU per partition"],
  example: "terraform snippet or console settings",
  lastVerified: "2026-10" }
```

- **Compare view:** pick a component and see AWS, GCP, Azure and OSS side by side (configs, limits,
  managed vs self-hosted operations burden, lock-in level).
- Per-system **"why this choice"** notes on the nodes where the choice matters.
- Every row is stamped with `lastVerified`, and the validator flags rows older than 12 months.

---

## 4. Security architecture

**Kind-level controls** (written once): for example, *API gateway* → authentication, rate limiting,
WAF, request validation; *relational DB* → encryption at rest, TLS, least-privilege roles, private
subnet; *object storage* → block public access, pre-signed URLs, bucket policies, KMS keys.

**System-level section** — new page section *Security*:
- Identity: OAuth 2.0 / OIDC flows, token lifetimes, service-to-service auth (mTLS or workload
  identity).
- Authorization: RBAC/ABAC model, e.g. owner/editor/viewer for Dropbox folders, merchant scopes for
  payments.
- Data classification per store (public / internal / PII / payment), with encryption and retention rules.
- Secrets management and rotation.
- Tenant isolation strategy where relevant (row-level, schema-per-tenant, account-per-tenant).
- Threats: a mini threat model of 3–5 STRIDE-style threats with mitigations.

**Diagram security overlay**: a toggle draws trust boundaries (internet / DMZ / private / PCI zone),
lock icons on encrypted connections and data-classification badges on stores.

**Provider mapping** for identity: AWS IAM roles · GCP service accounts / Workload Identity · Azure
Managed Identities · OSS SPIFFE/SPIRE; secrets: Secrets Manager · Secret Manager · Key Vault ·
OpenBao/Vault. Most of these kinds already exist in the catalogue.

**New concepts**: OAuth/OIDC, least-privilege IAM, RBAC vs ABAC, envelope encryption, mTLS / zero
trust, tenant isolation, secrets rotation.

---

## 5. Reliability: SLOs and the failure simulator

**Reliability section per system**
```ts
reliability: {
  slos: [{ sli: "Playback start success", target: "99.95%", window: "30d" },
         { sli: "p99 start latency", target: "< 2 s" }],
  rto: "15 min", rpo: "≤ 1 min (async cross-region replication)",
  deployment: "Multi-AZ; active-passive region",
}
```
- Error-budget explainer (99.95% ≈ 21.6 min/month), computed from the target.

**Failure simulator** — the standout feature:
- **Kind-level failure templates:** *cache down* → callers fall through to the DB, load × (1/miss rate);
  *DB primary down* → writes fail until failover (RTO), reads continue on replicas; *event-stream lag*
  → async consumers delayed, producers unaffected; *CDN miss storm* → origin egress spikes;
  *AZ failure* → nodes in that zone are lost; *network partition* → splits the graph.
- **Propagation** computed on the existing graph: walk upstream from the failed node along
  synchronous edges (`https`, `grpc`, `ws`) to find user-facing impact; async edges (`async`, `stream`)
  stop the cascade and show "queue growing" instead. No hand-written cascade is needed per system.
- **UI:** a "Break something" menu on the diagram. Failed nodes turn red, affected paths turn amber,
  queues pulse, and a side panel lists user impact, which SLOs burn, and recommended mitigations
  (circuit breaker, replica, fallback, multi-AZ), each linking to a concept page.
- **"Fix it" toggle:** apply a mitigation and re-run the simulation to show the improvement.
- Uses capacity outputs to quantify impact ("DB receives 120k req/s instead of 6k").

---

## 6. Cloud cost estimator

- **Kind-level pricing units:** compute per vCPU-hour, storage per GB-month, requests per million,
  egress per GB, managed DB per instance-hour, and so on, for AWS, GCP and Azure, plus an OSS model
  (raw compute + storage + an "ops overhead" factor in engineer-hours).
- **Monthly estimate** = capacity sizing × unit prices, shown per component and per provider, as a
  **range** (low/high), never a single precise figure.
- Charts: stacked bar per provider; the top 3 cost drivers highlighted (usually egress/CDN,
  storage, compute).
- Savings tips per kind: reserved or committed use, tiered storage, CDN offload, right-sizing, spot
  workers for transcoding.
- **Data source:** a curated `pricing.ts` snapshot with a `lastVerified` date first. Later, a build-time
  script refreshes it from the public price APIs (AWS Price List, Azure Retail Prices, GCP Cloud
  Billing Catalog), keeping the site static.
- Clear disclaimer: region, discounts and data transfer vary; the numbers are for comparing designs,
  not budgeting.

---

## 7. Observability

- **Kind-level golden signals:** for example, *service* → latency, traffic, errors, saturation;
  *event stream* → consumer lag, partition skew; *cache* → hit ratio, evictions, memory;
  *relational DB* → replication lag, connections, slow queries.
- **Per-system section:** key dashboards, top 5 alerts (symptom-based, tied to SLOs), log fields to
  capture, and a correlation-id strategy.
- **Trace view of walkthroughs:** each flow step gets a latency budget, and the walkthrough also
  renders as a distributed-trace waterfall, which teaches tracing and shows where time goes.
- Provider mapping already exists (CloudWatch/X-Ray · Cloud Monitoring/Trace · Azure Monitor ·
  Prometheus/Grafana/OpenTelemetry/Jaeger); add example alert rules and OTel config snippets.

---

## 8. Interview preparation

Per system:
```ts
interview: {
  questions: [
    { q: "How do you avoid double-booking a seat?",
      followUps: ["What if the cache holding the lock fails?"],
      goodAnswer: ["Short TTL hold", "DB unique constraint as final guard", "Idempotent confirm"],
      redFlags: ["Only a DB transaction under 250k concurrent users"] },
  ],
  rubric: { requirements: …, estimates: …, dataModel: …, scaling: …, tradeoffs: … },
}
```
- **Mock interview mode:** a 45-minute timer with the standard phases (clarify → estimate → API →
  data → design → deep dive → wrap-up), hints revealed in a ladder, and a self-scoring rubric.
- **Flashcards** generated from concepts and bottlenecks; "explain this diagram in 2 minutes" drills.
- Progress (questions attempted, scores) stored locally in the browser.

---

## 9. Implementation mode

Don't attempt 36 systems × 4 languages. Instead:

- **A separate repo `system-design-labs`**, linked from the site, with **reference implementations for
  4–5 flagship systems** chosen to cover different patterns:
  | System | Pattern it teaches | Primary stack |
  |---|---|---|
  | URL shortener | IDs, caching, KV store | Go |
  | Rate limiter | Redis + Lua, middleware | Node.js (TypeScript) |
  | Chat (WhatsApp) | WebSockets, pub/sub, offline delivery | Go |
  | Checkout saga (Amazon) | Saga, idempotency, outbox | Java/Spring Boot |
  | Payment ledger | Double-entry, idempotent APIs | Python/FastAPI |
- Each lab includes `docker-compose.yml` (Postgres, Redis, Redpanda/Kafka, MinIO), tests, k8s
  manifests or a Helm chart, and optional Terraform modules per cloud that reuse the component →
  provider mapping.
- **Exercises:** "add a cache and measure p99", "kill Redis and observe the fallback", "shard the
  table" — linked from the failure simulator and the capacity calculator.
- On the site: a **Code tab** on each flow step showing the relevant snippet in the chosen language,
  pulled from the labs repo at build time so it never drifts.

---

## 10. Deeper architecture (cross-cutting)

- **Zoomable diagrams:** a high-level view (current) with "expand" on a node to show its internals
  (e.g. the matching service's candidate search → ETA ranking → lock → offer pipeline).
- **Sequence diagrams** generated from each flow (Mermaid), alongside the animated walkthrough.
- **Decision records:** 2–3 "we chose X over Y because…" ADR cards per flagship system.
- **Evolution view:** v1 (monolith + one DB) → v2 (cache + replicas) → v3 (sharded, multi-region), so
  learners see *why* each component exists.

---

## Prioritised roadmap

| # | Feature | Why now | Effort (flagship 10 + kind defaults) |
|---|---|---|---|
| 1 | Capacity calculator | Foundation for cost, sizing and simulation; high engagement | 4–5 days |
| 2 | DB design depth + reliability/SLO fields | Content depth interviewers probe most | 4–6 days |
| 3 | Failure simulator | Signature feature; reuses graph + capacity | 6–8 days |
| 4 | Security + observability sections and overlays | Closes the biggest content gaps | 6–8 days |
| 5 | Interview mode | Strong learning value, mostly content | 4–5 days |
| 6 | Cost estimator | Needs capacity + sizing; pricing data must be maintained | 5–7 days |
| 7 | Cloud configs & trade-offs, compare view | Builds on the catalogue | 3–4 days |
| 8 | Implementation labs repo | Largest scope; run in parallel with the above | 2–3 weeks for 5 labs |
| 9 | Zoomable diagrams, sequence diagrams, evolution view | Polish on top of depth | 5–7 days |

Rollout: each feature ships first for the 10 flagship systems plus kind-level defaults for all 36,
then deepens system by system. Combine with Phases 1–3 of `REDESIGN_PLAN.md` so the new panels land
in the redesigned system workspace rather than being added to the current long page.

## Risks and how to handle them

| Risk | Mitigation |
|---|---|
| Cost numbers look precise but are wrong | Show ranges, date-stamp prices, add a disclaimer, frame as comparison |
| Content volume explodes | Kind-level defaults first; flagships deep, others shallow-but-correct |
| Simulator oversimplifies | Label it as a model; show the rule used ("sync edge → impact propagates") |
| Cloud facts go stale | `lastVerified` on every provider row and price; validator warns after 12 months |
| Labs drift from the site | Pull snippets from the labs repo at build time; CI runs the labs' tests |
