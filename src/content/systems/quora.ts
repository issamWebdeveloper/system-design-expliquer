import type { SystemDesignInput } from "@/types/schema";

export const quora: SystemDesignInput = {
  slug: "quora",
  name: "Quora",
  tagline: "Questions, answers, votes and a personalised feed",
  description:
    "When someone asks a question, search first suggests similar existing questions to avoid duplicates. New questions and answers are stored in sharded relational tables, indexed for search, and fanned out to followers of the topic. Votes are counted in a fast cache and folded into a ranking model that orders answers and builds each reader's feed.",
  category: "media-social",
  difficulty: 2,
  concepts: ["fan-out", "search-indexing", "caching", "sharding", "event-driven"],

  requirements: {
    functional: [
      "Ask questions tagged with topics; get duplicate suggestions while typing",
      "Answer, comment, upvote and downvote",
      "Follow topics, questions and people",
      "Personalised home feed and answer ranking",
      "Search questions, notifications for answers and mentions",
    ],
    nonFunctional: [
      "Read-heavy: answers are read many times more than written",
      "Feed loads quickly; vote counts may lag slightly",
      "Spam and low-quality content kept out",
    ],
  },

  apis: [
    { method: "GET", path: "/questions/similar?q=", purpose: "Possible duplicates while typing" },
    { method: "POST", path: "/questions", purpose: "Ask a question with topics" },
    { method: "POST", path: "/questions/{id}/answers", purpose: "Post an answer" },
    { method: "POST", path: "/answers/{id}/vote", purpose: "Up or down vote (idempotent per user)" },
    { method: "GET", path: "/feed?cursor=", purpose: "Personalised feed" },
  ],

  estimates: [
    { label: "Daily users", value: "≈ 100 M", derivation: "Assumption" },
    { label: "New answers", value: "≈ 1 M/day", derivation: "Assumption; ~12/s" },
    { label: "Answer reads", value: "≈ 50 k/s", derivation: "100 M users × ~40 answers viewed ÷ 86,400 s" },
    { label: "Votes", value: "≈ 2 k/s", derivation: "Assumption" },
  ],

  dataModel: [
    {
      entity: "Question / Answer",
      store: "Relational DB, sharded by questionId",
      key: "questionId (+ answerId)",
      fields: ["authorId", "text", "topics", "createdAt", "score"],
      why: "A question and its answers live on one shard",
    },
    {
      entity: "Vote",
      store: "Wide-column DB + cached counters",
      key: "answerId + userId",
      fields: ["value"],
      why: "One vote per user; totals kept as counters",
    },
    {
      entity: "Follow",
      store: "Relational DB",
      key: "userId + topicId/questionId/userId",
      fields: ["createdAt"],
      why: "Drives feed fan-out and notifications",
    },
    {
      entity: "Feed entry",
      store: "In-memory cache",
      key: "userId",
      fields: ["itemIds with scores"],
      why: "Pre-built candidates for fast feed reads",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Read, ask, answer" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Read, ask, answer" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Images and static assets" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits" },
    { id: "qa-svc", kind: "service", label: "Q&A service", role: "Questions, answers, comments" },
    { id: "vote-svc", kind: "service", label: "Vote service", role: "Records votes and updates counters" },
    { id: "feed-svc", kind: "service", label: "Feed service", role: "Assembles and ranks each user's feed" },
    { id: "search-svc", kind: "service", label: "Search service", role: "Search and duplicate detection" },
    { id: "search-index", kind: "search", label: "Question index", role: "Questions and answers by text" },
    { id: "ranking", kind: "ml-platform", label: "Ranking models", role: "Answer quality and feed relevance" },
    { id: "main-db", kind: "relational-db", label: "Questions, answers & follows", role: "Sharded relational store" },
    { id: "votes-db", kind: "wide-column-db", label: "Votes & activity", role: "High-volume activity" },
    { id: "counters", kind: "cache", label: "Counters & feeds", role: "Vote counts and pre-built feeds" },
    { id: "events", kind: "event-stream", label: "Content events", role: "New questions, answers, votes" },
    { id: "fanout", kind: "service", label: "Fan-out workers", role: "Push new content to topic followers' feeds" },
    { id: "notify", kind: "notifications", label: "Notifications", role: "New answers and mentions" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-qa", from: "gateway", to: "qa-svc", protocol: "grpc" },
    { id: "gateway-vote", from: "gateway", to: "vote-svc", protocol: "grpc" },
    { id: "gateway-feed", from: "gateway", to: "feed-svc", protocol: "grpc" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index-read", from: "search-svc", to: "search-index" },
    { id: "qa-db", from: "qa-svc", to: "main-db" },
    { id: "qa-events", from: "qa-svc", to: "events", protocol: "stream" },
    { id: "vote-db", from: "vote-svc", to: "votes-db" },
    { id: "vote-counters", from: "vote-svc", to: "counters", label: "Increment" },
    { id: "vote-events", from: "vote-svc", to: "events", protocol: "stream" },
    { id: "events-index", from: "events", to: "search-index", protocol: "stream" },
    { id: "events-fanout", from: "events", to: "fanout", protocol: "async" },
    { id: "fanout-counters", from: "fanout", to: "counters", label: "Feed candidates" },
    { id: "events-ranking", from: "events", to: "ranking", label: "Signals", protocol: "stream" },
    { id: "feed-counters", from: "feed-svc", to: "counters" },
    { id: "feed-ranking", from: "feed-svc", to: "ranking", label: "Score" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "ask",
      name: "Ask a question",
      steps: [
        { edge: "web-gateway", text: "As the user types, similar questions are suggested." },
        { edge: "gateway-search", text: "The search service checks for duplicates." },
        { edge: "search-index-read", text: "Close matches are shown; the user decides to post anyway." },
        { edge: "gateway-qa", text: "The question is posted with topics." },
        { edge: "qa-db", text: "It's stored on its shard." },
        { edge: "qa-events", text: "A 'new question' event is published." },
        { edge: "events-index", text: "It becomes searchable." },
        { edge: "events-fanout", text: "Fan-out workers add it to topic followers' feed candidates." },
        { edge: "fanout-counters", text: "Feeds are updated in cache." },
      ],
    },
    {
      id: "feed",
      name: "Read the feed",
      steps: [
        { edge: "mobile-gateway", text: "The user opens the app." },
        { edge: "gateway-feed", text: "The feed service gathers candidates." },
        { edge: "feed-counters", text: "Pre-built candidates and vote counts come from cache." },
        { edge: "feed-ranking", text: "The ranking model orders them for this user." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Hot answers receiving many votes",
      fix: "Count in cache, persist votes asynchronously, and recompute scores in batches.",
      nodes: ["vote-svc", "counters"],
    },
    {
      problem: "Duplicate questions",
      fix: "Similarity search while typing and merging duplicates afterwards.",
      nodes: ["search-svc", "search-index"],
    },
    {
      problem: "Popular topics with millions of followers",
      fix: "Pull topic content at read time for very large topics instead of fanning out.",
      nodes: ["fanout", "feed-svc"],
    },
  ],

  scaling: [
    "Shard questions by questionId; cache hot questions.",
    "Separate write-heavy activity (votes, views) from content storage.",
    "Use coordination (ZooKeeper) for shard maps and leader election in background jobs.",
  ],

  extensions: [
    "Spaces (communities) with their own feeds.",
    "Answer requests to experts.",
    "Machine translation of answers.",
  ],
};
