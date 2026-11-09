import type { SystemDesignInput } from "@/types/schema";

export const liveSports: SystemDesignInput = {
  slug: "live-sports",
  name: "Live sports scores",
  tagline: "Real-time scores, commentary and alerts for millions",
  description:
    "Official scorers and data partners send every ball, goal or point into an ingest service. Events flow through a stream where a processor updates the match state and statistics. The new score lands in a cache, is pushed over WebSockets to everyone watching, and triggers push notifications for big moments — while snapshots are cached at the CDN for everyone else.",
  category: "media-social",
  difficulty: 2,
  concepts: ["websockets", "event-driven", "caching", "back-pressure", "fan-out"],

  requirements: {
    functional: [
      "Live scores, play-by-play and commentary for many matches at once",
      "Player and team statistics updated in real time",
      "Push alerts for goals, wickets and results",
      "Schedules, fixtures and standings",
      "Admin tools for official scorers to correct mistakes",
    ],
    nonFunctional: [
      "Updates reach viewers within 1–2 seconds",
      "Huge spikes during big matches (tens of millions watching)",
      "Events applied in order; corrections must propagate",
    ],
  },

  apis: [
    { method: "POST", path: "/ingest/matches/{id}/events", purpose: "Scorer or partner sends a ball/goal event (sequence numbered)" },
    { method: "GET", path: "/matches/{id}", purpose: "Current snapshot (CDN-cached for a second or two)" },
    { method: "WS", path: "/matches/{id}/live", purpose: "Subscribe to live updates" },
    { method: "GET", path: "/matches/{id}/commentary?after=", purpose: "Play-by-play history" },
  ],

  estimates: [
    { label: "Viewers during a final", value: "≈ 20–50 M", derivation: "Assumption for a major match" },
    { label: "Score events", value: "≈ 1 per few seconds per match", derivation: "Low input volume" },
    { label: "Push fan-out", value: "≈ 10–50 M messages per event", derivation: "Every viewer gets every update" },
    { label: "Alert bursts", value: "≈ 50 M notifications in seconds", derivation: "A goal alert to every follower" },
  ],

  dataModel: [
    {
      entity: "Match event",
      store: "Time-series DB",
      key: "matchId + sequence",
      fields: ["type", "payload", "time", "correctionOf?"],
      why: "Ordered play-by-play; corrections reference earlier events",
    },
    {
      entity: "Match state",
      store: "In-memory cache",
      key: "matchId",
      fields: ["score", "clock", "lastSequence", "keyStats"],
      why: "Read by millions; rebuilt from events if lost",
    },
    {
      entity: "Fixture / standings",
      store: "Key-value DB",
      key: "competitionId",
      fields: ["matches", "table"],
      why: "Mostly static, heavily cached",
    },
  ],

  nodes: [
    { id: "scorer", kind: "web-client", label: "Official scorer app", role: "Enters each event at the venue" },
    { id: "partners", kind: "partner-api", label: "Data partners", role: "Licensed data feeds" },
    { id: "viewers", kind: "mobile-client", label: "Fan apps", role: "Watch scores and commentary" },
    { id: "web", kind: "web-client", label: "Web", role: "Scores and stats" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Short-TTL snapshots for page loads" },
    { id: "ingest", kind: "service", label: "Ingest service", role: "Validates, orders and dedupes events" },
    { id: "stream", kind: "event-stream", label: "Match event stream", role: "Ordered events per match" },
    { id: "processor", kind: "stream-processor", label: "Match state processor", role: "Applies events, updates stats" },
    { id: "state", kind: "cache", label: "Match state", role: "Latest score per match" },
    { id: "history", kind: "time-series-db", label: "Play-by-play", role: "Every event for replay and stats" },
    { id: "api", kind: "service", label: "Scores API", role: "Snapshots and history" },
    { id: "ws", kind: "realtime-gateway", label: "Live gateway", role: "Pushes updates to subscribers" },
    { id: "notify", kind: "notifications", label: "Push alerts", role: "Goal and result alerts" },
  ],

  edges: [
    { id: "scorer-ingest", from: "scorer", to: "ingest", label: "Events" },
    { id: "partners-ingest", from: "partners", to: "ingest", label: "Feeds" },
    { id: "ingest-stream", from: "ingest", to: "stream", protocol: "stream" },
    { id: "stream-processor", from: "stream", to: "processor", protocol: "stream" },
    { id: "processor-state", from: "processor", to: "state" },
    { id: "processor-history", from: "processor", to: "history" },
    { id: "processor-ws", from: "processor", to: "ws", label: "Updates", protocol: "stream" },
    { id: "processor-notify", from: "processor", to: "notify", label: "Big moments", protocol: "async" },
    { id: "viewers-ws", from: "viewers", to: "ws", protocol: "ws" },
    { id: "web-cdn", from: "web", to: "cdn", label: "Snapshot" },
    { id: "cdn-api", from: "cdn", to: "api" },
    { id: "api-state", from: "api", to: "state" },
    { id: "api-history", from: "api", to: "history" },
  ],

  flows: [
    {
      id: "goal",
      name: "A goal is scored",
      steps: [
        { edge: "scorer-ingest", text: "The official scorer records a goal with the next sequence number." },
        { edge: "ingest-stream", text: "Ingest validates it and publishes it to the match's partition, keeping order." },
        { edge: "stream-processor", text: "The processor applies it to the match state." },
        { edge: "processor-state", text: "The new score is written to cache." },
        { edge: "processor-history", text: "The event is added to play-by-play." },
        { edge: "processor-ws", text: "The update is pushed to every live subscriber…" },
        { edge: "viewers-ws", text: "…and fans see 1–0 within a second or two." },
        { edge: "processor-notify", text: "Followers of either team get a push alert." },
        { edge: "web-cdn", text: "Anyone opening the page later gets a snapshot that is at most a couple of seconds old." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Fan-out to tens of millions at once",
      fix: "Topic-per-match subscriptions on a horizontally scaled gateway; send small diffs.",
      nodes: ["ws"],
    },
    {
      problem: "Page-load storms at kick-off",
      fix: "Serve snapshots from the CDN with 1–2 second TTLs so the origin sees a trickle.",
      nodes: ["cdn", "api"],
    },
    {
      problem: "Out-of-order or duplicate events from multiple sources",
      fix: "Sequence numbers per match, dedupe at ingest, and correction events that rewrite state.",
      nodes: ["ingest", "processor"],
    },
  ],

  scaling: [
    "Partition the event stream by matchId.",
    "Scale gateways by subscriber count; pre-warm before big matches.",
    "Rebuild match state from the event log if the cache is lost.",
  ],

  extensions: [
    "Fantasy sports scoring from the same events.",
    "Live win-probability models.",
    "Video highlight clips linked to events.",
  ],
};
