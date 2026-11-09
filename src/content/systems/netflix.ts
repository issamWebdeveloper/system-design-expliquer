import type { SystemDesignInput } from "@/types/schema";

// Netflix runs its own CDN regardless of the cloud behind it.
const openConnect = { aws: "Open Connect", gcp: "Open Connect", azure: "Open Connect", oss: "Open Connect" };

export const netflix: SystemDesignInput = {
  slug: "netflix",
  name: "Netflix",
  tagline: "Global video streaming with microservices",
  description:
    "Netflix splits into two worlds: a control plane of stateless microservices in the cloud that handles sign-in, browsing, recommendations and playback decisions, and a purpose-built CDN (Open Connect) that sits inside ISPs and serves the actual video bytes. Studio content is encoded once into hundreds of streams and pushed to edge caches before anyone presses play.",
  category: "media-social",
  difficulty: 3,
  concepts: ["adaptive-bitrate-streaming", "caching", "multi-region", "microservices", "event-driven", "sharding"],

  requirements: {
    functional: [
      "Sign up, manage a subscription, and keep several profiles per account",
      "Browse and search the catalogue by title, genre and people",
      "Play, pause, seek and resume on any device, picking up where another device left off",
      "Adaptive quality (SD to 4K/HDR), multiple audio tracks and subtitles",
      "Personalised rows on the home page per profile",
      "Download titles for offline viewing where licensing allows",
    ],
    nonFunctional: [
      "Fast playback start and almost no rebuffering — quality of experience is the main metric",
      "Tens of millions of concurrent streams at peak",
      "Always on: a regional cloud outage must not stop playback",
      "Content is protected with DRM and only shown in licensed regions",
      "Browsing data can be eventually consistent; billing and entitlements cannot",
    ],
  },

  apis: [
    { method: "POST", path: "/auth/login", purpose: "Sign in and get a session token" },
    { method: "GET", path: "/profiles/{profileId}/home", purpose: "Personalised rows of titles for the home screen" },
    { method: "GET", path: "/titles/{titleId}", purpose: "Title details, episodes, available audio and subtitle tracks" },
    { method: "GET", path: "/search?q=", purpose: "Search titles, genres and people" },
    { method: "POST", path: "/playback/{titleId}/start", purpose: "Check entitlement, pick edge servers, return manifest URLs and a DRM licence" },
    { method: "PUT", path: "/profiles/{profileId}/progress", purpose: "Save the resume position (sent every few seconds while playing)" },
    { method: "GET", path: "/profiles/{profileId}/watchlist", purpose: "My List" },
  ],

  estimates: [
    { label: "Subscribers", value: "≈ 300 M", derivation: "Public figure; assume 100–150 M daily active" },
    { label: "Peak concurrent streams", value: "≈ 50–65 M", derivation: "Observed during large live events" },
    {
      label: "Average video egress",
      value: "≈ 15 Tbps",
      derivation: "125 M viewing hours/day × 3,600 s × 3 Mbps ÷ 86,400 s; peaks are several times higher",
    },
    {
      label: "Encoded streams per title",
      value: "≈ 1,000+",
      derivation: "Codecs × resolutions × bitrates × audio/subtitle variants",
    },
    { label: "Video storage", value: "10–100+ PB", derivation: "Masters plus every encoded rendition, replicated" },
  ],

  dataModel: [
    {
      entity: "Account",
      store: "Relational DB (e.g. MySQL)",
      key: "accountId",
      fields: ["email", "passwordHash", "plan", "billingStatus", "country"],
      why: "Billing and entitlements need transactions and strong consistency",
    },
    {
      entity: "Profile",
      store: "Relational DB",
      key: "profileId",
      fields: ["accountId", "name", "maturityRating", "language"],
      why: "Small, relational, read on every request",
    },
    {
      entity: "Title / Episode",
      store: "Relational DB + cache",
      key: "titleId",
      fields: ["name", "synopsis", "genres", "cast", "regionsLicensed", "artwork"],
      why: "Read constantly, changes rarely — ideal for heavy caching",
    },
    {
      entity: "Viewing history",
      store: "Wide-column DB (e.g. Cassandra)",
      key: "profileId + timestamp",
      fields: ["titleId", "positionSec", "device", "durationWatched"],
      why: "Huge write volume from progress updates, read per profile",
    },
    {
      entity: "Encoded asset",
      store: "Object storage",
      key: "titleId/codec/resolution/bitrate",
      fields: ["segments", "manifest", "subtitle files"],
      why: "Large immutable files, copied to edge caches",
    },
  ],

  nodes: [
    { id: "tv-client", kind: "web-client", label: "TV / web app", role: "Browse, search and play with an adaptive player" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Streaming and offline downloads" },
    { id: "studio", kind: "web-client", label: "Content partners", role: "Studios deliver high-quality master files" },
    { id: "open-connect", kind: "cdn", label: "Open Connect CDN", role: "Netflix-owned caches inside ISPs that serve nearly all video bytes", overrides: openConnect },
    { id: "gateway", kind: "api-gateway", label: "API gateway (Zuul)", role: "Edge routing, authentication and rate limiting" },
    { id: "auth", kind: "identity", label: "Auth service", role: "Sign-in, sessions and device tokens" },
    { id: "playback-svc", kind: "service", label: "Playback service", role: "Checks entitlement, picks the best edge servers and issues DRM licences" },
    { id: "catalog-svc", kind: "service", label: "Catalogue service", role: "Titles, artwork and regional availability" },
    { id: "profile-svc", kind: "service", label: "Profile & history service", role: "Profiles, My List and resume positions" },
    { id: "recommend", kind: "ml-platform", label: "Recommendations", role: "Builds personalised rows for each profile" },
    { id: "events", kind: "event-stream", label: "Event pipeline (Keystone)", role: "Carries play, pause and browse events to analytics" },
    { id: "encoder", kind: "media-transcoder", label: "Encoding pipeline", role: "Splits masters into chunks and encodes them in parallel" },
    { id: "account-db", kind: "relational-db", label: "Accounts DB", role: "Accounts, plans and billing" },
    { id: "catalog-db", kind: "relational-db", label: "Catalogue DB", role: "Title and episode metadata" },
    { id: "history-db", kind: "wide-column-db", label: "Viewing history (Cassandra)", role: "Every profile's watch progress" },
    { id: "cache", kind: "cache", label: "EVCache", role: "Distributed cache for metadata, rows and sessions" },
    { id: "media-store", kind: "object-storage", label: "Media storage", role: "Masters and every encoded rendition" },
    { id: "analytics", kind: "batch-processing", label: "Batch analytics", role: "Aggregates viewing data to train models" },
  ],

  edges: [
    { id: "tv-gateway", from: "tv-client", to: "gateway", label: "API" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "tv-cdn", from: "tv-client", to: "open-connect", label: "Video segments" },
    { id: "mobile-cdn", from: "mobile", to: "open-connect" },
    { id: "gateway-auth", from: "gateway", to: "auth", protocol: "grpc" },
    { id: "gateway-playback", from: "gateway", to: "playback-svc", protocol: "grpc" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "gateway-profile", from: "gateway", to: "profile-svc", protocol: "grpc" },
    { id: "gateway-recommend", from: "gateway", to: "recommend", label: "Home rows", protocol: "grpc" },
    { id: "auth-accounts", from: "auth", to: "account-db" },
    { id: "playback-accounts", from: "playback-svc", to: "account-db", label: "Entitlement" },
    { id: "playback-cdn", from: "playback-svc", to: "open-connect", label: "Pick edges" },
    { id: "catalog-cache", from: "catalog-svc", to: "cache" },
    { id: "catalog-db-read", from: "catalog-svc", to: "catalog-db" },
    { id: "profile-history", from: "profile-svc", to: "history-db", label: "Resume position" },
    { id: "profile-events", from: "profile-svc", to: "events", label: "Play events", protocol: "stream" },
    { id: "events-analytics", from: "events", to: "analytics", protocol: "stream" },
    { id: "analytics-recommend", from: "analytics", to: "recommend", label: "Train models" },
    { id: "recommend-cache", from: "recommend", to: "cache", label: "Precomputed rows" },
    { id: "studio-store", from: "studio", to: "media-store", label: "Masters" },
    { id: "store-encoder", from: "media-store", to: "encoder", label: "Chunks", protocol: "async" },
    { id: "encoder-store", from: "encoder", to: "media-store", label: "Encoded streams" },
    { id: "cdn-fill", from: "open-connect", to: "media-store", label: "Off-peak fill" },
  ],

  flows: [
    {
      id: "play",
      name: "Press play",
      steps: [
        { edge: "tv-gateway", text: "The player asks to start playback for a title." },
        { edge: "gateway-playback", text: "The gateway routes the request to the playback service." },
        { edge: "playback-accounts", text: "It checks the plan, region licence and number of active streams." },
        { edge: "playback-cdn", text: "It picks the healthiest nearby Open Connect servers that already hold the title and returns manifest URLs plus a DRM licence." },
        { edge: "tv-cdn", text: "The player streams segments from the ISP-embedded cache, adjusting bitrate as bandwidth changes." },
        { edge: "gateway-profile", text: "Every few seconds the player reports its position." },
        { edge: "profile-history", text: "The resume position is saved so another device can continue." },
        { edge: "profile-events", text: "Play events go to the event pipeline for analytics." },
      ],
    },
    {
      id: "home",
      name: "Load the home page",
      steps: [
        { edge: "tv-gateway", text: "The app requests the home screen for the active profile." },
        { edge: "gateway-recommend", text: "The recommendation service assembles personalised rows." },
        { edge: "recommend-cache", text: "Rows were precomputed offline and are read from cache." },
        { edge: "gateway-catalog", text: "Artwork and title details are fetched for each row." },
        { edge: "catalog-cache", text: "Almost all catalogue reads are cache hits." },
      ],
    },
    {
      id: "ingest",
      name: "Add a new title",
      steps: [
        { edge: "studio-store", text: "A studio delivers the master file, which is checked for quality." },
        { edge: "store-encoder", text: "The master is split into chunks and queued for encoding." },
        { edge: "encoder-store", text: "Workers encode every chunk into each codec, resolution and bitrate in parallel." },
        { edge: "cdn-fill", text: "During off-peak hours edge caches pull the new title, so it's already local on launch day." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Encoding a 4K/HDR title into ~1,000 streams takes enormous compute",
      fix: "Split masters into chunks and encode them in parallel on an autoscaled worker fleet; retry failed chunks only.",
      nodes: ["encoder", "media-store"],
    },
    {
      problem: "Terabits per second of video can saturate internet backbones",
      fix: "Place caches inside ISP networks and fill them off-peak, so peak-hour traffic never leaves the ISP.",
      nodes: ["open-connect"],
    },
    {
      problem: "A big release launches to millions at the same minute",
      fix: "Pre-position the title on edges before launch and serve metadata from cache so the control plane sees little extra load.",
      nodes: ["open-connect", "cache", "catalog-svc"],
    },
    {
      problem: "Constant progress updates flood the history store",
      fix: "Use a write-optimised wide-column store partitioned by profile, and batch or sample events going to analytics.",
      nodes: ["history-db", "events"],
    },
    {
      problem: "One failing microservice dragging down the rest",
      fix: "Timeouts, circuit breakers and fallbacks (e.g. show generic rows if recommendations fail); test with chaos engineering.",
      nodes: ["gateway", "recommend"],
    },
  ],

  scaling: [
    "Run the control plane active-active in several cloud regions; shift traffic away from a failing region.",
    "Keep every service stateless behind the gateway so it can autoscale.",
    "Shard viewing history by profile and replicate it across data centres with tunable consistency.",
    "Replicate accounts in the relational DB across zones with automatic failover.",
    "Cache everything that is read-heavy (catalogue, rows, sessions) and replicate the cache across zones.",
    "Grow the CDN by adding appliances at ISPs and exchange points rather than scaling the origin.",
  ],

  extensions: [
    "DRM with Widevine, FairPlay and PlayReady, plus licence checks per region.",
    "Offline downloads with licences that expire.",
    "Personalised artwork chosen by A/B tests per profile.",
    "Live events, which can't be pre-positioned and need low-latency streaming.",
    "Per-title and per-scene encoding to cut bandwidth without losing quality.",
  ],
};
