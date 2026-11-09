import type { SystemDesignInput } from "@/types/schema";

export const dropbox: SystemDesignInput = {
  slug: "dropbox",
  name: "Dropbox",
  tagline: "File sync across every device",
  description:
    "The sync client splits files into 4 MB blocks and fingerprints each one. Only blocks the server hasn't seen are uploaded, straight to object storage, so edits to big files and duplicate files cost almost nothing. A metadata service records each file version as a list of block hashes and appends it to a change journal; other devices are told 'something changed' over a long-lived connection and pull just the new blocks.",
  category: "infrastructure",
  difficulty: 2,
  concepts: ["presigned-urls", "websockets", "sharding", "caching", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Upload, download, rename, move and delete files and folders",
      "Automatic sync across a user's devices",
      "Share files and folders with other users",
      "Version history and restore",
      "Work offline and reconcile on reconnect",
    ],
    nonFunctional: [
      "Never lose a file; files are stored with high durability",
      "Sync within seconds of a change",
      "Efficient: re-upload only changed parts of large files",
      "Strong consistency for metadata (no two 'latest' versions without a conflict copy)",
    ],
  },

  apis: [
    { method: "POST", path: "/files/commit", purpose: "{ path, blockHashes[], baseVersion } → missing block hashes, or new version" },
    { method: "PUT", path: "/blocks/{hash}", purpose: "Upload one block (via a pre-signed URL)" },
    { method: "GET", path: "/changes?cursor=", purpose: "Everything that changed since the device's cursor" },
    { method: "GET", path: "/blocks/{hash}", purpose: "Download one block" },
    { method: "WS", path: "/notify", purpose: "Long-lived connection that says 'new changes available'" },
    { method: "POST", path: "/shares", purpose: "Share a folder with another user" },
  ],

  estimates: [
    { label: "Users", value: "≈ 50 M, 10 M daily", derivation: "Assumption" },
    { label: "Stored data", value: "≈ 1 EB logical", derivation: "50 M × ~20 GB used on average; dedupe reduces physical storage" },
    { label: "File changes", value: "≈ 12 k/s", derivation: "10 M active users × 100 changes ÷ 86,400 s" },
    { label: "Transfer", value: "≈ 2 PB/day (~185 Gbps)", derivation: "10 M users × ~200 MB synced per day" },
  ],

  dataModel: [
    {
      entity: "File version",
      store: "Relational DB, sharded by namespace (user or shared folder)",
      key: "namespaceId + path + version",
      fields: ["blockHashes[]", "size", "modifiedAt", "deviceId"],
      why: "Transactional updates and conflict detection per folder",
    },
    {
      entity: "Change journal",
      store: "Relational DB (append-only per namespace)",
      key: "namespaceId + sequence",
      fields: ["path", "operation", "version"],
      why: "Devices resume sync from a cursor into this log",
    },
    {
      entity: "Block",
      store: "Object storage",
      key: "sha256 of content",
      fields: ["≤ 4 MB of bytes"],
      why: "Content-addressed: identical blocks are stored once",
    },
  ],

  nodes: [
    { id: "desktop", kind: "web-client", label: "Desktop sync client", role: "Watches folders, chunks and hashes files" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Browses and downloads on demand" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Spreads API traffic" },
    { id: "meta-svc", kind: "service", label: "Metadata service", role: "Commits file versions and serves change lists" },
    { id: "notify", kind: "realtime-gateway", label: "Notification service", role: "Tells connected devices that their folders changed" },
    { id: "meta-db", kind: "relational-db", label: "Metadata & journal", role: "File versions and per-folder change log" },
    { id: "meta-cache", kind: "cache", label: "Metadata cache", role: "Hot folder listings and block-exists checks" },
    { id: "blocks", kind: "object-storage", label: "Block storage", role: "Content-addressed 4 MB blocks" },
    { id: "events", kind: "event-stream", label: "Change events", role: "One event per committed change" },
  ],

  edges: [
    { id: "desktop-lb", from: "desktop", to: "lb", label: "Commit / list changes" },
    { id: "mobile-lb", from: "mobile", to: "lb" },
    { id: "lb-meta", from: "lb", to: "meta-svc" },
    { id: "meta-db-rw", from: "meta-svc", to: "meta-db" },
    { id: "meta-cache-rw", from: "meta-svc", to: "meta-cache", label: "Known blocks?" },
    { id: "desktop-blocks", from: "desktop", to: "blocks", label: "Upload missing blocks (pre-signed)" },
    { id: "mobile-blocks", from: "mobile", to: "blocks", label: "Download blocks" },
    { id: "meta-events", from: "meta-svc", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "desktop-notify", from: "desktop", to: "notify", label: "Subscribe", protocol: "ws" },
    { id: "mobile-notify", from: "mobile", to: "notify", protocol: "ws" },
  ],

  flows: [
    {
      id: "upload",
      name: "Save a file",
      steps: [
        { edge: "desktop-lb", text: "The client notices a change, splits the file into 4 MB blocks, hashes them, and asks to commit the new version." },
        { edge: "lb-meta", text: "The metadata service receives the list of block hashes." },
        { edge: "meta-cache-rw", text: "It checks which blocks already exist — usually most of them." },
        { edge: "desktop-blocks", text: "The client uploads only the missing blocks, directly to storage." },
        { edge: "meta-db-rw", text: "The client retries the commit; the new version and a journal entry are written in one transaction. If the base version is stale, a conflict copy is created." },
        { edge: "meta-events", text: "A change event is published." },
        { edge: "events-notify", text: "The notification service finds the user's other connected devices." },
        { edge: "mobile-notify", text: "Each device is told 'new changes'…" },
        { edge: "mobile-lb", text: "…and asks for changes since its cursor." },
        { edge: "mobile-blocks", text: "It downloads only the blocks it doesn't already have." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Re-uploading whole files for small edits",
      fix: "Block-level chunking with content hashes; only changed blocks move. Identical files across users are stored once.",
      nodes: ["desktop", "blocks"],
    },
    {
      problem: "Millions of idle devices polling for changes",
      fix: "Long-lived notification connections that only say 'something changed'; devices then pull a delta.",
      nodes: ["notify"],
    },
    {
      problem: "Two devices editing the same file offline",
      fix: "Commits carry the base version; a mismatch creates a conflicted copy instead of overwriting.",
      nodes: ["meta-svc", "meta-db"],
    },
    {
      problem: "Huge shared folders become metadata hotspots",
      fix: "Shard by namespace and cache listings; paginate change lists.",
      nodes: ["meta-db", "meta-cache"],
    },
  ],

  scaling: [
    "Shard metadata by namespace so each folder's journal lives on one shard.",
    "Object storage scales on its own; replicate blocks across zones or regions.",
    "Scale the notification tier horizontally with a connection registry.",
    "Keep block uploads off the API servers by using pre-signed URLs.",
  ],

  extensions: [
    "LAN sync between devices on the same network.",
    "Selective sync and on-demand placeholder files.",
    "Full-text search over documents.",
    "Client-side encryption.",
  ],
};
