import type { SystemDesignInput } from "@/types/schema";

export const porter: SystemDesignInput = {
  slug: "porter",
  name: "Porter / goods delivery",
  tagline: "Book a truck or bike to move goods across the city",
  description:
    "Like ride-hailing, but for goods. The customer picks a vehicle type (bike, mini-truck, truck), pickup and drop points, and gets an upfront fare. Dispatch looks up nearby available drivers of that vehicle type in a geo index and offers the job. Trips include loading time, multiple stops and proof of delivery, and business customers can schedule orders in bulk.",
  category: "mobility",
  difficulty: 2,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Choose vehicle type, pickup, one or more drops; see the fare",
      "Match a nearby driver with that vehicle type",
      "Live tracking, proof of delivery (photo/OTP)",
      "Scheduled and bulk orders for businesses",
      "Payments, invoices and driver payouts",
    ],
    nonFunctional: [
      "Match within a minute in busy cities",
      "Accurate fares including waiting and loading time",
      "No double assignment of a driver",
    ],
  },

  apis: [
    { method: "POST", path: "/quotes", purpose: "{ vehicleType, stops[] } → fare and ETA" },
    { method: "POST", path: "/orders", purpose: "Create an order (Idempotency-Key)" },
    { method: "WS", path: "/driver/socket", purpose: "GPS updates in, job offers out" },
    { method: "POST", path: "/orders/{id}/pod", purpose: "Proof of delivery (photo, OTP)" },
    { method: "WS", path: "/orders/{id}/track", purpose: "Live tracking for the customer" },
  ],

  estimates: [
    { label: "Orders", value: "≈ 500 k/day", derivation: "Assumption; ~6/s average, ~30/s peak" },
    { label: "Online drivers", value: "≈ 100 k", derivation: "Assumption" },
    { label: "GPS updates", value: "≈ 25 k/s", derivation: "100 k drivers ÷ one ping every 4 s" },
    { label: "POD photos", value: "≈ 250 GB/day", derivation: "500 k × ~500 KB" },
  ],

  dataModel: [
    {
      entity: "Order",
      store: "Relational DB, sharded by city",
      key: "orderId",
      fields: ["customerId", "vehicleType", "stops[]", "fare", "status", "driverId"],
      why: "Multi-stop lifecycle with money",
    },
    {
      entity: "Driver location",
      store: "In-memory geo index",
      key: "vehicleType + geo cell",
      fields: ["driverId", "lat", "lng", "status"],
      why: "Nearest free driver of a given vehicle type",
    },
    {
      entity: "Proof of delivery",
      store: "Object storage",
      key: "orderId/stop",
      fields: ["photo", "signature", "otpVerifiedAt"],
      why: "Evidence for disputes",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "Customer app", role: "Book, track, pay" },
    { id: "business", kind: "web-client", label: "Business portal", role: "Scheduled and bulk orders" },
    { id: "driver", kind: "mobile-client", label: "Driver app", role: "GPS, offers, navigation, proof of delivery" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, routing" },
    { id: "pricing", kind: "service", label: "Pricing", role: "Fare by vehicle, distance, time and demand" },
    { id: "maps", kind: "maps", label: "Maps & routing", role: "Distance, ETA, multi-stop routes" },
    { id: "order-svc", kind: "service", label: "Order service", role: "Order lifecycle" },
    { id: "dispatch", kind: "service", label: "Dispatch", role: "Finds and locks a driver, sends the offer" },
    { id: "rt", kind: "realtime-gateway", label: "Real-time gateway", role: "Driver GPS and offers, customer tracking" },
    { id: "geo-index", kind: "cache", label: "Driver geo index", role: "Free drivers by vehicle type and cell" },
    { id: "order-db", kind: "relational-db", label: "Orders", role: "Orders by city" },
    { id: "pod-store", kind: "object-storage", label: "Proof of delivery", role: "Photos and signatures" },
    { id: "payment-svc", kind: "service", label: "Payments & payouts", role: "Charges, invoices, driver payouts" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards, wallets" },
    { id: "events", kind: "event-stream", label: "Order events", role: "Status changes" },
    { id: "notify", kind: "notifications", label: "Push & SMS", role: "Driver details, delivery OTP" },
  ],

  edges: [
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "business-gateway", from: "business", to: "gateway" },
    { id: "gateway-pricing", from: "gateway", to: "pricing", label: "Quote", protocol: "grpc" },
    { id: "pricing-maps", from: "pricing", to: "maps" },
    { id: "gateway-order", from: "gateway", to: "order-svc", protocol: "grpc" },
    { id: "order-db-write", from: "order-svc", to: "order-db" },
    { id: "order-dispatch", from: "order-svc", to: "dispatch", protocol: "grpc" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Nearby + lock" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Offer", protocol: "ws" },
    { id: "driver-rt", from: "driver", to: "rt", label: "GPS", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Track", protocol: "ws" },
    { id: "driver-pod", from: "driver", to: "pod-store", label: "POD photo" },
    { id: "order-events", from: "order-svc", to: "events", protocol: "stream" },
    { id: "events-payment", from: "events", to: "payment-svc", label: "Delivered", protocol: "async" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "book",
      name: "Move goods",
      steps: [
        { edge: "customer-gateway", text: "The customer enters pickup and drop and picks a mini-truck." },
        { edge: "gateway-pricing", text: "Pricing quotes a fare." },
        { edge: "pricing-maps", text: "Using route distance, expected time and current demand." },
        { edge: "gateway-order", text: "The customer confirms." },
        { edge: "order-db-write", text: "The order is saved." },
        { edge: "order-dispatch", text: "Dispatch searches for a driver." },
        { edge: "dispatch-geo", text: "Free mini-trucks near the pickup are found and the best one is locked." },
        { edge: "dispatch-rt", text: "The offer is pushed to the driver, who accepts." },
        { edge: "customer-rt", text: "The customer tracks the truck live." },
        { edge: "driver-pod", text: "At each drop the driver records a photo or OTP." },
        { edge: "order-events", text: "'Delivered' is published." },
        { edge: "events-payment", text: "Payment is settled and the driver's earnings recorded." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Few drivers of a rare vehicle type nearby",
      fix: "Expand the search radius in rings and allow scheduled orders to be matched in advance.",
      nodes: ["dispatch", "geo-index"],
    },
    {
      problem: "Fare disputes over waiting and loading time",
      fix: "Timestamp every stop event and keep proof of delivery.",
      nodes: ["order-svc", "pod-store"],
    },
    {
      problem: "Bulk business orders arriving at once",
      fix: "Queue and batch-dispatch them with route optimisation.",
      nodes: ["order-svc", "dispatch"],
    },
  ],

  scaling: [
    "Partition by city.",
    "In-memory geo index per vehicle type, sharded by cell.",
    "Event-driven post-delivery processing.",
  ],

  extensions: [
    "Packers and movers with inventory lists.",
    "Insurance for goods in transit.",
    "Route optimisation for multi-drop business deliveries.",
  ],
};
