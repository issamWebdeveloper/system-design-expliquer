# System Design Explainer — Implementation Plan

Goal: one website that explains how to build large systems (YouTube, Instagram, Uber, …), shows an
interactive architecture diagram for each, and lets the reader switch the diagram between **AWS, Google
Cloud, Azure and Open-source / self-hosted**, with alternatives listed for every component.
Content comes from the PDFs (see [NOTES.md](NOTES.md)); there is **no PDF reader**.

## Status

| Milestone | State |
|---|---|
| 0 Repo cleanup | Done |
| 1 Unified data model | Done |
| 2 Diagram engine (ELK layout, URL state) | Done |
| 3 System page + walkthroughs | Done |
| 4 Content wave 1 (10 systems) | Done |
| 5 Catalogue, components, concepts, search | Done |
| 6 Content wave 2 (25 systems) | Done — 35 of 36 systems written up (Redis is diagram-only) |
| 7 Polish & deploy (mobile, a11y, OG images, static export, e2e) | Done |
| Phase 2 / Phase 3 | Not started |

Deviations from the original plan: concepts are validated TypeScript data rather than MDX; search is
a small built-in matcher instead of Pagefind/Fuse; diagrams have no minimap; provider icons are
generic (lucide) until the official icon licences are checked.

---

## 1. Current state of the repo

| Path | What it is | Decision |
|---|---|---|
| `archviz/` | Next.js 16 + React 19 + `@xyflow/react` + Tailwind 4. Has a diagram, provider selector, node detail panel, 5–7 apps | **Keep as the base** |
| `archviz/src/data/applications/*` + `cloudMappings.ts` + `types.ts` | Data model #1 (`serviceType`, providers incl. "generic") | Merge into one model |
| `archviz/src/data/architectures/*` + `cloud-providers.ts` | Data model #2 (`componentType`, 3 providers) — a parallel duplicate | Merge into one model |
| `system-design-atlas/` | Static HTML card library + embedded PDF reader, `data/designs.js` (auto-extracted notes) | **Delete**; its notes are superseded by `docs/NOTES.md` |
| `system-design-atlas/assets/pdfs/` | Copies of every PDF | **Delete** |
| `tools/build_site.py` | Generator for the atlas | **Delete** |
| `*.pdf` at repo root (59 files) | Source material | Move to `source-pdfs/` (git-ignored) or out of the repo |
| `archviz/.next`, `tsconfig.tsbuildinfo` | Build output | Delete, git-ignore |

### Target layout (single site at the repo root)

```
system-design-explainer/
├─ docs/                    NOTES.md, IMPLEMENTATION_PLAN.md, CONTENT_GUIDE.md
├─ src/
│  ├─ app/                  routes (see §4)
│  ├─ components/           diagram/, layout/, content/, ui/
│  ├─ content/
│  │  ├─ systems/           youtube.ts, instagram.ts, uber.ts … (one file per system)
│  │  ├─ concepts/          caching.mdx, sharding.mdx, rate-limiting.mdx …
│  │  └─ components.ts      component catalogue + provider mappings + alternatives
│  ├─ lib/                  layout (ELK), schema (zod), search index, provider resolve
│  └─ types/
├─ public/icons/            provider + generic component icons (SVG)
└─ package.json
```

## 2. Data model (the heart of the project)

One schema, validated with **Zod** at build time so a bad content file fails the build.

