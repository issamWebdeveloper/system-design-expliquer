import type { SystemDesignInput } from "@/types/schema";

export const webCrawler: SystemDesignInput = {
  slug: "web-crawler",
  name: "Web crawler",
  tagline: "Fetch billions of pages politely and without repeats",
  description:
    "A URL frontier hands URLs to fetcher workers, one queue per host so no site is hammered. Fetched pages are stored, parsed for links, and new links are checked against a Bloom filter of everything already seen before going back into the frontier. Content fingerprints catch the same page under different URLs, and a scheduler re-queues pages when they're due for a recrawl.",
  category: "infrastructure",
  difficulty: 3,
  concepts: ["bloom-filter", "back-pressure", "consistent-hashing", "leader-election", "sharding"],

  requirements: {
    functional: [
      "Start from seed URLs and follow links to discover new pages",
      "Respect robots.txt and per-site rate limits (politeness)",
      "Skip URLs already crawled and pages whose content is a duplicate",
      "Store raw pages for indexing and analysis",
      "Recrawl pages based on how often they change",
    ],
    nonFunctional: [
      "Billions of pages per month on a horizontally scalable cluster",
      "Never overload a single website",
      "Resilient to slow, broken or malicious sites (timeouts, size limits, traps)",
      "Workers can fail without losing frontier state",
    ],
  },

  apis: [
    { method: "POST", path: "/seeds", purpose: "Add seed URLs or domains to crawl" },
    { method: "GET", path: "/urls/{urlHash}", purpose: "Crawl status, last fetch time and HTTP result for a URL" },
    { method: "PUT", path: "/hosts/{host}/policy", purpose: "Override crawl rate or exclusion for a site" },
  ],

  estimates: [
    { label: "Pages fetched", value: "≈ 1 B/month (~400/s)", derivation: "Assumption; scale fetchers linearly for more" },
    { label: "Raw storage", value: "≈ 100 TB/month", derivation: "1 B × ~100 KB per page; ~25 TB compressed" },
    { label: "Discovered links", value: "≈ 20 k/s before dedupe", derivation: "400 pages/s × ~50 outlinks" },
    { label: "Seen-URL filter", value: "≈ 12 GB", derivation: "10 B URLs × 10 bits each for ~1% false positives" },
  ],

  dataModel: [
    {
      entity: "URL record",
      store: "Wide-column DB",
      key: "urlHash",
      fields: ["url", "host", "lastFetched", "status", "contentHash", "changeRate", "nextDue"],
      why: "Billions of rows, updated after every fetch",
    },
    {
      entity: "Frontier entry",
      store: "Queue per host (sharded by host)",
      key: "host",
      fields: ["url", "priority", "notBefore"],
      why: "One queue per host makes politeness a simple rule: one fetch per host at a time",
    },
    {
      entity: "Page",
      store: "Object storage",
      key: "urlHash/fetchTime",
      fields: ["headers", "compressed HTML"],
      why: "Large immutable blobs for downstream indexing",
    },
    {
      entity: "Content fingerprint",
      store: "Key-value DB",
      key: "simhash / sha256",
      fields: ["firstUrl"],
      why: "Detects mirrors and duplicates under different URLs",
    },
  ],

  nodes: [
    { id: "scheduler", kind: "service", label: "Crawl scheduler", role: "Adds seeds and re-queues pages that are due for a recrawl" },
    { id: "frontier", kind: "message-queue", label: "URL frontier", role: "Per-host queues with priorities and next-allowed times" },
    { id: "fetchers", kind: "service", label: "Fetcher workers", role: "Download pages with timeouts and size limits" },
    { id: "coordinator", kind: "coordination", label: "Coordinator", role: "Assigns hosts to fetchers (consistent hashing) and elects a leader" },
    { id: "dns-cache", kind: "cache", label: "DNS & robots cache", role: "Resolved IPs, robots.txt rules and per-host rate limits" },
    { id: "websites", kind: "partner-api", label: "Websites", role: "The open web" },
    { id: "page-store", kind: "object-storage", label: "Page store", role: "Raw fetched pages" },
    { id: "parser", kind: "service", label: "Parser & link extractor", role: "Extracts text, links and a content fingerprint" },
    { id: "seen-urls", kind: "cache", label: "Seen-URL Bloom filter", role: "Fast 'have we queued this before?' check" },
    { id: "fingerprints", kind: "nosql-db", label: "Content fingerprints", role: "Detects duplicate content" },
    { id: "url-db", kind: "wide-column-db", label: "URL metadata", role: "Status and schedule for every known URL" },
    { id: "indexer", kind: "search", label: "Search index", role: "Downstream consumer of crawled text" },
  ],

  edges: [
    { id: "scheduler-frontier", from: "scheduler", to: "frontier", label: "Seeds / due URLs", protocol: "async" },
    { id: "scheduler-db", from: "scheduler", to: "url-db", label: "Find due pages" },
    { id: "frontier-fetchers", from: "frontier", to: "fetchers", protocol: "async" },
    { id: "fetchers-coordinator", from: "fetchers", to: "coordinator", label: "Host ownership" },
    { id: "fetchers-dns", from: "fetchers", to: "dns-cache", label: "Resolve, robots, rate limit" },
    { id: "fetchers-web", from: "fetchers", to: "websites", label: "HTTP GET" },
    { id: "fetchers-store", from: "fetchers", to: "page-store", label: "Raw HTML" },
    { id: "fetchers-parser", from: "fetchers", to: "parser", label: "Fetched page", protocol: "async" },
    { id: "parser-fingerprints", from: "parser", to: "fingerprints", label: "Duplicate content?" },
    { id: "parser-seen", from: "parser", to: "seen-urls", label: "Seen this URL?" },
    { id: "parser-frontier", from: "parser", to: "frontier", label: "New URLs", protocol: "async" },
    { id: "parser-db", from: "parser", to: "url-db", label: "Update status" },
    { id: "store-indexer", from: "page-store", to: "indexer", label: "Index text", protocol: "stream" },
  ],

  flows: [
    {
      id: "crawl",
      name: "Crawl one page",
      steps: [
        { edge: "frontier-fetchers", text: "A fetcher takes the next URL from a host queue it owns — at most one in-flight request per host." },
        { edge: "fetchers-dns", text: "It checks the cached robots.txt rules and the host's crawl delay, and resolves DNS from cache." },
        { edge: "fetchers-web", text: "It downloads the page with a timeout and a size cap." },
        { edge: "fetchers-store", text: "The raw HTML is stored." },
        { edge: "fetchers-parser", text: "The page is handed to a parser." },
        { edge: "parser-fingerprints", text: "A content fingerprint flags mirrors and duplicates." },
        { edge: "parser-seen", text: "Each extracted link is normalised and checked against the Bloom filter." },
        { edge: "parser-frontier", text: "Only unseen links enter the frontier, in their host's queue." },
        { edge: "parser-db", text: "The URL's status, hash and next recrawl time are saved." },
        { edge: "store-indexer", text: "Downstream, the text is indexed for search." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Hammering one website",
      fix: "Per-host queues owned by a single fetcher, honouring robots.txt and adaptive delays based on response times.",
      nodes: ["frontier", "fetchers", "coordinator"],
    },
    {
      problem: "Billions of 'have we seen this URL?' checks",
      fix: "A sharded in-memory Bloom filter answers almost all checks; only 'maybe seen' hits the database.",
      nodes: ["seen-urls", "url-db"],
    },
    {
      problem: "Crawler traps and huge pages",
      fix: "Cap URL depth, length and pages per host; enforce byte limits and timeouts.",
      nodes: ["fetchers", "parser"],
    },
    {
      problem: "Link discovery outpaces fetching",
      fix: "Prioritise the frontier (page importance, change rate) and drop or defer low-value URLs when queues grow.",
      nodes: ["frontier", "scheduler"],
    },
  ],

  scaling: [
    "Assign hosts to fetchers with consistent hashing so adding a worker moves few hosts.",
    "Shard the frontier, Bloom filter and URL store by host or URL hash.",
    "Run fetchers in several regions to reduce latency to far-away sites.",
    "Checkpoint the frontier so a crashed worker's hosts are picked up by others.",
  ],

  extensions: [
    "JavaScript rendering for client-side apps (headless browser pool).",
    "Focused crawling for one topic or set of domains.",
    "Sitemap and RSS ingestion to find new pages faster.",
  ],
};
