import type { SystemDesignInput } from "@/types/schema";

export const linkedin: SystemDesignInput = {
  slug: "linkedin",
  name: "LinkedIn",
  tagline: "Profiles, connections, feed, messaging and jobs",
  description:
    "The professional graph is the core: connections live in a graph store that answers 'how am I connected to this person?' and powers 'People you may know'. Posts fan out to connections' feeds and are ranked by a model. Jobs are a separate search vertical matched to profiles, and messaging runs on a real-time tier.",
  category: "media-social",
  difficulty: 3,
  concepts: ["fan-out", "search-indexing", "sharding", "caching", "event-driven"],

  requirements: {
    functional: [
      "Profiles with experience, skills and education",
      "Send and accept connection requests; follow people and companies",
      "Post updates; see a ranked feed",
      "Search people and jobs; apply to jobs",
      "Direct messaging and notifications",
    ],
    nonFunctional: [
      "Graph queries (degree of connection) in milliseconds",
      "Feed loads quickly for hundreds of millions of users",
      "Profile updates visible in search within minutes",
    ],
  },

  apis: [
    { method: "GET", path: "/profiles/{id}", purpose: "Profile with your degree of connection" },
    { method: "POST", path: "/connections/requests", purpose: "Send a connection request" },
    { method: "POST", path: "/connections/requests/{id}/accept", purpose: "Accept" },
    { method: "GET", path: "/feed?cursor=", purpose: "Ranked feed" },
    { method: "GET", path: "/jobs/search?q=&location=", purpose: "Job search" },
    { method: "WS", path: "/messaging", purpose: "Real-time messages" },
  ],

  estimates: [
    { label: "Members", value: "≈ 1 B, 150 M daily", derivation: "Assumption based on public figures" },
    { label: "Connections", value: "≈ 50–100 B edges", derivation: "Average of a few hundred connections per member" },
    { label: "Feed requests", value: "≈ 20 k/s avg", derivation: "150 M × ~10 feed loads ÷ 86,400 s" },
    { label: "Job searches", value: "≈ 5 k/s", derivation: "Assumption" },
  ],

  dataModel: [
    {
      entity: "Profile",
      store: "Relational / document DB, sharded by memberId",
      key: "memberId",
      fields: ["name", "headline", "positions", "skills", "education"],
      why: "Read-heavy; also fed into search",
    },
    {
      entity: "Connection",
      store: "Graph store",
      key: "memberId → memberId",
      fields: ["since", "type (connection/follow)"],
      why: "Degree-of-connection and 'people you may know' traversals",
    },
    {
      entity: "Post",
      store: "Wide-column DB",
      key: "postId (time-sortable)",
      fields: ["authorId", "text", "media", "createdAt"],
      why: "High volume, read via feeds",
    },
    {
      entity: "Job",
      store: "Search index + relational DB",
      key: "jobId",
      fields: ["companyId", "title", "location", "skills", "postedAt"],
      why: "Full-text and facet search",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Profiles, feed, jobs" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Feed, messaging, notifications" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Profile photos and media" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth and routing" },
    { id: "profile-svc", kind: "service", label: "Profile service", role: "Profiles and settings" },
    { id: "graph-svc", kind: "service", label: "Graph service", role: "Connections and degree queries" },
    { id: "graph-db", kind: "graph-db", label: "Member graph", role: "Connections and follows" },
    { id: "feed-svc", kind: "service", label: "Feed service", role: "Collects and ranks posts" },
    { id: "feed-cache", kind: "cache", label: "Feed cache", role: "Recent post IDs per member" },
    { id: "jobs-svc", kind: "service", label: "Jobs service", role: "Job search, applications" },
    { id: "search-index", kind: "search", label: "People & jobs index", role: "Members and job postings" },
    { id: "recommend", kind: "ml-platform", label: "Recommendations", role: "People you may know, job matches, feed ranking" },
    { id: "messaging", kind: "realtime-gateway", label: "Messaging", role: "Real-time conversations" },
    { id: "main-db", kind: "relational-db", label: "Profiles & jobs", role: "Sharded by member / company" },
    { id: "posts-db", kind: "wide-column-db", label: "Posts", role: "Member posts and activity" },
    { id: "events", kind: "event-stream", label: "Activity events", role: "Profile edits, posts, connections" },
    { id: "notify", kind: "notifications", label: "Notifications", role: "Requests, messages, job alerts" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-profile", from: "gateway", to: "profile-svc", protocol: "grpc" },
    { id: "gateway-graph", from: "gateway", to: "graph-svc", protocol: "grpc" },
    { id: "gateway-feed", from: "gateway", to: "feed-svc", protocol: "grpc" },
    { id: "gateway-jobs", from: "gateway", to: "jobs-svc", protocol: "grpc" },
    { id: "profile-db", from: "profile-svc", to: "main-db" },
    { id: "graph-store", from: "graph-svc", to: "graph-db" },
    { id: "graph-events", from: "graph-svc", to: "events", protocol: "stream" },
    { id: "profile-events", from: "profile-svc", to: "events", protocol: "stream" },
    { id: "feed-cache-read", from: "feed-svc", to: "feed-cache" },
    { id: "feed-posts", from: "feed-svc", to: "posts-db", label: "Hydrate" },
    { id: "feed-recommend", from: "feed-svc", to: "recommend", label: "Rank" },
    { id: "events-feed", from: "events", to: "feed-cache", label: "Fan-out", protocol: "async" },
    { id: "events-index", from: "events", to: "search-index", protocol: "stream" },
    { id: "events-recommend", from: "events", to: "recommend", protocol: "stream" },
    { id: "jobs-index", from: "jobs-svc", to: "search-index" },
    { id: "jobs-recommend", from: "jobs-svc", to: "recommend", label: "Job matches" },
    { id: "mobile-messaging", from: "mobile", to: "messaging", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "connect",
      name: "Accept a connection",
      steps: [
        { edge: "mobile-gateway", text: "The member accepts a connection request." },
        { edge: "gateway-graph", text: "The graph service handles it." },
        { edge: "graph-store", text: "A connection edge is added in both directions." },
        { edge: "graph-events", text: "A 'connected' event is published." },
        { edge: "events-feed", text: "Each member's recent posts can now appear in the other's feed." },
        { edge: "events-recommend", text: "'People you may know' is refreshed from the new second-degree connections." },
        { edge: "events-notify", text: "The requester is notified." },
      ],
    },
    {
      id: "jobs",
      name: "Find a job",
      steps: [
        { edge: "web-gateway", text: "The member searches 'backend engineer, Bangalore'." },
        { edge: "gateway-jobs", text: "The jobs service runs the search." },
        { edge: "jobs-index", text: "The index matches title, location and skills." },
        { edge: "jobs-recommend", text: "Results are re-ranked by fit with the member's profile." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Graph traversals across billions of edges",
      fix: "Partition the graph by member, cache first-degree lists in memory, and precompute second-degree candidates offline.",
      nodes: ["graph-svc", "graph-db"],
    },
    {
      problem: "Influencers with millions of followers",
      fix: "Hybrid feed: pull their posts at read time instead of fanning out.",
      nodes: ["feed-svc", "feed-cache"],
    },
    {
      problem: "Search freshness after profile edits",
      fix: "Stream profile changes into the index within minutes.",
      nodes: ["events", "search-index"],
    },
  ],

  scaling: [
    "Shard members, posts and the graph by memberId.",
    "Precompute recommendations offline and serve from cache.",
    "Separate messaging into its own real-time tier.",
  ],

  extensions: [
    "Company pages and recruiter tools.",
    "Learning courses.",
    "Skill assessments and endorsements.",
  ],
};