```ts
type Provider = "generic" | "aws" | "gcp" | "azure" | "oss";

// Catalogue entry — defined once, reused by every system
interface ComponentKind {
  id: "cdn" | "load-balancer" | "api-gateway" | "cache" | "event-stream" | ...;
  name: string;                 // "Event streaming"
  category: "edge" | "compute" | "data" | "messaging" | "analytics" | "ml" | "security" | "ops" | "client" | "external";
  what: string;                 // one-paragraph explainer
  whenToUse: string[];
  pitfalls: string[];
  providers: Record<Exclude<Provider,"generic">, ServiceOption[]>; // first = default
  concepts: string[];           // links to concept pages
}
interface ServiceOption { name: string; note?: string; managed: boolean; url?: string }

// A system (YouTube, Uber …)
interface SystemDesign {
  slug: string; name: string; tagline: string; category: Category;
  difficulty: 1 | 2 | 3; concepts: string[];
  requirements: { functional: string[]; nonFunctional: string[] };
  apis: { method: string; path: string; purpose: string }[];
  estimates: { label: string; value: string; derivation?: string }[];
  dataModel: { entity: string; store: string; key: string; fields: string[]; why: string }[];
  nodes: { id: string; kind: ComponentKind["id"]; label: string; role: string;
           overrides?: Partial<Record<Provider, string>>; group?: string }[];
  edges: { from: string; to: string; label?: string; protocol?: "https"|"grpc"|"ws"|"async"|"cdc" }[];
  flows: { id: string; name: string; steps: { edge: string; text: string }[] }[];   // animated walkthroughs
  bottlenecks: { problem: string; fix: string; nodes: string[] }[];
  scaling: string[]; extensions: string[];
  lld?: { classes: string[]; patterns: string[]; notes: string };                  // from the Go LLD PDFs
}
```

Key ideas:
- Diagrams store **component kinds**, never vendor names. The provider toggle resolves the label/icon
  through `components.ts`; `overrides` handles special cases (e.g. Netflix CDN → "Open Connect").
- **No hand-placed x/y coordinates.** Use `elkjs` (layered layout, left→right, grouped by tier) so new
  systems need only nodes + edges. Optionally pin a few positions.
- `flows` reference edges so the diagram can highlight a request path step-by-step.

### Component catalogue — starting mapping

| Component | AWS | Google Cloud | Azure | Open-source / alternatives |
|---|---|---|---|---|
| DNS / geo-routing | Route 53 | Cloud DNS | Azure DNS / Traffic Manager | CoreDNS, PowerDNS; Cloudflare |
| CDN | CloudFront | Cloud CDN / Media CDN | Azure Front Door | Varnish, Apache Traffic Server; Cloudflare, Fastly, Akamai |
| WAF / DDoS | AWS WAF, Shield | Cloud Armor | Azure WAF, DDoS Protection | ModSecurity, Coraza |
| Load balancer | ALB / NLB | Cloud Load Balancing | Load Balancer / Application Gateway | NGINX, HAProxy, Envoy, Traefik |
| API gateway | API Gateway | Apigee / API Gateway | API Management | Kong, Apache APISIX, Tyk, KrakenD |
| Auth / identity | Cognito | Identity Platform | Entra ID / External ID | Keycloak, Ory, Authentik |
| Containers | EKS / ECS (Fargate) | GKE / Cloud Run | AKS / Container Apps | Kubernetes, Nomad |
| Serverless functions | Lambda | Cloud Run functions | Azure Functions | Knative, OpenFaaS |
| Relational DB | RDS / Aurora | Cloud SQL / AlloyDB / Spanner | Azure SQL / Azure DB for PostgreSQL | PostgreSQL, MySQL, Vitess, CockroachDB |
| Wide-column | Keyspaces / DynamoDB | Bigtable | Cosmos DB (Cassandra API) | Cassandra, ScyllaDB, HBase |
| Document / KV | DynamoDB / DocumentDB | Firestore | Cosmos DB | MongoDB, CouchDB |
| Cache | ElastiCache / MemoryDB | Memorystore | Azure Managed Redis | Redis, Valkey, Memcached, Dragonfly |
| Object storage | S3 | Cloud Storage | Blob Storage | MinIO, Ceph |
| Message queue | SQS / SNS | Pub/Sub / Cloud Tasks | Service Bus / Queue Storage | RabbitMQ, NATS |
| Event streaming | MSK / Kinesis | Pub/Sub / Managed Kafka | Event Hubs | Kafka, Redpanda, Pulsar |
| Stream processing | Managed Service for Apache Flink | Dataflow | Stream Analytics | Flink, Spark Structured Streaming |
| Batch / data lake | EMR / Glue | Dataproc | HDInsight / Fabric | Spark, Trino, Hadoop |
| Warehouse / OLAP | Redshift | BigQuery | Synapse / Fabric | ClickHouse, Apache Druid, Pinot |
| Search | OpenSearch Service | Vertex AI Search / Elastic Cloud | Azure AI Search | Elasticsearch, OpenSearch, Solr, Meilisearch |
| Vector search | OpenSearch k-NN / Aurora pgvector | Vertex AI Vector Search | Azure AI Search / Cosmos DB vector | pgvector, Milvus, Qdrant, Weaviate |
| Graph DB | Neptune | Spanner Graph | Cosmos DB (Gremlin) | Neo4j, JanusGraph |
| Time-series | Timestream | Bigtable | Azure Data Explorer | TimescaleDB, InfluxDB, Prometheus |
| Video transcoding | Elemental MediaConvert | Transcoder API | (Media Services retired) → FFmpeg on AKS | FFmpeg, GStreamer |
| Real-time / WebSocket | API Gateway WebSocket / AppSync | Firebase RTDB / self-hosted on GKE | Web PubSub / SignalR Service | Socket.IO, Centrifugo, NATS |
| WebRTC / TURN | Kinesis Video Streams WebRTC / Chime SDK | — (self-host on GKE) | Azure Communication Services | coturn, Pion, LiveKit, mediasoup, Janus |
| Push notifications | SNS mobile push | Firebase Cloud Messaging | Notification Hubs | ntfy, Gotify (+ APNs/FCM directly) |
| Email / SMS | SES / End User Messaging | — (partners) | Azure Communication Services | Postal; Twilio, SendGrid |
| Maps / geo | Amazon Location Service | Google Maps Platform | Azure Maps | OpenStreetMap, OSRM, PostGIS, H3 |
| ML / recommendations | SageMaker / Personalize | Vertex AI | Azure Machine Learning | Kubeflow, MLflow, Feast |
| Workflow / orchestration | Step Functions / MWAA | Workflows / Cloud Composer | Logic Apps / Durable Functions | Temporal, Airflow |
| Coordination / config | AppConfig / DynamoDB locks | — | App Configuration | ZooKeeper, etcd, Consul |
| Secrets / keys | Secrets Manager / KMS | Secret Manager / Cloud KMS | Key Vault | OpenBao, Vault, SOPS |
| Metrics & tracing | CloudWatch / X-Ray | Cloud Monitoring / Trace | Azure Monitor / App Insights | Prometheus, Grafana, Jaeger, OpenTelemetry |
| Logs | CloudWatch Logs | Cloud Logging | Log Analytics | ELK / OpenSearch, Loki |
| Infra as code | CloudFormation / CDK | Infrastructure Manager | Bicep / ARM | Terraform, OpenTofu, Pulumi |
| Payments (external) | — | — | — | Stripe, Razorpay, Adyen, PayPal |

