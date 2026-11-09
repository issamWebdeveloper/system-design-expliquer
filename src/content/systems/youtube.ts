import type { SystemDesignInput } from "@/types/schema";

export const youtube: SystemDesignInput = {
  slug: "youtube",
  name: "YouTube",
  tagline: "Global video upload, transcode, and streaming",
  description:
    "Creators upload large video files that are transcoded into many resolutions and served worldwide through a CDN with adaptive bitrate streaming. Metadata, engagement and search run on separately scaled services, and almost every byte watched comes from an edge cache rather than the origin.",
  category: "media-social",
  difficulty: 3,
  concepts: ["adaptive-bitrate-streaming", "presigned-urls", "back-pressure", "caching", "sharding", "search-indexing", "change-data-capture"],

  requirements: {
    functional: [
      "Upload videos with a title, description and tags; uploads must survive flaky connections",
      "Stream videos smoothly on any device and network speed",
      "Like/dislike, comment on, and share videos",
      "Search videos by title, tags and description",
      "Subscribe to channels and get notified about new uploads",
      "Show thumbnails and a personalised home feed (can come after the MVP)",
    ],
    nonFunctional: [
      "High availability: watching must keep working even when uploads or comments are degraded",
      "Low start-up latency and minimal buffering worldwide",
      "Durable storage: an uploaded video is never lost",
      "Eventual consistency is fine for view counts, likes and new uploads appearing",
      "Read-heavy: views outnumber uploads by orders of magnitude",
    ],
  },

  apis: [
    { method: "POST", path: "/videos", purpose: "Start a resumable upload; returns a videoId and upload URLs for each chunk" },
    { method: "GET", path: "/videos/{videoId}", purpose: "Video metadata plus the HLS/DASH manifest URL on the CDN" },
    { method: "POST", path: "/videos/{videoId}/like", purpose: "Record a like or dislike for the current user (idempotent)" },
    { method: "GET", path: "/videos/{videoId}/comments?cursor=", purpose: "Page through comments, newest first" },
    { method: "POST", path: "/videos/{videoId}/comments", purpose: "Add a comment" },
    { method: "GET", path: "/search?q=&cursor=", purpose: "Ranked search results" },
    { method: "POST", path: "/channels/{channelId}/subscribe", purpose: "Follow a creator" },
    { method: "GET", path: "/feed", purpose: "Personalised recommendations for the signed-in user" },
  ],

  estimates: [
    { label: "Daily active users", value: "≈ 500 M", derivation: "Assumption based on public figures" },
    {
      label: "Video uploaded per day",
      value: "≈ 43 M minutes",
      derivation: "500 hours/min × 60 min × 60 × 24 ≈ 43 M min/day",
    },
    {
      label: "New storage per day",
      value: "≈ 250 TB (one rendition)",
      derivation: "43 M min × ~6 MB/min; multiply by the number of renditions kept",
    },
    {
      label: "API requests",
      value: "≈ 30 k/s avg, ~90 k/s peak",
      derivation: "500 M users × 5 requests ÷ 86,400 s; peak ≈ 3× average",
    },
    {
      label: "Video egress",
      value: "≈ 30 PB/day (~2.8 Tbps)",
      derivation: "500 M users × 10 min × 6 MB/min; ÷ 86,400 s for average bandwidth",
    },
  ],

  dataModel: [
    {
      entity: "Video",
      store: "Wide-column DB (e.g. Bigtable)",
      key: "videoId",
      fields: ["ownerId", "title", "description", "tags", "status", "renditions[]", "thumbnailUrl", "durationSec", "uploadedAt"],
      why: "Read on every view; needs fast key lookups at huge scale",
    },
    {
      entity: "Comment",
      store: "Wide-column DB",
      key: "videoId + commentId (time-ordered)",
      fields: ["userId", "text", "createdAt", "parentId"],
      why: "Append-heavy, read in time order per video",
    },
    {
      entity: "Like",
      store: "Key-value DB + cached counters",
      key: "videoId + userId",
      fields: ["value (+1/-1)", "createdAt"],
      why: "One vote per user; totals are kept as counters, not counted on read",
    },
    {
      entity: "Subscription",
      store: "Key-value DB",
      key: "subscriberId + channelId",
      fields: ["createdAt", "notify"],
      why: "Looked up both ways: 'my subscriptions' and fan-out to subscribers",
    },
    {
      entity: "Video file",
      store: "Object storage",
      key: "videoId/rendition/segment",
      fields: ["raw upload", "encoded segments", "manifest", "thumbnails"],
      why: "Cheap, durable blobs; the database stores only their URLs",
    },
  ],

  nodes: [
    { id: "web-client", kind: "web-client", label: "Web / TV app", role: "Browse, search and play videos with an adaptive player" },
    { id: "mobile-client", kind: "mobile-client", label: "Mobile app", role: "Watch, upload from the camera roll, receive notifications" },
    { id: "cdn", kind: "cdn", label: "Video CDN", role: "Serves manifests and video segments from edge caches near viewers" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Spreads API and upload traffic across healthy instances" },
    { id: "api", kind: "api-gateway", label: "API gateway", role: "Authenticates users, rate-limits and routes to services" },
    { id: "upload-svc", kind: "service", label: "Upload service", role: "Accepts resumable chunked uploads and queues transcode jobs" },
    { id: "video-svc", kind: "service", label: "Video service", role: "Video metadata, playback manifests, view counts" },
    { id: "engagement-svc", kind: "service", label: "Engagement service", role: "Likes, comments and subscriptions" },
    { id: "search-svc", kind: "service", label: "Search service", role: "Queries the search index and ranks results" },
    { id: "transcode-queue", kind: "event-stream", label: "Transcode jobs", role: "Buffers new uploads so spikes only lengthen the queue" },
    { id: "transcoder", kind: "media-transcoder", label: "Transcoding workers", role: "Encode 240p–4K renditions and HLS/DASH segments in parallel" },
    { id: "video-store", kind: "object-storage", label: "Video storage", role: "Raw uploads, encoded segments and thumbnails" },
    { id: "metadata-db", kind: "wide-column-db", label: "Metadata DB", role: "Videos, comments and likes, partitioned by videoId" },
    { id: "cache", kind: "cache", label: "Hot metadata cache", role: "Popular video metadata and view/like counters" },
    { id: "search-index", kind: "search", label: "Search index", role: "Full-text index over titles, descriptions and tags" },
    { id: "recommend", kind: "ml-platform", label: "Recommendations", role: "Ranks the home feed and related videos from watch history" },
  ],

  edges: [
    { id: "web-cdn", from: "web-client", to: "cdn", label: "Segments" },
    { id: "mobile-cdn", from: "mobile-client", to: "cdn" },
    { id: "web-lb", from: "web-client", to: "lb", label: "API / upload" },
    { id: "mobile-lb", from: "mobile-client", to: "lb" },
    { id: "lb-api", from: "lb", to: "api" },
    { id: "api-upload", from: "api", to: "upload-svc", protocol: "grpc" },
    { id: "api-video", from: "api", to: "video-svc", protocol: "grpc" },
    { id: "api-engagement", from: "api", to: "engagement-svc", protocol: "grpc" },
    { id: "api-search", from: "api", to: "search-svc", protocol: "grpc" },
    { id: "upload-store", from: "upload-svc", to: "video-store", label: "Raw chunks" },
    { id: "upload-queue", from: "upload-svc", to: "transcode-queue", label: "Job", protocol: "async" },
    { id: "queue-transcoder", from: "transcode-queue", to: "transcoder", protocol: "async" },
    { id: "transcoder-store", from: "transcoder", to: "video-store", label: "Renditions" },
    { id: "transcoder-meta", from: "transcoder", to: "metadata-db", label: "Mark ready" },
    { id: "video-cache", from: "video-svc", to: "cache" },
    { id: "video-meta", from: "video-svc", to: "metadata-db" },
    { id: "video-recommend", from: "video-svc", to: "recommend", label: "Related" },
    { id: "engagement-cache", from: "engagement-svc", to: "cache", label: "Counters" },
    { id: "engagement-meta", from: "engagement-svc", to: "metadata-db" },
    { id: "search-index-read", from: "search-svc", to: "search-index" },
    { id: "meta-index", from: "metadata-db", to: "search-index", label: "Index updates", protocol: "cdc" },
    { id: "cdn-origin", from: "cdn", to: "video-store", label: "Origin fetch" },
    { id: "recommend-meta", from: "recommend", to: "metadata-db", label: "Watch history" },
  ],

  flows: [
    {
      id: "upload",
      name: "Upload a video",
      steps: [
        { edge: "web-lb", text: "The app asks to start an upload and gets a videoId." },
        { edge: "lb-api", text: "The gateway checks the user's token and upload quota." },
        { edge: "api-upload", text: "The upload service tracks each chunk so a dropped connection can resume." },
        { edge: "upload-store", text: "Raw chunks are written straight to object storage." },
        { edge: "upload-queue", text: "Once every chunk is in, a transcode job is published." },
        { edge: "queue-transcoder", text: "A free worker picks up the job; more workers start if the queue grows." },
        { edge: "transcoder-store", text: "Each resolution is encoded into HLS/DASH segments and stored." },
        { edge: "transcoder-meta", text: "The video is marked ready with its rendition URLs." },
        { edge: "meta-index", text: "The new video flows into the search index." },
      ],
    },
    {
      id: "watch",
      name: "Watch a video",
      steps: [
        { edge: "web-lb", text: "The player requests the video page." },
        { edge: "lb-api", text: "The request is routed to the video service." },
        { edge: "api-video", text: "The video service builds the response." },
        { edge: "video-cache", text: "Popular videos' metadata is served from cache…" },
        { edge: "video-meta", text: "…otherwise it is read from the metadata DB and cached." },
        { edge: "web-cdn", text: "The player fetches the manifest and segments from the nearest edge, switching bitrate as bandwidth changes." },
        { edge: "cdn-origin", text: "On a cache miss the edge pulls segments from storage once, then serves everyone nearby." },
      ],
    },
    {
      id: "search",
      name: "Search",
      steps: [
        { edge: "web-lb", text: "The user submits a query." },
        { edge: "lb-api", text: "The gateway routes it to search." },
        { edge: "api-search", text: "The search service parses the query and applies filters." },
        { edge: "search-index-read", text: "The index returns ranked matches by title, tags and description." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Transcoding is CPU-heavy and uploads arrive in bursts",
      fix: "Queue jobs and autoscale a pool of stateless workers (GPU instances for 4K); split long videos into chunks encoded in parallel.",
      nodes: ["transcode-queue", "transcoder"],
    },
    {
      problem: "Viral videos create hot keys on metadata and counters",
      fix: "Serve hot metadata from cache, count views and likes in cache and flush them to the DB in batches.",
      nodes: ["cache", "metadata-db"],
    },
    {
      problem: "Egress bandwidth at Tbps scale",
      fix: "Push nearly all bytes through the CDN; pre-warm edges for expected hits and fall back to the next edge or origin.",
      nodes: ["cdn", "video-store"],
    },
    {
      problem: "One slow service cascading into others",
      fix: "Keep services stateless and autoscaled, add timeouts, circuit breakers and rate limits at the gateway.",
      nodes: ["api", "video-svc", "engagement-svc"],
    },
  ],

  scaling: [
    "Shard metadata by videoId and comments by videoId so load spreads across many nodes.",
    "Use read replicas and a separate search cluster for read-heavy queries.",
    "Route users to the nearest region with geo-DNS; each region has its own load balancers and service pools.",
    "Keep services stateless so instances can be added freely; state lives in the databases and cache.",
    "Replicate video files and metadata across regions for disaster recovery.",
    "Decouple everything slow (transcoding, notifications, indexing) with queues so spikes only add delay.",
  ],

  extensions: [
    "Recommendations: batch and streaming pipelines over watch history feed a model that ranks the home feed.",
    "Subscription notifications: publish an event per upload and fan out to subscribers through a queue.",
    "Better search: autocomplete, filters, and indexing auto-generated transcripts.",
    "Threaded comments with spam filtering and live updates over WebSockets.",
    "Live streaming: ingest over RTMP/SRT, transcode in real time and push to edges with low-latency HLS; add live chat.",
  ],
};
