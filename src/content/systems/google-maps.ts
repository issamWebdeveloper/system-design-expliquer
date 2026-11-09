import type { SystemDesignInput } from "@/types/schema";

export const googleMaps: SystemDesignInput = {
  slug: "google-maps",
  name: "Google Maps",
  tagline: "Map tiles, place search, routing and live traffic",
  description:
    "A map is mostly static: an offline pipeline renders the world into tiles at every zoom level, served from a CDN. Places are found through a geo-aware search index. Routing runs on a pre-processed road graph, with edge weights updated by live traffic computed from millions of anonymous phone GPS pings, and an ML model turns all of that into ETAs.",
  category: "mobility",
  difficulty: 3,
  concepts: ["geospatial-indexing", "caching", "sharding", "event-driven", "search-indexing"],

  requirements: {
    functional: [
      "Pan and zoom a map of the world",
      "Search for places and addresses (geocoding) and reverse-geocode a point",
      "Directions by car, transit, bike or foot with ETA",
      "Turn-by-turn navigation with live traffic and rerouting",
    ],
    nonFunctional: [
      "Map tiles load instantly everywhere",
      "Routes in under a second, even across a continent",
      "Traffic reflects reality within a few minutes",
      "Location data is anonymised",
    ],
  },

  apis: [
    { method: "GET", path: "/tiles/{z}/{x}/{y}", purpose: "Vector map tile for zoom z and tile x, y (CDN-cached)" },
    { method: "GET", path: "/places/search?q=&near=", purpose: "Places and addresses near a point" },
    { method: "GET", path: "/geocode/reverse?lat=&lng=", purpose: "Address for a point" },
    { method: "POST", path: "/routes", purpose: "{ origin, destination, mode, departAt } → routes with ETA" },
    { method: "POST", path: "/probes", purpose: "Batched anonymous GPS points from navigating phones" },
  ],

  estimates: [
    { label: "Daily users", value: "≈ 100 M", derivation: "Assumption" },
    { label: "Tile requests", value: "≈ 115 k/s", derivation: "100 M users × 5 map views × 20 tiles ÷ 86,400 s — almost all from CDN" },
    { label: "Route requests", value: "≈ 2–3 k/s avg", derivation: "100 M users × 2 routes ÷ 86,400 s" },
    { label: "GPS probes", value: "≈ 2 M/s", derivation: "10 M navigating devices × one point every 5 s" },
    { label: "Tile storage", value: "Tens of TB", derivation: "Vector tiles for zoom 0–18 worldwide, plus imagery separately" },
  ],

  dataModel: [
    {
      entity: "Map tile",
      store: "Object storage + CDN",
      key: "z/x/y",
      fields: ["roads", "labels", "buildings", "water"],
      why: "Pre-rendered and immutable per version — perfect for caching",
    },
    {
      entity: "Road segment",
      store: "Graph store, partitioned by region",
      key: "segmentId",
      fields: ["fromNode", "toNode", "length", "speedLimit", "restrictions"],
      why: "Routing walks this graph; partitions plus shortcuts make long routes fast",
    },
    {
      entity: "Live speed",
      store: "In-memory cache",
      key: "segmentId",
      fields: ["currentSpeed", "updatedAt", "confidence"],
      why: "Overwritten every minute from probe aggregation",
    },
    {
      entity: "Place",
      store: "Search index with geo fields",
      key: "placeId",
      fields: ["name", "category", "location", "address", "rating", "hours"],
      why: "Text plus distance ranking",
    },
  ],

  nodes: [
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "Map, search, navigation; sends anonymous GPS while navigating" },
    { id: "web", kind: "web-client", label: "Web app", role: "Map, search and directions" },
    { id: "cdn", kind: "cdn", label: "Tile CDN", role: "Serves map tiles from the edge" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, quotas and routing" },
    { id: "places-svc", kind: "service", label: "Places & geocoding", role: "Text search with distance ranking; reverse geocoding" },
    { id: "routing-svc", kind: "service", label: "Routing engine", role: "Shortest paths on the road graph with live weights" },
    { id: "eta", kind: "ml-platform", label: "ETA model", role: "Predicts travel time from live and historical speeds" },
    { id: "probes", kind: "event-stream", label: "GPS probe stream", role: "Anonymous location points" },
    { id: "traffic", kind: "stream-processor", label: "Traffic aggregation", role: "Snaps points to roads and computes current speeds" },
    { id: "speeds", kind: "cache", label: "Live speeds", role: "Current speed per road segment" },
    { id: "road-graph", kind: "graph-db", label: "Road graph", role: "Partitioned road network with precomputed shortcuts" },
    { id: "places-index", kind: "search", label: "Places index", role: "Places and addresses with geo fields" },
    { id: "tiles", kind: "object-storage", label: "Tile storage", role: "Pre-rendered vector tiles" },
    { id: "map-pipeline", kind: "batch-processing", label: "Map data pipeline", role: "Turns source map data into tiles, graph and index" },
  ],

  edges: [
    { id: "mobile-cdn", from: "mobile", to: "cdn", label: "Tiles" },
    { id: "web-cdn", from: "web", to: "cdn" },
    { id: "cdn-tiles", from: "cdn", to: "tiles", label: "Origin" },
    { id: "mobile-gateway", from: "mobile", to: "gateway", label: "Search / route" },
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "gateway-places", from: "gateway", to: "places-svc", protocol: "grpc" },
    { id: "places-index-read", from: "places-svc", to: "places-index" },
    { id: "gateway-routing", from: "gateway", to: "routing-svc", protocol: "grpc" },
    { id: "routing-graph", from: "routing-svc", to: "road-graph" },
    { id: "routing-speeds", from: "routing-svc", to: "speeds", label: "Live weights" },
    { id: "routing-eta", from: "routing-svc", to: "eta", label: "ETA" },
    { id: "mobile-probes", from: "mobile", to: "probes", label: "GPS while navigating", protocol: "stream" },
    { id: "probes-traffic", from: "probes", to: "traffic", protocol: "stream" },
    { id: "traffic-speeds", from: "traffic", to: "speeds" },
    { id: "pipeline-tiles", from: "map-pipeline", to: "tiles", label: "Render" },
    { id: "pipeline-graph", from: "map-pipeline", to: "road-graph", label: "Build" },
    { id: "pipeline-index", from: "map-pipeline", to: "places-index", label: "Index" },
  ],

  flows: [
    {
      id: "view",
      name: "Open the map",
      steps: [
        { edge: "mobile-cdn", text: "The app works out which tiles cover the screen at this zoom and requests them." },
        { edge: "cdn-tiles", text: "Almost every tile is already at the edge; rare ones are fetched once from storage." },
      ],
    },
    {
      id: "route",
      name: "Get directions",
      steps: [
        { edge: "mobile-gateway", text: "The user searches for a destination." },
        { edge: "gateway-places", text: "The places service handles the query." },
        { edge: "places-index-read", text: "It matches text and ranks by distance from the user." },
        { edge: "gateway-routing", text: "The user asks for directions." },
        { edge: "routing-graph", text: "The engine searches the partitioned graph, jumping long distances on precomputed shortcuts." },
        { edge: "routing-speeds", text: "Edge weights come from current speeds, so it routes around jams." },
        { edge: "routing-eta", text: "The ETA model adjusts the time using historical patterns for this time of day." },
      ],
    },
    {
      id: "traffic",
      name: "Live traffic",
      steps: [
        { edge: "mobile-probes", text: "Navigating phones send batched, anonymised GPS points." },
        { edge: "probes-traffic", text: "Points are matched to road segments and averaged per minute." },
        { edge: "traffic-speeds", text: "Updated speeds feed routing and the red/yellow/green overlay." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Billions of tile requests",
      fix: "Pre-render immutable, versioned tiles and serve them from the CDN; clients cache them too.",
      nodes: ["cdn", "tiles"],
    },
    {
      problem: "Plain shortest-path search is too slow across a continent",
      fix: "Partition the graph and precompute shortcuts (contraction hierarchies) so queries touch few nodes.",
      nodes: ["routing-svc", "road-graph"],
    },
    {
      problem: "Millions of GPS points per second",
      fix: "Batch on the device, partition the stream by region, and aggregate per segment per minute.",
      nodes: ["probes", "traffic"],
    },
  ],

  scaling: [
    "Partition routing and traffic by geographic region; most routes stay in one.",
    "Replicate the places index per region with local data first.",
    "Rebuild tiles and the graph incrementally as map data changes.",
    "Keep live speeds in memory, sharded by segment.",
  ],

  extensions: [
    "Public transit routing with timetables.",
    "Offline maps downloaded per region.",
    "Street-level imagery.",
    "Reviews, photos and opening hours for places.",
  ],
};