> Verify each mapping against current provider docs while writing `components.ts` (services get
> renamed/retired — e.g. Azure Media Services and Amazon Pinpoint). Add a `lastVerified` date per row.

## 3. Website features

### MVP
1. **System catalogue** – home page grid of all systems, filter by category / difficulty / concept used, global search (⌘K).
2. **System page** in the 9-step HLD structure from the PDFs: requirements, APIs, estimates, data model, architecture, flows, bottlenecks, scaling, extensions — with a sticky section nav.
3. **Interactive architecture diagram** (React Flow): pan/zoom, minimap, grouped tiers (edge / services / data / async / analytics), edge labels with protocol.
4. **Cloud provider switcher** – Generic · AWS · GCP · Azure · Open-source. Node labels and icons swap live; choice persists in the URL (`?cloud=aws`) so links are shareable.
5. **Component detail panel** – click a node: what it does in *this* system, the chosen provider's service, every alternative across providers/OSS, when to use, pitfalls, and links to concept pages.
6. **Request-flow walkthroughs** – "Play: upload a video", "Play: request a ride": highlights edges step-by-step with a narration caption.
7. **Component catalogue page** – the full mapping table above, filterable, plus "which systems use this".
8. **Concept library** – caching, sharding, rate limiting, fan-out, idempotency, sagas, geo-indexing, ABR streaming, consistent hashing, etc., each linking back to systems.
9. **Back-of-the-envelope widgets** – estimates shown as derivations (DAU × actions ÷ 86 400 = QPS).
10. Dark/light theme, responsive (diagram falls back to a vertical list on phones), static export.

