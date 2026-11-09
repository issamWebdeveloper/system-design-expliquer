import type { SystemDesignInput } from "@/types/schema";

export const airbnb: SystemDesignInput = {
  slug: "airbnb",
  name: "Airbnb",
  tagline: "Search, book and message for vacation rentals",
  description:
    "Search combines a geo-aware index of listings with each listing's availability calendar, so results only show places free on your dates. Booking reserves those nights with a conditional write on the calendar, authorises payment, and pays the host after check-in. Guests and hosts message in real time, and photos are served from a CDN.",
  category: "bookings",
  difficulty: 3,
  concepts: ["geospatial-indexing", "search-indexing", "distributed-locks", "idempotency", "caching", "presigned-urls"],

  requirements: {
    functional: [
      "Hosts create listings with photos, prices, rules and an availability calendar",
      "Guests search by location, dates, guests, price and amenities, on a map",
      "Instant book or request-to-book with host approval",
      "Payments held until check-in, then paid out to the host",
      "Guest–host messaging and two-way reviews",
    ],
    nonFunctional: [
      "Never double-book the same nights",
      "Search returns in under a second",
      "Highly available for browsing; booking can be strictly consistent",
      "Payments and payouts in many currencies",
    ],
  },

  apis: [
    { method: "GET", path: "/search?bbox=&checkIn=&checkOut=&guests=&filters=", purpose: "Available listings in a map area" },
    { method: "GET", path: "/listings/{id}", purpose: "Listing details, photos, rules, price for dates" },
    { method: "POST", path: "/reservations", purpose: "Reserve dates (Idempotency-Key); instant or pending host approval" },
    { method: "PUT", path: "/listings/{id}/calendar", purpose: "Host blocks dates or changes prices" },
    { method: "WS", path: "/messages", purpose: "Real-time guest–host messages" },
  ],

  estimates: [
    { label: "Listings", value: "≈ 7 M", derivation: "Assumption based on public figures" },
    { label: "Searches", value: "≈ 2–5 k/s peak", derivation: "Read-heavy browsing" },
    { label: "Calendar nights", value: "≈ 2.5 B rows", derivation: "7 M listings × 365 days ahead" },
    { label: "Bookings", value: "≈ 1–2 M/day", derivation: "Assumption; ~20/s average" },
  ],

  dataModel: [
    {
      entity: "Listing",
      store: "Relational DB + search index",
      key: "listingId",
      fields: ["hostId", "location", "type", "amenities", "basePrice", "rules", "photoUrls"],
      why: "Edited by hosts, searched by guests",
    },
    {
      entity: "Calendar night",
      store: "Relational DB, sharded by listingId",
      key: "listingId + date",
      fields: ["status (open/blocked/booked)", "price", "reservationId"],
      why: "Booking = conditional update of a range of nights in one transaction",
    },
    {
      entity: "Reservation",
      store: "Relational DB",
      key: "reservationId",
      fields: ["guestId", "listingId", "dates", "total", "status", "paymentId"],
      why: "Money and dates must agree",
    },
    {
      entity: "Message",
      store: "Wide-column DB",
      key: "threadId + time",
      fields: ["senderId", "text"],
      why: "Append-heavy, read per thread",
    },
  ],

  nodes: [
    { id: "guest", kind: "web-client", label: "Guest web / app", role: "Search, book, message" },
    { id: "host", kind: "mobile-client", label: "Host app", role: "Manage listings, calendar, requests" },
    { id: "cdn", kind: "cdn", label: "Photo CDN", role: "Listing photos in many sizes" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits, routing" },
    { id: "search-svc", kind: "service", label: "Search service", role: "Geo + filter query, then availability check and ranking" },
    { id: "listing-index", kind: "search", label: "Listing index", role: "Listings with geo point and amenities" },
    { id: "ranking", kind: "ml-platform", label: "Ranking & pricing models", role: "Orders results; suggests prices to hosts" },
    { id: "listing-svc", kind: "service", label: "Listing service", role: "Listing CRUD and photo uploads" },
    { id: "availability-svc", kind: "service", label: "Availability service", role: "Calendars and date reservations" },
    { id: "booking-svc", kind: "service", label: "Booking service", role: "Reservation lifecycle" },
    { id: "payment-svc", kind: "service", label: "Payments & payouts", role: "Authorise at booking, capture, pay hosts after check-in" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Cards and payouts in many currencies" },
    { id: "messaging", kind: "realtime-gateway", label: "Messaging", role: "Guest–host chat" },
    { id: "main-db", kind: "relational-db", label: "Listings, calendars & reservations", role: "Sharded by listing" },
    { id: "photos", kind: "object-storage", label: "Photos", role: "Original and resized images" },
    { id: "events", kind: "event-stream", label: "Marketplace events", role: "Listing changes, bookings" },
    { id: "notify", kind: "notifications", label: "Email & push", role: "Booking confirmations and reminders" },
  ],

  edges: [
    { id: "guest-cdn", from: "guest", to: "cdn", label: "Photos" },
    { id: "cdn-photos", from: "cdn", to: "photos" },
    { id: "guest-gateway", from: "guest", to: "gateway" },
    { id: "host-gateway", from: "host", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index", from: "search-svc", to: "listing-index", label: "Geo + filters" },
    { id: "search-availability", from: "search-svc", to: "availability-svc", label: "Free on these dates?", protocol: "grpc" },
    { id: "search-ranking", from: "search-svc", to: "ranking" },
    { id: "gateway-listing", from: "gateway", to: "listing-svc", protocol: "grpc" },
    { id: "listing-db", from: "listing-svc", to: "main-db" },
    { id: "host-photos", from: "host", to: "photos", label: "Upload (pre-signed)" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-availability", from: "booking-svc", to: "availability-svc", label: "Reserve nights", protocol: "grpc" },
    { id: "availability-db", from: "availability-svc", to: "main-db" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "listing-events", from: "listing-svc", to: "events", protocol: "stream" },
    { id: "events-index", from: "events", to: "listing-index", label: "Reindex", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "guest-messaging", from: "guest", to: "messaging", protocol: "ws" },
    { id: "host-messaging", from: "host", to: "messaging", protocol: "ws" },
  ],

  flows: [
    {
      id: "search",
      name: "Search stays",
      steps: [
        { edge: "guest-gateway", text: "The guest searches a map area for 3 nights." },
        { edge: "gateway-search", text: "The search service runs the query." },
        { edge: "search-index", text: "The index returns listings inside the map box that match filters." },
        { edge: "search-availability", text: "Candidates are checked against calendars for those exact nights." },
        { edge: "search-ranking", text: "Available listings are ranked by relevance, quality and price." },
        { edge: "guest-cdn", text: "Photos load from the CDN." },
      ],
    },
    {
      id: "book",
      name: "Instant book",
      steps: [
        { edge: "guest-gateway", text: "The guest books with an idempotency key." },
        { edge: "gateway-booking", text: "The booking service starts the reservation." },
        { edge: "booking-availability", text: "Availability reserves the nights." },
        { edge: "availability-db", text: "All nights flip from open to booked in one transaction — only if every one is still open." },
        { edge: "booking-payment", text: "The payment is authorised (captured at check-in)." },
        { edge: "payment-psp", text: "The card is authorised." },
        { edge: "booking-events", text: "'Reservation confirmed' is published." },
        { edge: "events-notify", text: "Guest and host get confirmations." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Combining geo search with date availability",
      fix: "Filter by location in the index, then batch-check calendars for the top candidates; keep a coarse 'available' flag in the index for speed.",
      nodes: ["search-svc", "listing-index", "availability-svc"],
    },
    {
      problem: "Two guests booking the same dates",
      fix: "Conditional update over the whole date range inside one transaction on the listing's shard.",
      nodes: ["availability-svc", "main-db"],
    },
    {
      problem: "Large photo volumes",
      fix: "Direct uploads, async resizing, and CDN delivery with modern formats.",
      nodes: ["photos", "cdn"],
    },
  ],

  scaling: [
    "Shard listings, calendars and reservations by listingId so a booking stays on one shard.",
    "Replicate the search index per region.",
    "Keep messaging on its own real-time tier.",
  ],

  extensions: [
    "Experiences and activities alongside stays.",
    "Smart pricing suggestions for hosts.",
    "Trust and safety: identity verification and fraud scoring.",
  ],
};
