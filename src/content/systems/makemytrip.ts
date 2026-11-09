import type { SystemDesignInput } from "@/types/schema";

export const makemytrip: SystemDesignInput = {
  slug: "makemytrip",
  name: "MakeMyTrip",
  tagline: "Flights and hotels aggregated from many suppliers",
  description:
    "The platform owns little inventory: flights and hotels live in airline systems, GDSs and hotel channel managers. Searches fan out to these suppliers in parallel, and results are cached briefly because supplier calls are slow and expensive. Booking a trip is a saga — hold with the supplier, take payment, then ticket — with compensating cancellations if any step fails.",
  category: "bookings",
  difficulty: 3,
  concepts: ["saga", "caching", "idempotency", "back-pressure", "search-indexing"],

  requirements: {
    functional: [
      "Search flights by route and date, and hotels by city and dates",
      "Filter and sort by price, time, rating and amenities",
      "Book flights and hotels, alone or as a package",
      "Pay, receive itineraries, cancel and get refunds",
    ],
    nonFunctional: [
      "Search results in a few seconds despite slow suppliers",
      "Prices shown must be re-validated before payment",
      "No booking without payment, no payment without booking",
      "Handle holiday-season spikes",
    ],
  },

  apis: [
    { method: "GET", path: "/flights/search?from=&to=&date=&pax=", purpose: "Aggregated flight options" },
    { method: "GET", path: "/hotels/search?city=&checkIn=&checkOut=", purpose: "Hotels with rates" },
    { method: "POST", path: "/itineraries/{id}/reprice", purpose: "Re-check price and availability with the supplier" },
    { method: "POST", path: "/bookings", purpose: "Book an itinerary (Idempotency-Key)" },
    { method: "POST", path: "/bookings/{id}/cancel", purpose: "Cancel and refund per fare rules" },
  ],

  estimates: [
    { label: "Monthly users", value: "≈ 10 M", derivation: "Assumption" },
    { label: "Searches", value: "≈ 1–3 M/day", derivation: "Each session runs several searches; look-to-book ratio is very high" },
    { label: "Supplier calls", value: "10–20 per search", derivation: "Fan-out across airlines/GDSs before caching" },
    { label: "Bookings", value: "≈ 50–100 k/day", derivation: "Assumption from look-to-book ratios of ~1–3%" },
  ],

  dataModel: [
    {
      entity: "Booking",
      store: "Relational DB",
      key: "bookingId",
      fields: ["userId", "items[] (flight/hotel)", "status", "supplierRefs", "amount", "paymentId"],
      why: "Multi-step state machine with money attached",
    },
    {
      entity: "Fare cache entry",
      store: "In-memory cache",
      key: "route + date + pax",
      fields: ["offers[]", "fetchedAt"],
      why: "Cuts slow, rate-limited supplier calls; short TTL because prices change",
    },
    {
      entity: "Hotel",
      store: "Search index",
      key: "hotelId",
      fields: ["name", "location", "rating", "amenities", "minPrice"],
      why: "Static content searched with geo and facets",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Search and book" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Search, book and manage trips" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits, routing" },
    { id: "search-svc", kind: "service", label: "Search aggregator", role: "Fans out to suppliers and merges results" },
    { id: "fare-cache", kind: "cache", label: "Fare & rate cache", role: "Recent supplier answers with short TTLs" },
    { id: "hotel-index", kind: "search", label: "Hotel index", role: "Hotel content for filtering and ranking" },
    { id: "suppliers", kind: "partner-api", label: "Airlines, GDS, hotels", role: "The real inventory and prices" },
    { id: "booking-svc", kind: "service", label: "Booking service", role: "Creates bookings and tracks status" },
    { id: "saga", kind: "workflow", label: "Booking saga", role: "Hold → pay → ticket, with compensation" },
    { id: "booking-db", kind: "relational-db", label: "Bookings", role: "Bookings and their steps" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Authorise, capture, refund" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Cards, UPI, wallets" },
    { id: "events", kind: "event-stream", label: "Booking events", role: "Confirmed, failed, cancelled" },
    { id: "notify", kind: "notifications", label: "Itinerary & alerts", role: "Tickets, vouchers, schedule changes" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-cache", from: "search-svc", to: "fare-cache" },
    { id: "search-index", from: "search-svc", to: "hotel-index" },
    { id: "search-suppliers", from: "search-svc", to: "suppliers", label: "Parallel queries" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-db-write", from: "booking-svc", to: "booking-db" },
    { id: "booking-saga", from: "booking-svc", to: "saga", protocol: "async" },
    { id: "saga-suppliers", from: "saga", to: "suppliers", label: "Hold / ticket / cancel" },
    { id: "saga-payment", from: "saga", to: "payment-svc", label: "Pay / refund", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "saga-events", from: "saga", to: "events", protocol: "stream" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "search",
      name: "Search flights",
      steps: [
        { edge: "web-gateway", text: "The user searches Delhi → Mumbai for Friday." },
        { edge: "gateway-search", text: "The aggregator handles it." },
        { edge: "search-cache", text: "A recent identical search may already be cached for a few minutes." },
        { edge: "search-suppliers", text: "Otherwise it queries airlines and GDSs in parallel with a strict timeout, using whatever returns in time." },
      ],
    },
    {
      id: "book",
      name: "Book a trip",
      steps: [
        { edge: "gateway-booking", text: "The user books; the price is re-validated first." },
        { edge: "booking-db-write", text: "A booking is created as PENDING." },
        { edge: "booking-saga", text: "The booking saga starts." },
        { edge: "saga-suppliers", text: "Step 1: hold the seat or room with the supplier." },
        { edge: "saga-payment", text: "Step 2: take payment." },
        { edge: "payment-psp", text: "The payment provider approves." },
        { edge: "saga-suppliers", text: "Step 3: issue the ticket or voucher. If this fails, the saga refunds and releases the hold." },
        { edge: "saga-events", text: "The outcome is published." },
        { edge: "events-notify", text: "The itinerary is emailed." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Slow, rate-limited supplier APIs",
      fix: "Short-TTL caching, parallel calls with timeouts, and circuit breakers per supplier.",
      nodes: ["search-svc", "fare-cache", "suppliers"],
    },
    {
      problem: "Price changes between search and booking",
      fix: "Always reprice before payment and tell the user if it changed.",
      nodes: ["booking-svc", "suppliers"],
    },
    {
      problem: "Partial failures across supplier, payment and ticketing",
      fix: "A saga with idempotent steps and compensations, plus reconciliation for stuck bookings.",
      nodes: ["saga", "payment-svc"],
    },
  ],

  scaling: [
    "Scale search aggregators horizontally; they're stateless.",
    "Shard bookings by bookingId and keep hot caches per region.",
    "Queue post-booking work (emails, loyalty, analytics) off the critical path.",
  ],

  extensions: [
    "Packages combining flight and hotel with one payment.",
    "Price alerts and fare predictions.",
    "Loyalty points and wallet.",
  ],
};
