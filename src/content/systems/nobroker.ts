import type { SystemDesignInput } from "@/types/schema";

export const nobroker: SystemDesignInput = {
  slug: "nobroker",
  name: "NoBroker",
  tagline: "Broker-free property rentals and sales",
  description:
    "Owners list properties with photos; listings are verified (automatically and by staff) before going live in a geo-search index. Tenants browse for free but unlock owners' contact details with a paid plan, then chat and schedule visits. Rent payments and add-on services run through the same payments platform.",
  category: "bookings",
  difficulty: 2,
  concepts: ["search-indexing", "geospatial-indexing", "presigned-urls", "websockets", "event-driven"],

  requirements: {
    functional: [
      "Owners post properties with photos, price, location and amenities",
      "Listings are verified to remove brokers and fakes",
      "Tenants and buyers search by area, budget, type and amenities, on a map",
      "Paid plans unlock owner contacts; chat and schedule visits",
      "Pay rent and book services (movers, cleaning)",
    ],
    nonFunctional: [
      "Search results in under a second",
      "Contact details stay protected until unlocked",
      "Spam and fraud kept low",
    ],
  },

  apis: [
    { method: "POST", path: "/listings", purpose: "Create a listing; returns photo upload URLs" },
    { method: "GET", path: "/search?city=&bbox=&budget=&bhk=", purpose: "Matching verified listings" },
    { method: "POST", path: "/listings/{id}/contact", purpose: "Unlock owner contact (uses plan credits)" },
    { method: "POST", path: "/visits", purpose: "Request a visit slot" },
    { method: "WS", path: "/chat", purpose: "Owner–tenant chat" },
  ],

  estimates: [
    { label: "Users", value: "≈ 5 M monthly, 500 k daily", derivation: "Assumption from the PDF" },
    { label: "Active listings", value: "≈ 1 M", derivation: "Assumption" },
    { label: "Searches", value: "≈ 60 req/s avg", derivation: "500 k users × 10 searches ÷ 86,400 s; evenings peak 5×" },
    { label: "Photos", value: "≈ 20 TB", derivation: "1 M listings × 10 photos × ~2 MB" },
  ],

  dataModel: [
    {
      entity: "Listing",
      store: "Relational DB + search index",
      key: "listingId",
      fields: ["ownerId", "location", "type", "rent/price", "bhk", "amenities", "status (pending/live)"],
      why: "Source of truth plus a geo-searchable copy",
    },
    {
      entity: "Contact unlock",
      store: "Relational DB",
      key: "userId + listingId",
      fields: ["planId", "unlockedAt"],
      why: "Enforces plan limits and keeps an audit trail",
    },
    {
      entity: "Chat message",
      store: "Wide-column DB",
      key: "threadId + time",
      fields: ["senderId", "text"],
      why: "High write volume per conversation",
    },
  ],

  nodes: [
    { id: "tenant", kind: "mobile-client", label: "Tenant / buyer app", role: "Search, unlock, chat, visit" },
    { id: "owner", kind: "web-client", label: "Owner app", role: "Post and manage listings" },
    { id: "cdn", kind: "cdn", label: "Photo CDN", role: "Listing photos" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, rate limits" },
    { id: "listing-svc", kind: "service", label: "Listing service", role: "Create and update listings" },
    { id: "verification", kind: "ml-platform", label: "Verification & fraud", role: "Flags brokers, duplicates and fake listings" },
    { id: "search-svc", kind: "service", label: "Search service", role: "Geo and filter search" },
    { id: "search-index", kind: "search", label: "Listing index", role: "Live listings with geo points" },
    { id: "lead-svc", kind: "service", label: "Contacts & visits", role: "Plan checks, contact unlocks, visit scheduling" },
    { id: "chat", kind: "realtime-gateway", label: "Chat", role: "Owner–tenant messaging" },
    { id: "payment-svc", kind: "service", label: "Plans & payments", role: "Subscriptions, rent payments, services" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards" },
    { id: "main-db", kind: "relational-db", label: "Listings, users & plans", role: "Transactional data" },
    { id: "photos", kind: "object-storage", label: "Photos", role: "Uploaded images" },
    { id: "events", kind: "event-stream", label: "Listing events", role: "Created, verified, updated" },
    { id: "notify", kind: "notifications", label: "Push & SMS", role: "New matches, visit reminders" },
  ],

  edges: [
    { id: "owner-gateway", from: "owner", to: "gateway" },
    { id: "tenant-gateway", from: "tenant", to: "gateway" },
    { id: "owner-photos", from: "owner", to: "photos", label: "Upload (pre-signed)" },
    { id: "tenant-cdn", from: "tenant", to: "cdn", label: "Photos" },
    { id: "cdn-photos", from: "cdn", to: "photos" },
    { id: "gateway-listing", from: "gateway", to: "listing-svc", protocol: "grpc" },
    { id: "listing-db", from: "listing-svc", to: "main-db" },
    { id: "listing-events", from: "listing-svc", to: "events", protocol: "stream" },
    { id: "events-verify", from: "events", to: "verification", protocol: "async" },
    { id: "verify-db", from: "verification", to: "main-db", label: "Approve / reject" },
    { id: "events-index", from: "events", to: "search-index", label: "Index live listings", protocol: "stream" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-read", from: "search-svc", to: "search-index" },
    { id: "gateway-lead", from: "gateway", to: "lead-svc", protocol: "grpc" },
    { id: "lead-db", from: "lead-svc", to: "main-db", label: "Plan credits" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "tenant-chat", from: "tenant", to: "chat", protocol: "ws" },
    { id: "owner-chat", from: "owner", to: "chat", protocol: "ws" },
    { id: "events-notify", from: "events", to: "notify", label: "Matching alerts", protocol: "async" },
  ],

  flows: [
    {
      id: "post",
      name: "Post a listing",
      steps: [
        { edge: "owner-gateway", text: "The owner fills in details." },
        { edge: "gateway-listing", text: "The listing service validates the details." },
        { edge: "listing-db", text: "The listing is saved as PENDING and photo upload URLs are returned." },
        { edge: "owner-photos", text: "Photos upload straight to storage." },
        { edge: "listing-events", text: "Once the photos are in, a 'listing created' event is published." },
        { edge: "events-verify", text: "Models check for brokers, duplicates and fake photos; borderline ones go to staff." },
        { edge: "verify-db", text: "The listing is approved." },
        { edge: "events-index", text: "It becomes searchable." },
        { edge: "events-notify", text: "Tenants with matching saved searches are alerted." },
      ],
    },
    {
      id: "contact",
      name: "Contact an owner",
      steps: [
        { edge: "tenant-gateway", text: "The tenant searches an area on the map." },
        { edge: "gateway-search", text: "The search service filters by budget and type." },
        { edge: "search-read", text: "Matching live listings come back." },
        { edge: "gateway-lead", text: "The tenant taps 'contact owner'." },
        { edge: "lead-db", text: "One plan credit is used and the unlock recorded." },
        { edge: "tenant-chat", text: "They chat and book a visit." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Brokers and fake listings",
      fix: "Automated checks on photos, phone numbers and posting patterns, plus manual review before going live.",
      nodes: ["verification"],
    },
    {
      problem: "Scraping of owner contacts",
      fix: "Hide contacts behind authenticated, rate-limited unlocks; mask phone numbers in chat.",
      nodes: ["lead-svc", "gateway"],
    },
    {
      problem: "Evening search peaks",
      fix: "Cache popular searches per locality and scale search replicas.",
      nodes: ["search-svc", "search-index"],
    },
  ],

  scaling: [
    "Partition listings and search by city.",
    "CDN for all photos; resize on upload.",
    "Async pipelines for verification and notifications.",
  ],

  extensions: [
    "Rental agreements and e-signing.",
    "Home services marketplace (movers, painting).",
    "Price estimates for an area from past listings.",
  ],
};
