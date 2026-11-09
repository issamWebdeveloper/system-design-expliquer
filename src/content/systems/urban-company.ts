import type { SystemDesignInput } from "@/types/schema";

export const urbanCompany: SystemDesignInput = {
  slug: "urban-company",
  name: "Urban Company",
  tagline: "Book vetted professionals for home services",
  description:
    "Customers book a service for a time slot, not a person. Slot availability is computed from the schedules of nearby professionals with the right skill. Picking a slot places a short hold, payment confirms it, and an assignment service then picks the best professional by distance, rating and workload. On the day, the professional checks in and out through their app, and payouts follow completion.",
  category: "bookings",
  difficulty: 2,
  concepts: ["distributed-locks", "geospatial-indexing", "idempotency", "event-driven"],

  requirements: {
    functional: [
      "Browse services (cleaning, salon, repairs) with prices",
      "See available slots for your address and book one",
      "Assign a qualified professional nearby",
      "Track job status; pay online or after service",
      "Ratings, rework requests, professional payouts",
    ],
    nonFunctional: [
      "Never promise a slot nobody can serve",
      "Assignment within minutes of booking",
      "Professionals' schedules stay consistent",
    ],
  },

  apis: [
    { method: "GET", path: "/services?city=", purpose: "Catalogue with prices" },
    { method: "GET", path: "/slots?serviceId=&lat=&lng=&date=", purpose: "Bookable slots at this address" },
    { method: "POST", path: "/slot-holds", purpose: "Hold a slot for a few minutes" },
    { method: "POST", path: "/bookings", purpose: "Confirm a held slot (Idempotency-Key)" },
    { method: "POST", path: "/jobs/{id}/status", purpose: "Professional: on the way, started, completed" },
  ],

  estimates: [
    { label: "Bookings", value: "≈ 100 k/day", derivation: "Assumption" },
    { label: "Professionals", value: "≈ 50 k", derivation: "Assumption across cities" },
    { label: "Slot queries", value: "≈ 20× bookings", derivation: "Customers compare days and times" },
    { label: "Schedule rows", value: "≈ 50 k × 14 days × ~16 slots", derivation: "≈ 11 M slot-cells kept two weeks ahead" },
  ],

  dataModel: [
    {
      entity: "Professional schedule",
      store: "Relational DB",
      key: "proId + date + slot",
      fields: ["status (free/held/booked)", "bookingId"],
      why: "Conditional updates prevent double assignment",
    },
    {
      entity: "Slot capacity",
      store: "In-memory cache",
      key: "city zone + skill + date + slot",
      fields: ["available", "held"],
      why: "Quick 'can we serve this slot?' answers for customers",
    },
    {
      entity: "Booking",
      store: "Relational DB",
      key: "bookingId",
      fields: ["customerId", "serviceId", "address", "slot", "proId", "status", "paymentId"],
      why: "Lifecycle and money",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "Customer app", role: "Book and track services" },
    { id: "pro", kind: "mobile-client", label: "Professional app", role: "Jobs, navigation, check-in/out, earnings" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth and routing" },
    { id: "catalog-svc", kind: "service", label: "Catalogue service", role: "Services, prices, offers" },
    { id: "slot-svc", kind: "service", label: "Slot service", role: "Computes available slots and places holds" },
    { id: "slot-cache", kind: "cache", label: "Slot capacity & holds", role: "Capacity per zone and short-lived holds" },
    { id: "booking-svc", kind: "service", label: "Booking service", role: "Confirms bookings and tracks jobs" },
    { id: "assignment", kind: "service", label: "Assignment service", role: "Chooses the professional" },
    { id: "pro-geo", kind: "cache", label: "Professional locations", role: "Home bases and live positions by cell" },
    { id: "main-db", kind: "relational-db", label: "Bookings & schedules", role: "Source of truth" },
    { id: "payment-svc", kind: "service", label: "Payments & payouts", role: "Customer charges, professional payouts" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards" },
    { id: "events", kind: "event-stream", label: "Booking events", role: "Confirmed, assigned, completed" },
    { id: "notify", kind: "notifications", label: "Push & SMS", role: "Confirmations and arrival alerts" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "pro-gateway", from: "pro", to: "gateway" },
    { id: "gateway-catalog", from: "gateway", to: "catalog-svc", protocol: "grpc" },
    { id: "gateway-slots", from: "gateway", to: "slot-svc", protocol: "grpc" },
    { id: "slots-cache", from: "slot-svc", to: "slot-cache", label: "Capacity / hold" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db", from: "booking-svc", to: "main-db" },
    { id: "booking-events", from: "booking-svc", to: "events", protocol: "stream" },
    { id: "events-assignment", from: "events", to: "assignment", protocol: "async" },
    { id: "assignment-geo", from: "assignment", to: "pro-geo", label: "Nearby, skilled, free" },
    { id: "assignment-db", from: "assignment", to: "main-db", label: "Book pro's slot" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
    { id: "events-payout", from: "events", to: "payment-svc", label: "Completed → payout", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Book a service",
      steps: [
        { edge: "customer-gateway", text: "The customer picks 'deep cleaning' for Saturday." },
        { edge: "gateway-slots", text: "The slot service checks capacity for that zone and skill." },
        { edge: "slots-cache", text: "The 10am slot has capacity; a hold is placed for 10 minutes." },
        { edge: "gateway-booking", text: "The customer confirms." },
        { edge: "booking-db", text: "The booking is saved as PENDING against the held slot." },
        { edge: "booking-payment", text: "Payment is taken (or marked pay-after-service) and the booking is confirmed." },
        { edge: "booking-events", text: "'Booking confirmed' is published." },
        { edge: "events-assignment", text: "The assignment service picks it up." },
        { edge: "assignment-geo", text: "It shortlists nearby professionals with the skill and a free 10am." },
        { edge: "assignment-db", text: "It books the best one's slot with a conditional update." },
        { edge: "events-notify", text: "Customer and professional are notified." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Showing slots that can't actually be served",
      fix: "Compute capacity from real schedules per zone and skill; hold capacity during checkout.",
      nodes: ["slot-svc", "slot-cache"],
    },
    {
      problem: "Two bookings assigned the same professional",
      fix: "Conditional update on the professional's slot row; retry with the next candidate.",
      nodes: ["assignment", "main-db"],
    },
    {
      problem: "No-shows and late arrivals",
      fix: "Live location on the job day and automatic reassignment when a professional is running late.",
      nodes: ["assignment", "pro-geo"],
    },
  ],

  scaling: [
    "Partition by city; capacity and assignment are local.",
    "Rebuild slot capacity incrementally as schedules change.",
    "Asynchronous assignment so checkout stays fast.",
  ],

  extensions: [
    "Subscriptions for recurring services.",
    "Product sales (water purifiers, tools).",
    "Training and quality scoring for professionals.",
  ],
};
