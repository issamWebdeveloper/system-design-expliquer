import type { SystemDesignInput } from "@/types/schema";

export const bookmyshow: SystemDesignInput = {
  slug: "bookmyshow",
  name: "BookMyShow",
  tagline: "Movie and event tickets with live seat selection",
  description:
    "Browsing shows is a cached, search-driven read path. The hard part is the seat map: when you pick seats they are held for a few minutes with a short-lived lock, so nobody else can take them while you pay. Payment confirms the booking in one database transaction; if you walk away, the hold expires and the seats return. For blockbuster openings a virtual waiting room meters people into the booking flow.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "caching", "back-pressure", "search-indexing"],

  requirements: {
    functional: [
      "Browse movies and events by city, date, language and venue",
      "See a live seat map and pick specific seats",
      "Hold seats while paying; release them if payment doesn't finish",
      "Pay and receive an e-ticket (QR code)",
      "Cancel and refund within the venue's policy",
    ],
    nonFunctional: [
      "Never sell the same seat twice",
      "Handle premiere spikes (hundreds of thousands of concurrent users)",
      "Seat maps reflect holds within seconds",
      "Payments are exactly-once",
    ],
  },

  apis: [
    { method: "GET", path: "/cities/{city}/shows?date=&movieId=", purpose: "Shows by venue and time" },
    { method: "GET", path: "/shows/{showId}/seats", purpose: "Seat map with available, held and booked seats" },
    { method: "POST", path: "/shows/{showId}/holds", purpose: "Hold seats for ~8 minutes; fails if any is taken" },
    { method: "POST", path: "/bookings", purpose: "Confirm a hold after payment (idempotent)" },
    { method: "DELETE", path: "/bookings/{bookingId}", purpose: "Cancel and refund" },
  ],

  estimates: [
    { label: "Peak concurrency", value: "≈ 250 k users", derivation: "Reported for big premieres" },
    { label: "Peak requests", value: "≈ 11 k/s", derivation: "650 k requests per minute ÷ 60" },
    { label: "Tickets", value: "≈ 1 M/day", derivation: "Assumption; ~12/s average, far higher on opening days" },
    { label: "Seats tracked", value: "≈ 50 M/day", derivation: "~10 k screens × 5 shows × ~1,000 seats (incl. events)" },
  ],

  dataModel: [
    {
      entity: "Show seat",
      store: "Relational DB",
      key: "showId + seatId",
      fields: ["status (free/booked)", "bookingId", "price"],
      why: "Unique constraint makes double-booking impossible at the database level",
    },
    {
      entity: "Seat hold",
      store: "In-memory cache with TTL",
      key: "showId + seatId",
      fields: ["holdId", "userId", "expiresAt"],
      why: "Fast temporary locks that expire on their own",
    },
    {
      entity: "Booking",
      store: "Relational DB",
      key: "bookingId",
      fields: ["userId", "showId", "seats", "amount", "status", "paymentId", "idempotencyKey"],
      why: "Transactional record of money and seats",
    },
    {
      entity: "Movie / Show",
      store: "Relational DB + search index",
      key: "showId",
      fields: ["movieId", "venueId", "screen", "startsAt", "language", "format"],
      why: "Browsed constantly; cached and indexed",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Browse and book" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Browse, book and show tickets" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Posters, trailers and static pages" },
    { id: "waiting-room", kind: "message-queue", label: "Virtual waiting room", role: "Admits users to booking at a safe rate during spikes" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limiting, routing" },
    { id: "catalog-svc", kind: "service", label: "Catalogue service", role: "Movies, venues and show times" },
    { id: "search-index", kind: "search", label: "Search index", role: "Movies, events and venues" },
    { id: "seat-svc", kind: "service", label: "Seat service", role: "Seat maps and holds" },
    { id: "holds", kind: "cache", label: "Seat holds", role: "Short-lived locks per seat (TTL)" },
    { id: "booking-svc", kind: "service", label: "Booking service", role: "Turns a paid hold into a booking" },
    { id: "booking-db", kind: "relational-db", label: "Bookings & seats", role: "Source of truth for sold seats" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Charges and refunds idempotently" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Cards, UPI, wallets" },
    { id: "venues", kind: "partner-api", label: "Venue box office", role: "Some cinemas keep their own ticketing system" },
    { id: "events", kind: "event-stream", label: "Booking events", role: "Confirmed, cancelled" },
    { id: "notify", kind: "notifications", label: "Tickets & alerts", role: "E-tickets by SMS, email and push" },
  ],

  edges: [
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "mobile-cdn", from: "mobile", to: "cdn" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-waiting", from: "gateway", to: "waiting-room", label: "Spike mode", protocol: "async" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "catalog-search", from: "catalog-svc", to: "search-index" },
    { id: "gateway-seats", from: "gateway", to: "seat-svc", protocol: "grpc" },
    { id: "seats-holds", from: "seat-svc", to: "holds", label: "SET NX + TTL" },
    { id: "seats-db", from: "seat-svc", to: "booking-db", label: "Booked seats" },
    { id: "seats-venue", from: "seat-svc", to: "venues", label: "Sync seat status" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db-write", from: "booking-svc", to: "booking-db", label: "Confirm" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Book seats",
      steps: [
        { edge: "mobile-gateway", text: "The user picks a show." },
        { edge: "gateway-seats", text: "The seat service builds the seat map." },
        { edge: "seats-db", text: "Booked seats come from the database…" },
        { edge: "seats-holds", text: "…and seats currently held by others from the cache. The user picks two seats and each is locked with SET NX for 8 minutes — all or nothing." },
        { edge: "gateway-booking", text: "The user pays." },
        { edge: "booking-payment", text: "The booking service charges using the hold id as the idempotency key." },
        { edge: "payment-psp", text: "The payment provider approves." },
        { edge: "booking-db-write", text: "Seats are marked booked in one transaction; a unique constraint is the final guard against double-selling." },
        { edge: "booking-events", text: "A 'booking confirmed' event is published." },
        { edge: "events-notify", text: "The e-ticket is sent." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Thousands of people want the same seats at the same second",
      fix: "Atomic per-seat holds in an in-memory store with TTL, plus a unique constraint in the database as the last line of defence.",
      nodes: ["holds", "booking-db"],
    },
    {
      problem: "Premiere traffic spikes",
      fix: "A virtual waiting room admits users at a sustainable rate; browsing stays on cache and CDN.",
      nodes: ["waiting-room", "cdn", "catalog-svc"],
    },
    {
      problem: "Payment succeeds but confirmation fails",
      fix: "Idempotent confirm keyed by hold id; a reconciler refunds or completes orphaned payments.",
      nodes: ["booking-svc", "payment-svc"],
    },
  ],

  scaling: [
    "Shard seats and bookings by city or venue; most traffic is local.",
    "Cache show listings per city with short TTLs.",
    "Scale seat and booking services independently from browsing.",
  ],

  extensions: [
    "Live seat-map updates over WebSockets.",
    "Dynamic pricing for high-demand shows.",
    "Food and beverage add-ons in the same order.",
  ],
};
