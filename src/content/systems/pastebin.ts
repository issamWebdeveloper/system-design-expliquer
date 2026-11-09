import type { SystemDesignInput } from "@/types/schema";

export const pastebin: SystemDesignInput = {
  slug: "pastebin",
  name: "Pastebin",
  tagline: "Share text snippets by short link",
  description:
    "A close cousin of the URL shortener, with bigger values. Paste text goes to object storage, a small metadata record holds the key, owner and expiry, and reads are served from a CDN and cache because popular pastes are read far more than they are written. Expired pastes are removed by a background job.",
  category: "infrastructure",
  difficulty: 1,
  concepts: ["id-generation", "caching", "sharding", "rate-limiting"],

  requirements: {
    functional: [
      "Create a paste (up to a few MB) and get a short URL",
      "Read a paste by URL, including a raw-text view",
      "Optional expiry, password protection and unlisted visibility",
      "Delete your own pastes",
    ],
    nonFunctional: [
      "Reads are fast and highly available",
      "Pastes are durable until they expire",
      "Keys are hard to guess",
    ],
  },

  apis: [
    { method: "POST", path: "/pastes", purpose: "{ content, expiresIn?, visibility? } → { key, url }" },
    { method: "GET", path: "/{key}", purpose: "Rendered paste" },
    { method: "GET", path: "/raw/{key}", purpose: "Raw text (CDN-cacheable)" },
    { method: "DELETE", path: "/pastes/{key}", purpose: "Delete (owner only)" },
  ],

  estimates: [
    { label: "New pastes", value: "≈ 1 M/day (~12/s)", derivation: "Assumption" },
    { label: "Reads", value: "≈ 10 M/day (~115/s)", derivation: "10:1 read-to-write ratio" },
    { label: "New content", value: "≈ 10 GB/day", derivation: "1 M × ~10 KB average; ~3.6 TB per year" },
    { label: "Metadata", value: "≈ 0.5 GB/day", derivation: "1 M × ~500 bytes" },
  ],

  dataModel: [
    {
      entity: "Paste metadata",
      store: "Key-value DB",
      key: "key",
      fields: ["contentUrl", "ownerId", "sizeBytes", "visibility", "createdAt", "expiresAt"],
      why: "Small records looked up only by key",
    },
    {
      entity: "Paste content",
      store: "Object storage",
      key: "key",
      fields: ["text (compressed)"],
      why: "Large values don't belong in the database",
    },
  ],

  nodes: [
    { id: "browser", kind: "web-client", label: "Browser / CLI", role: "Creates and reads pastes" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Caches raw paste text at the edge" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Spreads traffic" },
    { id: "app", kind: "service", label: "Paste service", role: "Creates, reads and deletes pastes" },
    { id: "kgs", kind: "service", label: "Key generator", role: "Hands out unique random keys" },
    { id: "cache", kind: "cache", label: "Cache", role: "Hot paste metadata and small contents" },
    { id: "meta-db", kind: "nosql-db", label: "Paste metadata", role: "key → content location and expiry" },
    { id: "blob", kind: "object-storage", label: "Paste content", role: "The text itself" },
    { id: "cleanup", kind: "serverless", label: "Expiry cleanup", role: "Deletes expired pastes" },
  ],

  edges: [
    { id: "browser-lb", from: "browser", to: "lb", label: "Create / read" },
    { id: "browser-cdn", from: "browser", to: "cdn", label: "Raw view" },
    { id: "cdn-lb", from: "cdn", to: "lb", label: "Miss" },
    { id: "lb-app", from: "lb", to: "app" },
    { id: "app-kgs", from: "app", to: "kgs", label: "Next key", protocol: "grpc" },
    { id: "app-blob", from: "app", to: "blob" },
    { id: "app-meta", from: "app", to: "meta-db" },
    { id: "app-cache", from: "app", to: "cache" },
    { id: "cleanup-meta", from: "cleanup", to: "meta-db", label: "Find expired" },
    { id: "cleanup-blob", from: "cleanup", to: "blob", label: "Delete" },
  ],

  flows: [
    {
      id: "create",
      name: "Create a paste",
      steps: [
        { edge: "browser-lb", text: "The user submits text (rate-limited per IP)." },
        { edge: "lb-app", text: "The paste service validates the size." },
        { edge: "app-kgs", text: "It gets a unique random key." },
        { edge: "app-blob", text: "The content is compressed and stored." },
        { edge: "app-meta", text: "Metadata with the content location and expiry is saved, and the URL returned." },
      ],
    },
    {
      id: "read",
      name: "Read a paste",
      steps: [
        { edge: "browser-cdn", text: "Raw views of popular pastes come from the CDN." },
        { edge: "cdn-lb", text: "On a miss the request reaches the service." },
        { edge: "lb-app", text: "The paste service looks it up." },
        { edge: "app-cache", text: "Hot pastes are in cache…" },
        { edge: "app-meta", text: "…otherwise metadata is read and expiry checked." },
        { edge: "app-blob", text: "Content is fetched from storage and cached." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Large pastes in the database",
      fix: "Keep content in object storage and only a pointer in the database.",
      nodes: ["blob", "meta-db"],
    },
    {
      problem: "Viral pastes",
      fix: "Serve raw content from the CDN and cache with sensible TTLs.",
      nodes: ["cdn", "cache"],
    },
    {
      problem: "Abuse (spam, leaked secrets, malware)",
      fix: "Rate limits, size caps, and scanning before making pastes public.",
      nodes: ["app"],
    },
  ],

  scaling: [
    "Shard metadata by key hash.",
    "Use storage lifecycle rules as a safety net for expiry.",
    "Stateless services scale behind the load balancer.",
  ],

  extensions: [
    "Syntax highlighting and language detection.",
    "Paste history and versions.",
    "Private pastes encrypted client-side.",
  ],
};