### Phase 2
11. **Compare view** – two providers (or two systems) side-by-side.
12. **Bottleneck overlay** – toggle that highlights hotspot nodes and shows the fix.
13. **Export** – diagram as PNG/SVG, and the stack as a Markdown/Terraform-module checklist.
14. **"Build your own" mode** – start from a template, add/remove components, provider resolves automatically; saved in localStorage / share-link.
15. **Rough cost hints** – qualitative cost tier per component per provider (no live pricing).

### Phase 3
16. **LLD tab** for systems with a Go LLD PDF: class diagram (Mermaid), patterns used, concurrency notes.
17. **LLD-only pages** (ATM, Elevator, Chess, Ludo, Blackjack, Jigsaw, Vending, Library, Parking).
18. **Interview prep** – Q&A cards from *Technical Interview Questions*; "explain this system in 45 min" checklist per system.
19. Quizzes per system.

## 4. Routes

```
/                         catalogue
/systems/[slug]           system page (?cloud=aws&flow=upload)
/components               component catalogue
/components/[id]          one component across providers
/concepts/[slug]          concept explainer
/compare                  compare providers / systems
/lld/[slug]               phase 3
/interview                phase 3
```

## 5. Tech stack

- **Next.js (App Router) with `output: "export"`** – fully static, host anywhere (Vercel, Netlify, GitHub Pages, S3+CloudFront).
- **@xyflow/react** (already present) for diagrams + **elkjs** for automatic layout.
- **Tailwind 4** (already present) + **shadcn/ui** primitives; **lucide-react** icons.
- **Zod** for content validation; **MDX** (`@next/mdx`) for concept pages.
- **Pagefind** or **Fuse.js** for client-side search.
- Provider icons: official AWS/Azure/GCP architecture icon sets (check each licence); simple generic SVGs otherwise.
- **Vitest** for schema/resolver tests, **Playwright** smoke tests (provider switch, node click, flow play).

## 6. Milestones

| # | Milestone | Output |
|---|---|---|
| 0 | **Repo cleanup** | Delete `system-design-atlas/`, `tools/`, `.next/`; move `archviz/` contents to repo root; move PDFs to git-ignored `source-pdfs/`; update README; one `git` history |
| 1 | **Unify data model** | Single `types/`, `content/components.ts` (table in §2), Zod schemas, delete the two old models; port existing YouTube/Instagram/Uber/Amazon diagrams to new format |
| 2 | **Diagram engine** | ELK auto-layout, tier groups, provider resolver, icons, URL-synced provider state, detail panel with alternatives |
| 3 | **System page** | 9-section layout, estimates widget, data-model table, flow walkthrough player |
| 4 | **Content wave 1 (flagships)** | YouTube, Netflix, Instagram, Twitter, Messenger, Uber, Amazon, Payments, URL shortener, Rate limiter |
| 5 | **Catalogue, components & concepts pages, search** | Home grid, `/components`, ~20 concept MDX pages |
| 6 | **Content wave 2** | Remaining HLD systems (Maps, Dropbox, Airbnb, Zomato, BookMyShow, MakeMyTrip, Airline, Practo, Urban Company, Porter, Driver fleet, NoBroker, Quora, LinkedIn, Typeahead, Crawler, Pastebin, BNPL, Brokerage, Payment gateway, AstroTalk, Sports, WebSocket, WebRTC, Car rental, Meeting scheduler) |
| 7 | **Polish & deploy** | Mobile layout, a11y, OG images per system, static deploy, Playwright smoke tests |
| 8 | Phase 2 → Phase 3 features | Compare, export, builder, LLD, interview prep |

### Content authoring workflow (per system)
1. Read the PDF text (and its duplicate/LLD sibling) → fill the `SystemDesign` file section by section.
2. Model nodes using only catalogue kinds; add `overrides` only when a system uses something specific.
3. Write 1–3 `flows`.
4. `npm run validate` (Zod) → visual check with each provider → commit.

## 7. Risks / decisions

- **Mapping accuracy** – cloud product names change; keep a `lastVerified` field and a single source file.
- **Diagram readability** for 25+ node systems – rely on tier grouping, collapsible groups and flow highlighting rather than showing everything at once.
- **Copyright of PDF sources** – rewrite content in our own words (the PDFs quote blogs and DEV posts); keep only short attributions.
- **Scope** – 46 topics is a lot; ship wave 1 (10 systems) before anything in Phase 2.
