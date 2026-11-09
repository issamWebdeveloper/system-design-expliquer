# System Design Notes (distilled from the 59 PDFs)

These notes are the content source for the explainer site. They replace the PDF reader: the site
ships the *knowledge* from the PDFs, not the PDFs themselves.

---

## 1. Inventory and de-duplication

59 files → **46 unique topics** once duplicates and HLD/LLD pairs are merged.

| Exact / near duplicates | Action |
|---|---|
| `Dropbox High Level Design.pdf` = `Dropbox High Level Design (1).pdf` (byte-identical) | keep one |
| `AstroTalk-like Platform HLD.pdf`, `... (1).pdf`, `HLD for AstroTalk.pdf` | merge into one AstroTalk page (the 16k-word "HLD for AstroTalk" is the richest) |
| `Meeting Scheduler System Design.pdf` + `Designing a Meeting Scheduler System.pdf` | merge |
| `Parking Lot System Design.pdf` + `Parking Lot Management System HLD.pdf` | merge (HLD + LLD tabs) |
| `Smart Vending Machine System Design.pdf` + `Design of a Vending Machine System (LLD in Go).pdf` | merge (HLD + LLD tabs) |
| `Designing an Online Stock Brokerage System.pdf` + `High-Level System Design_ Online Stock Brokerage Platform.pdf` | merge |
| `Amazon-Like ... System Design.pdf` + `Amazon-Style ... in Go.pdf` | merge (HLD + LLD tabs) |
| `High-Level Design_ Airline Management System.pdf` + `Airline Management System Design in Go.pdf` | merge |
| `Quora-like Q&A ... Architecture.pdf` + `Q&A Platform Design in Go.pdf` | merge |
| `Ride-Sharing ... (Uber-Like).pdf` + `Uber Low Level Design.pdf` | merge |
| `YouTube-like Video Streaming ... Design.pdf` + `Youtube Low level design.pdf` | merge |

## 2. Catalogue (proposed site categories)

**Media & Social** — YouTube, Netflix, Instagram, Twitter/X, Facebook Messenger chat, LinkedIn, Quora
**Mobility & Logistics** — Uber, Driver booking & fleet management, Porter logistics, Google Maps, Car rental
**Commerce & Fintech** — Amazon, Payment gateway, Digital payments (PayPal/Paytm/PhonePe), BNPL credit (LazyPay), Stock brokerage
**Bookings & Marketplaces** — BookMyShow, MakeMyTrip, Airline management, Airbnb, NoBroker real estate, Zomato food delivery, Urban Company home services, Practo teleconsultation, AstroTalk, Meeting scheduler, Real-time sports
**Building blocks / Infra** — URL shortener, Pastebin, API rate limiter, Typeahead, Web crawler, Dropbox file sync, WebSocket at scale, WebRTC at scale
**Low-level design (Go, OOP)** — ATM, Vending machine, Elevator, Parking lot, Library, Chess, Ludo, Blackjack, Jigsaw puzzle, Movie ticket booking
**Interview prep** — Technical Interview Questions (Go/concurrency, AWS & multi-cloud, DevOps, microservices, managerial, culture-fit)

## 3. The template every HLD PDF follows

Almost every HLD document uses the same 9 steps. The site should use this as the page skeleton:

1. **Requirements** – functional + non-functional (latency, availability, consistency, scale)
2. **API definitions** – REST/gRPC/WebSocket endpoints
3. **Back-of-the-envelope estimates** – DAU, QPS, storage/day, bandwidth
4. **Data model** – tables/collections, partition keys, which store and why
5. **High-level components** – the box diagram
6. **Detailed flows** – upload, feed, match, checkout, etc. (sequence of hops)
7. **Bottlenecks & resolutions**
8. **Scalability** – sharding, replication, load balancing, multi-region
9. **Optional features / extensions**

