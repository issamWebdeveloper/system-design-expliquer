import type { SystemDesignInput } from "@/types/schema";

export const twitter: SystemDesignInput = {
  slug: "twitter",
  name: "Twitter / X",
  tagline: "Short posts, follow graph and real-time home timelines",
  description:
    "Every tweet gets a time-sortable ID and is stored once, then a fan-out service copies its ID into each follower's cached home timeline so reading a timeline is a single lookup. Accounts with huge followings are handled the other way round: their tweets are merged in when a follower reads. A stream processor counts hashtags to surface trends.",
  category: "media-social",
  difficulty: 3,
  concepts: ["fan-out", "id-generation", "caching", "consistent-hashing", "event-driven", "search-indexing"],

  requirements: {
    functional: [
      "Post short tweets with optional images, replies and retweets",
      "Follow and unfollow users",
      "Home timeline of tweets from people you follow, newest (or most relevant) first",
      "User timeline showing one person's tweets",
      "Like and retweet; search tweets and hashtags; see trending topics",
    ],
    nonFunctional: [
      "Extremely read-heavy: timeline reads outnumber tweets by ~10×",
      "Home timeline loads in a few hundred milliseconds",
      "A new tweet should reach followers within seconds (eventual consistency is fine)",
      "Highly available; tweets are never lost once acknowledged",
    ],
  },

  apis: [
    { method: "POST", path: "/tweets", purpose: "Post a tweet (text, media IDs, replyTo); returns the tweetId" },
    { method: "GET", path: "/timeline/home?cursor=", purpose: "Home timeline, paginated by tweetId cursor" },
    { method: "GET", path: "/users/{userId}/tweets?cursor=", purpose: "A user's own tweets" },
    { method: "POST", path: "/users/{userId}/follow", purpose: "Follow a user" },
    { method: "POST", path: "/tweets/{tweetId}/like", purpose: "Like (idempotent)" },
    { method: "POST", path: "/tweets/{tweetId}/retweet", purpose: "Retweet" },
    { method: "GET", path: "/search?q=", purpose: "Search tweets and hashtags" },
    { method: "GET", path: "/trends?location=", purpose: "Trending topics" },
  ],

  estimates: [
    { label: "Daily active users", value: "≈ 200 M", derivation: "Assumption" },
    { label: "Tweets per day", value: "≈ 1 B (~12 k/s)", derivation: "200 M users × ~5 tweets ÷ 86,400 s" },
    { label: "Timeline reads", value: "≈ 115 k/s", derivation: "200 M users × 50 tweets viewed ÷ 86,400 s" },
    { label: "Tweet storage", value: "≈ 200 GB/day", derivation: "1 B tweets × ~200 bytes (text + metadata)" },
    { label: "Media storage", value: "≈ 5 TB/day", derivation: "10% of tweets with media × ~50 KB" },
  ],

  dataModel: [
    {
      entity: "Tweet",
      store: "Wide-column DB",
      key: "tweetId (Snowflake: time + machine + sequence)",
      fields: ["authorId", "text", "mediaUrls", "replyTo", "retweetOf", "createdAt"],
      why: "Huge write volume; IDs sort by time so no extra timestamp index is needed",
    },
    {
      entity: "User tweets index",
      store: "Wide-column DB",
      key: "authorId + tweetId",
      fields: ["tweetId"],
      why: "Serves the user timeline and celebrity merge in one range scan",
    },
    {
      entity: "User",
      store: "Relational DB",
      key: "userId",
      fields: ["handle", "name", "bio", "followerCount", "isCelebrity"],
      why: "Unique handles, transactional updates",
    },
    {
      entity: "Follow",
      store: "Relational or graph store",
      key: "followerId + followeeId",
      fields: ["createdAt"],
      why: "Both directions needed: fan-out uses followers, reads use followees",
    },
    {
      entity: "Home timeline",
      store: "In-memory cache (list per user)",
      key: "userId",
      fields: ["last ~800 tweetIds"],
      why: "Pre-computed so reads are one lookup; rebuilt from the DB if evicted",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Post and scroll timelines" },
    { id: "web", kind: "web-client", label: "Web app", role: "Post and scroll timelines" },
    { id: "cdn", kind: "cdn", label: "Media CDN", role: "Images, video and avatars" },
    { id: "lb", kind: "load-balancer", label: "Load balancer", role: "Spreads API traffic" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limiting, routing" },
    { id: "tweet-svc", kind: "service", label: "Tweet service", role: "Validates tweets and assigns Snowflake IDs" },
    { id: "timeline-svc", kind: "service", label: "Timeline service", role: "Reads cached timelines and merges celebrity tweets" },
    { id: "user-svc", kind: "service", label: "User & graph service", role: "Profiles and follow relationships" },
    { id: "fanout", kind: "service", label: "Fan-out service", role: "Copies new tweet IDs into followers' timelines" },
    { id: "search-svc", kind: "service", label: "Search service", role: "Full-text search over recent tweets" },
    { id: "events", kind: "event-stream", label: "Tweet events", role: "Every new tweet, like and follow" },
    { id: "trends", kind: "stream-processor", label: "Trends", role: "Counts hashtags in sliding windows per region" },
    { id: "tweet-store", kind: "wide-column-db", label: "Tweet store", role: "All tweets, plus a per-author index" },
    { id: "user-db", kind: "relational-db", label: "Users & follows", role: "Profiles and the follow graph" },
    { id: "timeline-cache", kind: "cache", label: "Home timelines", role: "Recent tweet IDs per user" },
    { id: "search-index", kind: "search", label: "Search index", role: "Recent tweets by term and hashtag" },
    { id: "media-store", kind: "object-storage", label: "Media storage", role: "Uploaded images and video" },
  ],

  edges: [
    { id: "mobile-lb", from: "mobile", to: "lb", label: "API" },
    { id: "web-lb", from: "web", to: "lb" },
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Media" },
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "lb-gateway", from: "lb", to: "gateway" },
    { id: "gateway-tweet", from: "gateway", to: "tweet-svc", protocol: "grpc" },
    { id: "gateway-timeline", from: "gateway", to: "timeline-svc", protocol: "grpc" },
    { id: "gateway-user", from: "gateway", to: "user-svc", protocol: "grpc" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "tweet-store-write", from: "tweet-svc", to: "tweet-store" },
    { id: "tweet-media", from: "tweet-svc", to: "media-store", label: "Media" },
    { id: "tweet-events", from: "tweet-svc", to: "events", label: "New tweet", protocol: "stream" },
    { id: "events-fanout", from: "events", to: "fanout", protocol: "async" },
    { id: "fanout-followers", from: "fanout", to: "user-db", label: "Followers" },
    { id: "fanout-cache", from: "fanout", to: "timeline-cache", label: "Push tweet IDs" },
    { id: "timeline-cache-read", from: "timeline-svc", to: "timeline-cache" },
    { id: "timeline-celebs", from: "timeline-svc", to: "tweet-store", label: "Celebrity tweets + hydrate" },
    { id: "user-db-rw", from: "user-svc", to: "user-db" },
    { id: "events-search", from: "events", to: "search-index", label: "Index", protocol: "stream" },
    { id: "search-read", from: "search-svc", to: "search-index" },
    { id: "events-trends", from: "events", to: "trends", protocol: "stream" },
    { id: "cdn-origin", from: "cdn", to: "media-store", label: "Origin" },
  ],

  flows: [
    {
      id: "tweet",
      name: "Post a tweet",
      steps: [
        { edge: "mobile-lb", text: "The user posts a tweet." },
        { edge: "lb-gateway", text: "The gateway authenticates and rate-limits." },
        { edge: "gateway-tweet", text: "The tweet service validates the text and assigns a Snowflake ID." },
        { edge: "tweet-store-write", text: "The tweet is stored once in the tweet store." },
        { edge: "tweet-events", text: "A 'new tweet' event is published; the user gets a success response." },
        { edge: "events-fanout", text: "The fan-out service picks it up." },
        { edge: "fanout-followers", text: "It looks up the author's followers (skipped for celebrities)." },
        { edge: "fanout-cache", text: "It prepends the tweet ID to each follower's cached home timeline." },
        { edge: "events-search", text: "In parallel the tweet is indexed for search…" },
        { edge: "events-trends", text: "…and its hashtags are counted for trends." },
      ],
    },
    {
      id: "home",
      name: "Read home timeline",
      steps: [
        { edge: "mobile-lb", text: "The app requests the home timeline." },
        { edge: "lb-gateway", text: "The request is authenticated and routed." },
        { edge: "gateway-timeline", text: "The timeline service handles it." },
        { edge: "timeline-cache-read", text: "It reads the user's cached list of tweet IDs." },
        { edge: "timeline-celebs", text: "It merges recent tweets from followed celebrities and hydrates IDs into full tweets." },
        { edge: "mobile-cdn", text: "Images load from the CDN." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "A tweet from an account with 100 M followers means 100 M cache writes",
      fix: "Skip fan-out for celebrities; merge their recent tweets at read time (hybrid push/pull).",
      nodes: ["fanout", "timeline-svc", "timeline-cache"],
    },
    {
      problem: "Timeline cache memory for every user",
      fix: "Keep only the last few hundred IDs, and only for recently active users; rebuild on demand for others.",
      nodes: ["timeline-cache"],
    },
    {
      problem: "Hot tweets (viral posts) create read hotspots",
      fix: "Cache hydrated tweet objects and counters; replicate hot keys across cache nodes.",
      nodes: ["tweet-store", "timeline-cache"],
    },
    {
      problem: "Central ID generation would limit write throughput",
      fix: "Snowflake IDs are generated independently on each machine from time + worker id + sequence.",
      nodes: ["tweet-svc"],
    },
  ],

  scaling: [
    "Shard tweets by tweetId and the per-author index by authorId.",
    "Partition the timeline cache by userId with consistent hashing; replicate for availability.",
    "Run fan-out as many parallel consumers on a partitioned event stream; lag only delays delivery.",
    "Read replicas for user data; stateless services autoscale behind load balancers.",
    "Multi-region deployment with data replicated asynchronously between regions.",
  ],

  extensions: [
    "Ranked ('For you') timelines scored by an ML model instead of pure recency.",
    "Notifications for mentions, likes and new followers.",
    "Direct messages over persistent connections.",
    "Spam and abuse detection on the event stream.",
  ],
};
