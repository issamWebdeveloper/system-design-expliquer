import type { SystemDesignInput } from "@/types/schema";

export const zomato: SystemDesignInput = {
  slug: "zomato",
  name: "Zomato / food delivery",
  tagline: "Restaurant discovery, ordering and live delivery tracking",
  description:
    "Three apps meet in one order: the customer orders, the restaurant accepts and cooks, and a delivery partner picks up and drops off. Discovery is a geo search over restaurants that deliver to you. Once an order is paid and accepted, a dispatch service picks a nearby rider using a live geo index, timed so the rider arrives as the food is ready, and everyone watches progress on a live map.",
  category: "mobility",
  difficulty: 3,
  concepts: ["geospatial-indexing", "websockets", "event-driven", "idempotency", "caching", "search-indexing"],

  requirements: {
    functional: [
      "Discover restaurants that deliver to your location, with menus, ratings and ETAs",
      "Build a cart, apply offers, pay",
      "Restaurants accept orders and mark them ready",
      "Assign a delivery partner and track them live",
      "Ratings and reviews for restaurants and riders",
    ],
    nonFunctional: [
      "Dinner-time peaks several times the daily average",
      "Rider assignment within seconds of the restaurant accepting",
      "Location updates reflected within a couple of seconds",
      "An order is never charged twice or lost",
    ],
  },

  apis: [
    { method: "GET", path: "/restaurants?lat=&lng=&cuisine=", purpose: "Restaurants delivering here, ranked" },
    { method: "GET", path: "/restaurants/{id}/menu", purpose: "Menu with live availability" },
    { method: "POST", path: "/orders", purpose: "Place an order (Idempotency-Key)" },
    { method: "POST", path: "/orders/{id}/status", purpose: "Restaurant or rider updates status" },
    { method: "WS", path: "/orders/{id}/track", purpose: "Live rider location and ETA" },
  ],

  estimates: [
    { label: "Orders", value: "≈ 2 M/day", derivation: "Assumption; ~23/s average, ~150/s at dinner peak" },
    { label: "Active riders at peak", value: "≈ 200 k", derivation: "Assumption" },
    { label: "Rider location updates", value: "≈ 50 k/s", derivation: "200 k riders ÷ one ping every 4 s" },
    { label: "Discovery requests", value: "≈ 10–20 k/s peak", derivation: "Browsing far exceeds ordering" },
  ],

  dataModel: [
    {
      entity: "Order",
      store: "Relational DB, sharded by city",
      key: "orderId",
      fields: ["customerId", "restaurantId", "items", "total", "status", "riderId", "paymentId"],
      why: "State machine: placed → accepted → ready → picked up → delivered",
    },
    {
      entity: "Restaurant",
      store: "Relational DB + search index",
      key: "restaurantId",
      fields: ["location", "deliveryRadius", "cuisines", "rating", "isOpen", "prepTime"],
      why: "Geo search plus filters",
    },
    {
      entity: "Rider location",
      store: "In-memory geo index",
      key: "geo cell → riderIds",
      fields: ["lat", "lng", "status", "updatedAt"],
      why: "Constant updates; 'nearest free riders' lookups",
    },
  ],

  nodes: [
    { id: "customer", kind: "mobile-client", label: "Customer app", role: "Browse, order, track" },
    { id: "restaurant", kind: "web-client", label: "Restaurant app", role: "Accept orders, mark ready, manage menu" },
    { id: "rider", kind: "mobile-client", label: "Rider app", role: "Accept deliveries, stream GPS" },
    { id: "cdn", kind: "cdn", label: "CDN", role: "Menu and dish photos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits, routing" },
    { id: "discovery-svc", kind: "service", label: "Discovery service", role: "Geo search and ranking of restaurants" },
    { id: "restaurant-index", kind: "search", label: "Restaurant index", role: "Restaurants with location, cuisine, rating" },
    { id: "menu-cache", kind: "cache", label: "Menu cache", role: "Menus and item availability" },
    { id: "order-svc", kind: "service", label: "Order service", role: "Order lifecycle" },
    { id: "order-db", kind: "relational-db", label: "Orders", role: "Orders by city" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Charges, refunds, restaurant and rider payouts" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards, wallets" },
    { id: "dispatch", kind: "service", label: "Dispatch service", role: "Picks a rider by distance, load and prep time" },
    { id: "rt", kind: "realtime-gateway", label: "Real-time gateway", role: "Rider GPS in; live tracking and order offers out" },
    { id: "geo-index", kind: "cache", label: "Rider geo index", role: "Free riders by map cell" },
    { id: "eta", kind: "ml-platform", label: "ETA & prep-time models", role: "Predict cooking and travel time" },
    { id: "events", kind: "event-stream", label: "Order events", role: "Every status change" },
    { id: "notify", kind: "notifications", label: "Push & SMS", role: "Order updates" },
  ],

  edges: [
    { id: "customer-cdn", from: "customer", to: "cdn" },
    { id: "customer-gateway", from: "customer", to: "gateway" },
    { id: "restaurant-gateway", from: "restaurant", to: "gateway" },
    { id: "gateway-discovery", from: "gateway", to: "discovery-svc", protocol: "grpc" },
    { id: "discovery-index", from: "discovery-svc", to: "restaurant-index" },
    { id: "discovery-menu", from: "discovery-svc", to: "menu-cache" },
    { id: "gateway-order", from: "gateway", to: "order-svc", protocol: "grpc" },
    { id: "order-db-write", from: "order-svc", to: "order-db" },
    { id: "order-payment", from: "order-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "order-events", from: "order-svc", to: "events", protocol: "stream" },
    { id: "events-dispatch", from: "events", to: "dispatch", label: "Accepted orders", protocol: "async" },
    { id: "dispatch-geo", from: "dispatch", to: "geo-index", label: "Nearby free riders" },
    { id: "dispatch-eta", from: "dispatch", to: "eta" },
    { id: "dispatch-rt", from: "dispatch", to: "rt", label: "Offer", protocol: "ws" },
    { id: "rider-rt", from: "rider", to: "rt", label: "GPS", protocol: "ws" },
    { id: "rt-geo", from: "rt", to: "geo-index", label: "Update position" },
    { id: "customer-rt", from: "customer", to: "rt", label: "Track", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", protocol: "async" },
  ],

  flows: [
    {
      id: "order",
      name: "Order dinner",
      steps: [
        { edge: "customer-gateway", text: "The customer opens the app at home." },
        { edge: "gateway-discovery", text: "Discovery finds restaurants that deliver here." },
        { edge: "discovery-index", text: "The index filters by delivery radius and ranks by rating, ETA and offers." },
        { edge: "gateway-order", text: "The customer checks out." },
        { edge: "order-db-write", text: "The order is saved as PENDING_PAYMENT before any money moves." },
        { edge: "order-payment", text: "Payment is taken, keyed by the order id so retries can't double-charge." },
        { edge: "payment-psp", text: "The payment provider approves and the order becomes PLACED." },
        { edge: "order-events", text: "The restaurant is notified and accepts; 'accepted' is published." },
        { edge: "events-dispatch", text: "Dispatch starts looking for a rider, timed against the predicted cooking time." },
        { edge: "dispatch-geo", text: "It finds free riders near the restaurant." },
        { edge: "dispatch-eta", text: "Riders are ranked by travel time to arrive just as food is ready." },
        { edge: "dispatch-rt", text: "The offer is pushed to the best rider, who accepts." },
      ],
    },
    {
      id: "track",
      name: "Live tracking",
      steps: [
        { edge: "rider-rt", text: "The rider app streams GPS every few seconds." },
        { edge: "rt-geo", text: "Their position is updated in the geo index." },
        { edge: "customer-rt", text: "The customer's map receives each update and a fresh ETA." },
        { edge: "events-notify", text: "Push notifications mark pickup and arrival." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Dinner-time spikes",
      fix: "Autoscale stateless services, cache menus and discovery results per area, and shed non-essential features under load.",
      nodes: ["discovery-svc", "menu-cache", "order-svc"],
    },
    {
      problem: "Riders arrive too early or too late",
      fix: "Dispatch on predicted prep time and travel ETA instead of 'nearest rider now'; batch nearby orders.",
      nodes: ["dispatch", "eta"],
    },
    {
      problem: "Constant GPS updates",
      fix: "In-memory geo index sharded by cell; downsample history for analytics.",
      nodes: ["rt", "geo-index"],
    },
  ],

  scaling: [
    "Partition orders, dispatch and geo data by city.",
    "Event-driven order pipeline so payment, dispatch and notifications scale separately.",
    "CDN for all images.",
  ],

  extensions: [
    "Grocery and quick commerce from dark stores.",
    "Table reservations.",
    "Subscription for free delivery.",
  ],
};