LLD PDFs follow a different template: requirements → entities/classes → design patterns
(State, Strategy, Observer, Factory, Singleton) → concurrency → Go code sketches.

## 4. Technology frequency across the PDFs

Counted across all documents (how many PDFs mention it ≥2 times):

- **Redis** – in nearly every HLD (cache, sessions, counters, geo index, pub/sub, distributed locks, seat holds)
- **Kafka** – event backbone in ~30 designs (upload→transcode, ride events, order events, fan-out, analytics)
- **Elasticsearch / OpenSearch** – search for catalogues, listings, restaurants, videos, users
- **CDN** – every media/consumer system; Netflix/YouTube/Maps/Airbnb lean on it heavily
- **WebSocket** – chat, ride tracking, stock tickers, sports scores, booking seat maps
- **Cassandra / Bigtable / HBase / DynamoDB** – high-write feeds, messages, metadata, timelines
- **PostgreSQL / MySQL** – transactional core (orders, payments, bookings, users)
- **S3 / object storage** – media, documents, pastes, backups
- **JWT / OAuth** – auth at the gateway
- **Kubernetes, Prometheus, Grafana, ELK, Jaeger** – ops layer
- **Stripe / Razorpay / Twilio / FCM / APNs** – third-party payments, SMS/voice, push

## 5. Cross-cutting patterns (concept library)

These show up repeatedly and deserve their own explainer pages linked from every system that uses them:

| Concept | Where it appears |
|---|---|
| Caching (cache-aside, write-through, TTL, hot-key handling) | almost all |
| Read replicas & sharding (hash/range, partition keys) | ~30 designs |
| Rate limiting (token bucket, sliding window; Redis counters) | ~30 designs, own PDF |
| Circuit breakers, retries, timeouts | ~24 designs |
| Multi-region / active-active, geo-DNS | ~24 designs |
| Idempotency keys (payments, bookings, retries) | ~23 designs |
| Distributed locks / seat & slot holds with TTL | BookMyShow, Airline, MakeMyTrip, Urban Company, Meeting scheduler |
| Fan-out on write vs read (celebrity problem) | Twitter, Instagram, Quora, LinkedIn |
| Double-entry ledger, reconciliation | Payments, BNPL, Brokerage, Payment gateway |
| Saga / compensating transactions | Amazon, MakeMyTrip |
| CQRS / event-driven read models | Payments, NoBroker |
| Geospatial indexing (S2, Geohash, QuadTree, H3) | Uber, Driver fleet, Porter, Maps, Zomato |
| Adaptive bitrate streaming (HLS/DASH), transcoding pipeline | YouTube, Netflix |
| Chunked/resumable upload, pre-signed URLs, dedupe by hash | Dropbox, YouTube, Instagram |
| Consistent hashing | WebSocket gateway, Rate limiter, Cache clusters |
| ID generation (Snowflake, Base62) | Twitter, URL shortener, Pastebin |
| Trie / prefix index | Typeahead |
| Bloom filters, URL frontier, politeness | Web crawler |
| Back-pressure, dead-letter queues | WebSocket, Crawler, Payments |
| Signalling + STUN/TURN + SFU | WebRTC, Practo, AstroTalk |
| Leader election (ZooKeeper/etcd) | Crawler, Quora, Rate limiter |

## 6. Per-system key notes (components the site must show)

