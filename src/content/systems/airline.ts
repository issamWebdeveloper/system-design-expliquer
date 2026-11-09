import type { SystemDesignInput } from "@/types/schema";

export const airline: SystemDesignInput = {
  slug: "airline",
  name: "Airline reservations",
  tagline: "Flights, seats, bookings and check-in for one airline",
  description:
    "The airline owns its inventory: every flight has a fixed number of seats per fare class. A booking decrements that count with an optimistic concurrency check, creates a passenger record (PNR), takes payment and issues a ticket. Operations events — delays, gate changes, cancellations — flow through an event stream to notify passengers and rebook them.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "event-driven", "websockets"],

  requirements: {
    functional: [
      "Search flights and fares; book one-way, return and multi-city trips",
      "Choose seats, add bags and meals",
      "Manage bookings: change, cancel, refund",
      "Online check-in and boarding passes",
      "Flight status updates and automatic rebooking on cancellations",
    ],
    nonFunctional: [
      "No overbooking beyond the airline's chosen limit",
      "Bookings and payments are exactly-once",
      "Highly available — check-in can't go down at the airport",
      "Sell through travel agents and GDSs as well as direct channels",
    ],
  },

  apis: [
    { method: "GET", path: "/flights?from=&to=&date=", purpose: "Flights with fares per class" },
    { method: "POST", path: "/bookings", purpose: "Create a PNR for passengers and segments (Idempotency-Key)" },
    { method: "PUT", path: "/bookings/{pnr}/seats", purpose: "Assign seats" },
    { method: "POST", path: "/bookings/{pnr}/checkin", purpose: "Check in and get boarding passes" },
    { method: "GET", path: "/flights/{flightId}/status", purpose: "Live status, gate and delay" },
  ],

  estimates: [
    { label: "Passengers", value: "≈ 500 k/day", derivation: "Reported scale for a large carrier" },
    { label: "Flights", value: "≈ 3–5 k/day", derivation: "Assumption" },
    { label: "Bookings", value: "≈ 6/s avg", derivation: "500 k passengers ÷ ~1 booking per passenger ÷ 86,400 s; sales spikes 20×" },
    { label: "Searches", value: "≈ 100× bookings", derivation: "High look-to-book ratio, mostly from agents and GDSs" },
  ],

  dataModel: [
    {
      entity: "Fare inventory",
      store: "Relational DB",
      key: "flightId + fareClass",
      fields: ["capacity", "sold", "price", "version"],
      why: "UPDATE … SET sold = sold + n WHERE sold + n ≤ capacity AND version = v prevents overselling",
    },
    {
      entity: "PNR (booking)",
      store: "Relational DB",
      key: "pnr",
      fields: ["passengers", "segments", "status", "ticketNumbers", "paymentId"],
      why: "Industry-standard record that every channel references",
    },
    {
      entity: "Seat assignment",
      store: "Relational DB",
      key: "flightId + seatNo",
      fields: ["pnr", "passengerId"],
      why: "Unique per seat per flight",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Website", role: "Direct bookings" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Bookings, check-in, boarding pass" },
    { id: "agents", kind: "web-client", label: "Airport & agent apps", role: "Staff tools at counters and gates" },
    { id: "gds", kind: "partner-api", label: "GDS / travel agents", role: "Indirect sales channels" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits, routing" },
    { id: "inventory-svc", kind: "service", label: "Flights & inventory", role: "Schedules and seats per fare class" },
    { id: "booking-svc", kind: "service", label: "Reservations (PNR)", role: "Creates and changes bookings" },
    { id: "checkin-svc", kind: "service", label: "Check-in & boarding", role: "Seat maps, boarding passes, gate lists" },
    { id: "ops-svc", kind: "service", label: "Flight operations", role: "Status, delays, gates, aircraft swaps" },
    { id: "inventory-db", kind: "relational-db", label: "Inventory", role: "Seats sold per flight and class" },
    { id: "pnr-db", kind: "relational-db", label: "Bookings", role: "PNRs, tickets and seats" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Charges and refunds" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Card processing" },
    { id: "events", kind: "event-stream", label: "Ops & booking events", role: "Delays, cancellations, bookings" },
    { id: "status", kind: "realtime-gateway", label: "Live status", role: "Pushes flight status to apps" },
    { id: "notify", kind: "notifications", label: "SMS, email, push", role: "Confirmations and disruption alerts" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "agents-gateway", from: "agents", to: "gateway" },
    { id: "gds-gateway", from: "gds", to: "gateway", label: "Availability & sell" },
    { id: "gateway-inventory", from: "gateway", to: "inventory-svc", protocol: "grpc" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "gateway-checkin", from: "gateway", to: "checkin-svc", protocol: "grpc" },
    { id: "inventory-db-rw", from: "inventory-svc", to: "inventory-db" },
    { id: "booking-inventory", from: "booking-svc", to: "inventory-svc", label: "Decrement seats", protocol: "grpc" },
    { id: "booking-pnr", from: "booking-svc", to: "pnr-db" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "checkin-pnr", from: "checkin-svc", to: "pnr-db" },
    { id: "ops-events", from: "ops-svc", to: "events", label: "Delay / cancel", protocol: "stream" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-status", from: "events", to: "status", protocol: "async" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "events-rebook", from: "events", to: "booking-svc", label: "Auto-rebook", protocol: "async" },
    { id: "mobile-status", from: "mobile", to: "status", protocol: "ws" },
  ],

  flows: [
    {
      id: "book",
      name: "Book a flight",
      steps: [
        { edge: "web-gateway", text: "The passenger picks a flight and fare." },
        { edge: "gateway-booking", text: "The reservation service starts a booking." },
        { edge: "booking-inventory", text: "It asks inventory to sell one seat in this fare class." },
        { edge: "inventory-db-rw", text: "A conditional update succeeds only if seats remain and nobody changed the row meanwhile; otherwise it retries or fails." },
        { edge: "booking-pnr", text: "A PNR is created with the passengers and segments." },
        { edge: "booking-payment", text: "Payment is taken, keyed by the PNR. If it fails, the seat is released back to inventory." },
        { edge: "payment-psp", text: "The card is charged and a ticket number is issued." },
        { edge: "booking-events", text: "A booking event is published." },
        { edge: "events-notify", text: "The e-ticket is emailed." },
      ],
    },
    {
      id: "disruption",
      name: "Flight cancelled",
      steps: [
        { edge: "ops-events", text: "Operations cancels a flight." },
        { edge: "events-rebook", text: "Reservations rebooks affected passengers onto the next available flights." },
        { edge: "events-status", text: "Live status updates are pushed…" },
        { edge: "mobile-status", text: "…to every connected app." },
        { edge: "events-notify", text: "Passengers get SMS and email with their new itinerary." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Concurrent sales of the last seats",
      fix: "Conditional updates with a version column on fare inventory; small controlled overbooking if policy allows.",
      nodes: ["inventory-svc", "inventory-db"],
    },
    {
      problem: "GDS search volume dwarfs bookings",
      fix: "Serve availability from a cache that is refreshed on every sale; rate-limit channels.",
      nodes: ["gds", "inventory-svc"],
    },
    {
      problem: "Mass disruption creates thousands of rebookings at once",
      fix: "Process rebookings from a queue by priority (connections, status) rather than inline.",
      nodes: ["events", "booking-svc"],
    },
  ],

  scaling: [
    "Partition inventory by flight and date.",
    "Read replicas for search and status; the primary handles sales.",
    "Keep check-in available with its own replicas at the airport region.",
  ],

  extensions: [
    "Loyalty programme with miles and upgrades.",
    "Dynamic pricing per fare class.",
    "Crew and aircraft scheduling.",
  ],
};
