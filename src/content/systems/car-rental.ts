import type { SystemDesignInput } from "@/types/schema";

export const carRental: SystemDesignInput = {
  slug: "car-rental",
  name: "Car rental",
  tagline: "Reserve a car by class, pick up, drive, return",
  description:
    "Customers reserve a car class at a branch for a date range, not a specific car. Availability is fleet size minus overlapping reservations, cached per branch and class. A reservation holds capacity with a conditional update and places a deposit hold on the card. At pickup a specific vehicle is assigned; telematics report mileage and fuel, and the final charge is captured on return.",
  category: "mobility",
  difficulty: 2,
  concepts: ["distributed-locks", "idempotency", "caching", "event-driven"],

  requirements: {
    functional: [
      "Search cars by branch, dates and class with prices",
      "Reserve, modify and cancel",
      "Deposit hold at booking, final charge at return",
      "Assign a vehicle at pickup; record damage and mileage",
      "Fleet management: maintenance, transfers between branches",
    ],
    nonFunctional: [
      "No overbooking a class at a branch beyond policy",
      "Payments exactly-once, deposits always released",
      "Accurate availability during peak travel seasons",
    ],
  },

  apis: [
    { method: "GET", path: "/availability?branch=&from=&to=", purpose: "Car classes available with prices" },
    { method: "POST", path: "/reservations", purpose: "Reserve a class (Idempotency-Key); places a deposit hold" },
    { method: "POST", path: "/reservations/{id}/pickup", purpose: "Assign a vehicle, record odometer and fuel" },
    { method: "POST", path: "/reservations/{id}/return", purpose: "Record return, compute final charge" },
  ],

  estimates: [
    { label: "Fleet", value: "≈ 200 k vehicles", derivation: "Assumption across ~2,000 branches" },
    { label: "Reservations", value: "≈ 100 k/day", derivation: "Assumption; ~1/s average" },
    { label: "Availability searches", value: "≈ 50× reservations", derivation: "Browsing and price comparison" },
    { label: "Telematics", value: "≈ 2–3 k msgs/s", derivation: "200 k vehicles × one update per minute while driving" },
  ],

  dataModel: [
    {
      entity: "Class inventory",
      store: "Relational DB",
      key: "branchId + carClass + date",
      fields: ["fleetCount", "reserved", "version"],
      why: "Conditional increments keep reservations within fleet size",
    },
    {
      entity: "Reservation",
      store: "Relational DB",
      key: "reservationId",
      fields: ["customerId", "branchId", "carClass", "from", "to", "status", "depositAuthId", "vehicleId"],
      why: "Lifecycle from booking to return",
    },
    {
      entity: "Vehicle",
      store: "Relational DB",
      key: "vehicleId",
      fields: ["branchId", "class", "status", "odometer", "nextService"],
      why: "Fleet state for assignment and maintenance",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web", role: "Search and reserve" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Reserve, digital key, receipts" },
    { id: "counter", kind: "web-client", label: "Branch counter app", role: "Pickup and return by staff" },
    { id: "vehicles", kind: "mobile-client", label: "Vehicle telematics", role: "Reports location, mileage and fuel" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth and routing" },
    { id: "search-svc", kind: "service", label: "Availability search", role: "Classes and prices per branch and dates" },
    { id: "availability-cache", kind: "cache", label: "Availability cache", role: "Remaining capacity per branch, class and day" },
    { id: "pricing", kind: "service", label: "Pricing", role: "Rates by season, demand and duration" },
    { id: "reservation-svc", kind: "service", label: "Reservation service", role: "Holds capacity and manages the rental lifecycle" },
    { id: "fleet-svc", kind: "service", label: "Fleet service", role: "Vehicles, assignment, maintenance" },
    { id: "main-db", kind: "relational-db", label: "Inventory, reservations & fleet", role: "Source of truth" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Deposit holds and final charges" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Card authorisation and capture" },
    { id: "telemetry", kind: "event-stream", label: "Telematics stream", role: "Vehicle updates" },
    { id: "notify", kind: "notifications", label: "Email & SMS", role: "Confirmations and receipts" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "counter-gateway", from: "counter", to: "gateway" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-cache", from: "search-svc", to: "availability-cache" },
    { id: "search-pricing", from: "search-svc", to: "pricing", protocol: "grpc" },
    { id: "gateway-reservation", from: "gateway", to: "reservation-svc", protocol: "grpc" },
    { id: "reservation-db", from: "reservation-svc", to: "main-db", label: "Conditional hold" },
    { id: "reservation-cache", from: "reservation-svc", to: "availability-cache", label: "Update remaining" },
    { id: "reservation-payment", from: "reservation-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "reservation-fleet", from: "reservation-svc", to: "fleet-svc", label: "Assign vehicle", protocol: "grpc" },
    { id: "fleet-db", from: "fleet-svc", to: "main-db" },
    { id: "vehicles-telemetry", from: "vehicles", to: "telemetry", protocol: "stream" },
    { id: "telemetry-fleet", from: "telemetry", to: "fleet-svc", protocol: "async" },
    { id: "reservation-notify", from: "reservation-svc", to: "notify" },
  ],

  flows: [
    {
      id: "reserve",
      name: "Reserve a car",
      steps: [
        { edge: "web-gateway", text: "The customer searches the airport branch for 5 days." },
        { edge: "gateway-search", text: "Availability search handles it." },
        { edge: "search-cache", text: "Remaining capacity per class comes from cache." },
        { edge: "search-pricing", text: "Prices are computed for the dates." },
        { edge: "gateway-reservation", text: "The customer reserves an SUV." },
        { edge: "reservation-db", text: "Each day's counter for SUV at that branch is incremented — only if it stays within fleet size." },
        { edge: "reservation-payment", text: "A deposit hold is placed on the card." },
        { edge: "payment-psp", text: "The card issuer authorises it." },
        { edge: "reservation-cache", text: "Cached availability is updated." },
        { edge: "reservation-notify", text: "A confirmation is sent." },
      ],
    },
    {
      id: "return",
      name: "Pickup and return",
      steps: [
        { edge: "counter-gateway", text: "At pickup, staff open the reservation." },
        { edge: "gateway-reservation", text: "The reservation service loads the booking and checks the customer's licence." },
        { edge: "reservation-fleet", text: "A specific clean, serviced SUV is assigned." },
        { edge: "vehicles-telemetry", text: "During the rental the car reports mileage and fuel." },
        { edge: "telemetry-fleet", text: "Fleet records the readings." },
        { edge: "reservation-payment", text: "On return the final amount (extra days, fuel, damage) is captured and the rest of the deposit released." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Overbooking a class at busy branches",
      fix: "Per-day counters with conditional updates; optional small overbooking buffer based on no-show rates.",
      nodes: ["reservation-svc", "main-db"],
    },
    {
      problem: "Stale availability in cache",
      fix: "Update cache on every reservation and recheck the database at booking time.",
      nodes: ["availability-cache"],
    },
    {
      problem: "Deposits never released",
      fix: "A reconciler that voids holds for cancelled or completed rentals.",
      nodes: ["payment-svc"],
    },
  ],

  scaling: [
    "Partition inventory and reservations by region or branch.",
    "Cache availability and prices per branch.",
    "Process telematics asynchronously.",
  ],

  extensions: [
    "Digital keys and contactless pickup.",
    "One-way rentals with fleet rebalancing.",
    "Damage detection from photos.",
  ],
};