**YouTube** – Clients → DNS/LB → API gateway → services (Upload, Video, User, Comment, Like, Search, Recommendation) · chunked upload to object storage → Kafka job → FFmpeg transcode workers (240p–1080p) → object storage → CDN with HLS/DASH · metadata in Bigtable/NoSQL, search in Elasticsearch, Redis for hot counters · Estimates: ~500 h uploaded/min, ~250 TB/day new video, ~30k avg QPS. Bottlenecks: transcode CPU (autoscale/GPU), hot videos (cache counters, async write-back), CDN saturation.
**Netflix** – Open Connect-style CDN, S3 masters, per-title encoding, Cassandra for viewing history, MySQL for billing, Spark/Kafka for recommendations.
**Instagram** – Pre-signed upload to S3, image resizing workers, PostgreSQL (users/media metadata, sharded), Cassandra feeds, Redis/Memcached, hybrid fan-out for feeds, Elasticsearch for search.
**Twitter** – Snowflake IDs, fan-out-on-write to Redis timelines with fan-out-on-read for celebrities, Cassandra/Manhattan-style tweet store, Elasticsearch search, Kafka trends.
**Messenger chat** – WebSocket gateways with session registry in Redis, Cassandra message store partitioned by conversation, Kafka for delivery, FCM/APNs for offline, S3 for media, read receipts/presence.
**Uber** – Driver location pings over WebSocket every few s → location service (Redis geo / S2 cells) → matching service → trip service (state machine) → pricing/surge → payments (Stripe) → Kafka → Flink/Spark analytics.
**Google Maps** – Tile service + CDN, routing (graph partitioning, contraction hierarchies), traffic ingest via Kafka, geocoding + Elasticsearch place search, ETA service.
**Amazon** – Catalogue (Elasticsearch), cart (Redis/DynamoDB), order service with Saga across inventory/payment/shipping, Kafka events, gRPC internally, JWT at edge.
**Payments / Payment gateway / BNPL** – Idempotency keys, double-entry ledger in RDBMS, Kafka events, CQRS read models, fraud/risk scoring, reconciliation batch jobs, PCI tokenisation vault.
**Stock brokerage** – Order management + risk checks, exchange gateway (FIX), WebSocket market-data fan-out, Kafka, ledger.
**BookMyShow / Airline / MakeMyTrip** – Inventory with seat holds (Redis TTL locks or `SELECT … FOR UPDATE`), payment then confirm, Saga for multi-vendor bookings, Elasticsearch search, aggressive caching of availability.
**Zomato / Urban Company / Porter / Driver fleet** – Geo search, dispatch/matching, live tracking over WebSocket, Kafka order events, notifications via FCM/Twilio.
**Airbnb / NoBroker** – Listing search (Elasticsearch + geo), availability calendar, booking with holds, messaging, reviews, payments, image CDN.
**Practo / AstroTalk** – Provider discovery, slot booking, chat/voice/video via WebRTC (TURN) or Twilio, wallet/per-minute billing, prescriptions/records storage.
**URL shortener / Pastebin** – Base62 IDs or key-generation service, KV store (DynamoDB/Cassandra), Redis cache, 301 redirect, expiry cleanup, S3 for paste blobs.
**Rate limiter** – Token bucket / sliding window counters in Redis (Lua for atomicity), rules in config store (etcd), sidecar or gateway deployment.
**Typeahead** – Trie built offline (Spark over query logs), sharded by prefix, Redis cache of top-k per prefix, ZooKeeper for shard map.
**Web crawler** – URL frontier (Kafka), politeness/robots, Bloom-filter dedupe, fetchers, parser, HDFS/S3 raw store, HBase/Bigtable index.
**Dropbox** – Chunking + content hash dedupe, metadata DB, block storage on S3, sync via WebSocket/long-poll notifications, conflict resolution.
**WebSocket at scale (Go on AWS)** – EKS, NLB, consistent hashing of connections, Redis pub/sub + Kafka for cross-node fan-out, JWT, Prometheus/Grafana.
**WebRTC at scale (Go on AWS)** – Signalling over WebSocket, STUN/TURN (coturn), SFU (Pion), EKS, recording via FFmpeg to S3.

## 7. Notes from "Technical Interview Questions"

Useful as a sidebar/FAQ section rather than a system: Go concurrency (goroutines vs threads, channels,
error handling), AWS cost optimisation and multi-cloud, CI/CD and DevOps, when microservices are *not*
the right choice, plus managerial/culture-fit questions.
