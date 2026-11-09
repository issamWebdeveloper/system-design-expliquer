import type { SystemDesignInput } from "@/types/schema";

export const urlShortener: SystemDesignInput = {
  slug: "url-shortener",
  name: "URL shortener",
  tagline: "Short links with billions of redirects",
  description:
    "A key generation service hands out unique 7-character Base62 keys from pre-allocated ranges, so creating a link never needs a uniqueness check. Redirects are a single key lookup served mostly from cache (and even from the CDN edge), and click events flow asynchronously to analytics so the redirect path stays tiny.",
  category: "infrastructure",
  difficulty: 1,
  concepts: ["id-generation", "caching", "sharding", "leader-election", "rate-limiting"],

  requirements: {
    functional: [
      "Given a long URL, return a short unique link",
      "Visiting the short link redirects to the original URL",
      "Optional custom alias and expiry time",
      "Per-link click statistics",
    ],
    nonFunctional: [
      "Redirects in a few milliseconds, very high availability",
      "Read-heavy: about 100 redirects per link created",
      "Keys must be unique and hard to guess in sequence",
      "Links are never lost before they expire",
    ],
  },

  apis: [
    { method: "POST", path: "/shorten", purpose: "{ url, alias?, expiresIn? } → { shortUrl }" },
    { method: "GET", path: "/{key}", purpose: "301/302 redirect to the original URL (404 if unknown or expired)" },
    { method: "GET", path: "/{key}/stats", purpose: "Click counts by day, country and referrer" },
    { method: "DELETE", path: "/{key}", purpose: "Remove a link (owner only)" },
  ],

  estimates: [
    { label: "New links", value: "≈ 200/s", derivation: "500 M per month ÷ (30 × 86,400 s)" },
    { label: "Redirects", value: "≈ 20 k/s", derivation: "100:1 read-to-write ratio" },
    { label: "Storage over 5 years", value: "≈ 15 TB", derivation: "500 M × 12 × 5 = 30 B links × ~500 bytes" },
    { label: "Cache size", value: "≈ 170 GB", derivation: "20% of a day's 1.7 B redirects × 500 bytes (80/20 rule)" },
    { label: "Key space", value: "62⁷ ≈ 3.5 trillion", derivation: "7 Base62 characters — over 100× the 5-year need" },
  ],

  dataModel: [
    {
      entity: "Link",
      store: "Key-value DB",
      key: "shortKey",
      fields: ["longUrl", "ownerId", "createdAt", "expiresAt"],
      why: "The only hot query is 'key → URL'; key-value stores scale this horizontally",
    },
    {
      entity: "Key range",
      store: "Coordination store",
      key: "rangeId",
      fields: ["start", "end", "assignedTo"],
      why: "Each generator instance claims a block of counter values, so no two hand out the same key",
    },
    {
      entity: "Click",
      store: "Data warehouse",
      key: "shortKey + time",
      fields: ["country", "referrer", "device"],
      why: "Append-only analytics, aggregated offline",
    },
  ],

  nodes: [
    { id: "creator", kind: "web-client", label: "Creator (app / API)", role: "Creates short links" },
    { id: "visitor", kind: "web-client", label: "Visitor's browser", role: "Clicks a short link" },
    { id: "edge", kind: "cdn", label: "Edge cache", role: "Caches popular redirects close to visitors" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Spreads traffic across app servers" },
    { id: "app", kind: "service", label: "Shortener service", role: "Creates links and serves redirects (stateless)" },
    { id: "kgs", kind: "service", label: "Key generation service", role: "Hands out unused keys from a claimed range" },
    { id: "ranges", kind: "coordination", label: "Range allocator", role: "Gives each generator a unique block of counter values" },
    { id: "cache", kind: "cache", label: "Hot links cache", role: "key → URL for popular links" },
    { id: "db", kind: "nosql-db", label: "Link store", role: "All short-key mappings" },
    { id: "clicks", kind: "event-stream", label: "Click events", role: "One event per redirect" },
    { id: "analytics", kind: "data-warehouse", label: "Click analytics", role: "Aggregated stats per link" },
    { id: "cleanup", kind: "serverless", label: "Expiry cleanup", role: "Deletes expired links in the background" },
  ],

  edges: [
    { id: "creator-lb", from: "creator", to: "lb", label: "POST /shorten" },
    { id: "visitor-edge", from: "visitor", to: "edge", label: "GET /{key}" },
    { id: "edge-lb", from: "edge", to: "lb", label: "Miss" },
    { id: "lb-app", from: "lb", to: "app" },
    { id: "app-kgs", from: "app", to: "kgs", label: "Next key", protocol: "grpc" },
    { id: "kgs-ranges", from: "kgs", to: "ranges", label: "Claim range" },
    { id: "app-cache", from: "app", to: "cache" },
    { id: "app-db", from: "app", to: "db" },
    { id: "app-clicks", from: "app", to: "clicks", protocol: "stream" },
    { id: "clicks-analytics", from: "clicks", to: "analytics", protocol: "stream" },
    { id: "cleanup-db", from: "cleanup", to: "db", label: "Delete expired" },
  ],

  flows: [
    {
      id: "shorten",
      name: "Create a short link",
      steps: [
        { edge: "creator-lb", text: "The creator submits a long URL." },
        { edge: "lb-app", text: "Any app server can handle it — they're stateless." },
        { edge: "app-kgs", text: "The app asks the key generator for the next key. It encodes a counter value in Base62 (e.g. 'aZ3x9Qk')." },
        { edge: "kgs-ranges", text: "Only when its block runs out does the generator claim a new range, so this call is rare." },
        { edge: "app-db", text: "The mapping is written. Because keys are unique by construction there's no collision check." },
        { edge: "app-cache", text: "It's also written to cache, since new links are often clicked right away." },
      ],
    },
    {
      id: "redirect",
      name: "Follow a short link",
      steps: [
        { edge: "visitor-edge", text: "The browser requests the short link; popular ones are answered at the edge." },
        { edge: "edge-lb", text: "On a miss the request reaches the load balancer." },
        { edge: "lb-app", text: "An app server handles it." },
        { edge: "app-cache", text: "Most lookups hit the cache…" },
        { edge: "app-db", text: "…otherwise one key-value read finds the URL. Expired or unknown keys return 404." },
        { edge: "app-clicks", text: "A click event is fired asynchronously and the redirect is returned immediately." },
        { edge: "clicks-analytics", text: "Analytics aggregates clicks per link in the background." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Generating unique keys without a central bottleneck or collisions",
      fix: "Pre-allocate counter ranges to each generator; encode the counter in Base62 (shuffle bits so keys aren't sequential).",
      nodes: ["kgs", "ranges"],
    },
    {
      problem: "20 k+ redirects per second on the database",
      fix: "Cache-aside with LRU eviction for the ~20% of links that get most clicks; cache at the edge too.",
      nodes: ["cache", "edge", "db"],
    },
    {
      problem: "301 vs 302 trade-off",
      fix: "301 lets browsers cache the redirect (less load, but clicks go uncounted); 302 keeps every click visible for analytics.",
      nodes: ["app", "edge"],
    },
    {
      problem: "Abuse: spam and malicious links",
      fix: "Rate-limit creation per user/IP and check URLs against a malware blocklist before saving.",
      nodes: ["app"],
    },
  ],

  scaling: [
    "Shard the link store by hash of the key; reads are spread evenly.",
    "Replicate the store and cache across regions; redirects are served from the nearest one.",
    "App servers are stateless and scale behind the load balancer.",
    "Write click events to a stream so analytics never slows down redirects.",
  ],

  extensions: [
    "Custom domains for branded links.",
    "QR codes for each link.",
    "Link previews and safety warnings.",
    "Per-user dashboards with click charts.",
  ],
};
