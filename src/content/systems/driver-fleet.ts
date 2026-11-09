import type { SystemDesignInput } from "@/types/schema";

export const driverFleet: SystemDesignInput = {
  slug: "driver-fleet",
  name: "Driver booking & fleet management",
  tagline: "Hire a driver for your car, and run fleets of drivers and vehicles",
  description:
    "Customers book a verified driver by the hour or trip for their own car; fleet operators manage many drivers and vehicles from a dashboard. A dispatch service matches bookings to nearby available drivers, a real-time tier tracks shifts and trips, telematics stream vehicle health, and a payroll pipeline turns completed trips into driver payouts.",
  category: "mobility",
  difficulty: 2,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "sharding"],

  requirements: {
    functional: [
      "Book a driver now or for later, by hours, trip or outstation",
      "Driver onboarding with KYC and background checks",
      "Live tracking of driver and vehicle",
      "Fleet dashboards: shifts, utilisation, vehicle health, compliance",
      "Fares, invoices and weekly driver payouts",
    ],
    nonFunctional: [
      "Match in under a minute for on-demand bookings",
      "Location updates within seconds",
      "Driver documents stored securely",
    ],
  },

  apis: [
    { method: "POST", path: "/bookings", purpose: "{ type, start, pickup, durationHours } → booking" },
    { method: "WS", path: "/driver/socket", purpose: "Shift status, GPS, booking offers" },
    { method: "GET", path: "/fleet/{fleetId}/drivers?status=", purpose: "Fleet dashboard data" },
    { method: "POST", path: "/drivers", purpose: "Onboard a driver with documents" },
    { method: "GET", path: "/drivers/{id}/earnings", purpose: "Trips and payouts" },
  ],

  estimates: [
    { label: "Drivers", value: "≈ 200 k registered, 50 k online", derivation: "Assumption" },
    { label: "Bookings", value: "≈ 100 k/day", derivation: "Assumption" },
    { label: "GPS updates", value: "≈ 12 k/s", derivation: "50 k online drivers ÷ every 4 s" },
    { label: "Telematics", value: "≈ 5 k msgs/s", derivation: "Fleet vehicles reporting once a minute" },
  ],

  dataModel: [
    {
      entity: "Driver",
      store: "Relational DB",
      key: "driverId",
      fields: ["fleetId", "kycStatus", "licence", "rating", "skills (manual/automatic, outstation)"],
      why: "Profiles and compliance status",
    },
    {
      entity: "Booking / trip",
      store: "Relational DB, sharded by city",
      key: "bookingId",
      fields: ["customerId", "driverId", "start", "end", "fare", "status"],
      why: "Lifecycle and billing",
    },
    {
      entity: "Shift",
      store: "Relational DB",
      key: "driverId + date",
      fields: ["onlineAt", "offlineAt", "trips", "hours"],
      why: "Payroll and utilisation",
    },
    {
      entity: "Driver documents",
      store: "Object storage (encrypted)",
      key: "driverId/doc",
      fields: ["licence", "ID", "background check"],
      why: "Sensitive files with restricted access",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "Customer app", role: "Book a driver and track the trip" },
    { id: "driver", kind: "mobile-client", label: "Driver app", role: "Go online, accept bookings, stream GPS" },
    { id: "fleet", kind: "web-client", label: "Fleet dashboard", role: "Operators manage drivers and vehicles" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, roles, routing" },
    { id: "booking-svc", kind: "service", label: "Booking service", role: "Bookings and trip lifecycle" },
    { id: "dispatch", kind: "service", label: "Dispatch", role: "Matches bookings to available drivers" },
    { id: "rt", kind: "realtime-gateway", label: "Real-time gateway", role: "GPS, offers, live tracking" },
    { id: "geo-index", kind: "cache", label: "Driver geo index", role: "Online drivers by cell and skill" },
    { id: "driver-svc", kind: "service", label: "Driver management", role: "Onboarding, KYC, shifts, compliance" },
    { id: "documents", kind: "object-storage", label: "Driver documents", role: "Encrypted KYC files" },
    { id: "main-db", kind: "relational-db", label: "Drivers, bookings & shifts", role: "Source of truth" },
    { id: "telematics", kind: "event-stream", label: "Trip & telematics events", role: "Trips, GPS history, vehicle health" },
    { id: "payroll", kind: "batch-processing", label: "Payroll & payouts", role: "Weekly earnings calculation" },
    { id: "warehouse", kind: "data-warehouse", label: "Fleet analytics", role: "Utilisation and performance reports" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "Customer charges and driver payouts" },
    { id: "notify", kind: "notifications", label: "Push & SMS", role: "Booking and shift alerts" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "fleet-gateway", from: "fleet", to: "gateway" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "gateway-driver", from: "gateway", to: "driver-svc", protocol: "grpc" },
    { id: "booking-db", from: "booking-svc", to: "main-db" },
    { id: "booking-dispatch", from: "booking-svc", to: "dispatch", protocol: "grpc" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Nearby + skills" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Offer", protocol: "ws" },
    { id: "driver-rt", from: "driver", to: "rt", label: "GPS / status", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Track", protocol: "ws" },
    { id: "driver-svc-db", from: "driver-svc", to: "main-db" },
    { id: "driver-svc-docs", from: "driver-svc", to: "documents" },
    { id: "booking-events", from: "booking-svc", to: "telematics", protocol: "stream" },
    { id: "rt-events", from: "rt", to: "telematics", label: "GPS history", protocol: "stream" },
    { id: "events-payroll", from: "telematics", to: "payroll", protocol: "stream" },
    { id: "events-warehouse", from: "telematics", to: "warehouse", protocol: "stream" },
    { id: "payroll-psp", from: "payroll", to: "psp", label: "Payouts" },
    { id: "booking-notify", from: "booking-svc", to: "notify" },
  ],

  flows: [
    {
      id: "book",
      name: "Book a driver",
      steps: [
        { edge: "customer-gateway", text: "The customer books a driver for 4 hours, now." },
        { edge: "gateway-booking", text: "The booking service creates the booking." },
        { edge: "booking-db", text: "It's saved as SEARCHING." },
        { edge: "booking-dispatch", text: "Dispatch looks for a driver." },
        { edge: "dispatch-geo", text: "It filters online drivers nearby who can drive this car type." },
        { edge: "dispatch-rt", text: "The offer goes to the best driver, who accepts." },
        { edge: "customer-rt", text: "The customer tracks the driver arriving." },
        { edge: "booking-notify", text: "Driver details are sent by SMS." },
      ],
    },
    {
      id: "payout",
      name: "Weekly payouts",
      steps: [
        { edge: "booking-events", text: "Every completed trip is published." },
        { edge: "rt-events", text: "GPS history confirms hours on duty." },
        { edge: "events-payroll", text: "A weekly job totals trips, hours, incentives and deductions." },
        { edge: "payroll-psp", text: "Payouts are sent to drivers' bank accounts." },
        { edge: "events-warehouse", text: "Fleet operators see utilisation reports." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Matching on skills as well as distance",
      fix: "Index drivers by cell and skill flags; widen the radius if no match.",
      nodes: ["dispatch", "geo-index"],
    },
    {
      problem: "Sensitive driver documents",
      fix: "Encrypt at rest, restrict access by role, and audit every read.",
      nodes: ["documents", "driver-svc"],
    },
    {
      problem: "Payroll correctness",
      fix: "Compute from immutable trip events; make payout runs idempotent.",
      nodes: ["payroll"],
    },
  ],

  scaling: [
    "Partition by city; fleets are tenants with their own dashboards.",
    "Stream GPS history to cheap storage and keep only live positions in memory.",
    "Analytics in a warehouse, not the operational DB.",
  ],

  extensions: [
    "Corporate chauffeur contracts.",
    "Driver training and ratings-based incentives.",
    "Predictive maintenance from telematics.",
  ],
};
