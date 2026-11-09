import type { SystemDesignInput } from "@/types/schema";

export const meetingScheduler: SystemDesignInput = {
  slug: "meeting-scheduler",
  name: "Meeting scheduler",
  tagline: "Find a time, book a room, invite everyone",
  description:
    "Scheduling is mostly about free/busy: the system merges attendees' calendars (including external ones) into a cached view of busy intervals and finds common free slots. Booking claims the room with a conditional insert so two meetings can't take the same room and time, then sends invites. A scheduler fires reminders before each meeting.",
  category: "bookings",
  difficulty: 1,
  concepts: ["distributed-locks", "caching", "event-driven", "idempotency"],

  requirements: {
    functional: [
      "Create meetings with attendees, time, duration and optional room",
      "Suggest times when everyone is free",
      "Book rooms without double-booking",
      "Send invites; attendees accept or decline",
      "Recurring meetings and reminders",
      "Sync with external calendars",
    ],
    nonFunctional: [
      "No overlapping bookings for a room",
      "Free/busy answers in well under a second",
      "Time zones handled correctly everywhere",
    ],
  },

  apis: [
    { method: "POST", path: "/availability/query", purpose: "{ attendees, rangeStart, rangeEnd, duration } → free slots" },
    { method: "POST", path: "/meetings", purpose: "Create a meeting and book a room (Idempotency-Key)" },
    { method: "PATCH", path: "/meetings/{id}", purpose: "Reschedule or change attendees" },
    { method: "POST", path: "/meetings/{id}/rsvp", purpose: "Accept or decline" },
    { method: "GET", path: "/rooms?capacity=&from=&to=", purpose: "Rooms free in a window" },
  ],

  estimates: [
    { label: "Users", value: "≈ 1 M in an organisation group", derivation: "Assumption for a large SaaS tenant base" },
    { label: "Meetings created", value: "≈ 5 M/day (~60/s)", derivation: "1 M users × 5 meetings" },
    { label: "Free/busy queries", value: "≈ 10× creations", derivation: "People explore several slots before booking" },
    { label: "Events stored", value: "≈ 2 B/year", derivation: "Including recurring instances" },
  ],

  dataModel: [
    {
      entity: "Event",
      store: "Relational DB",
      key: "eventId",
      fields: ["organizerId", "start", "end", "timezone", "recurrenceRule", "roomId"],
      why: "Transactional changes and recurrence rules",
    },
    {
      entity: "Attendee",
      store: "Relational DB",
      key: "eventId + userId",
      fields: ["response", "notifiedAt"],
      why: "RSVP state per person",
    },
    {
      entity: "Room booking",
      store: "Relational DB",
      key: "roomId + time slot",
      fields: ["eventId"],
      why: "An exclusion constraint on (room, time range) prevents overlaps",
    },
    {
      entity: "Free/busy",
      store: "In-memory cache",
      key: "userId + day",
      fields: ["busy intervals[]"],
      why: "Fast merging across many attendees",
    },
  ],

  nodes: [
    { id: "web", kind: "web-client", label: "Web calendar", role: "Create and manage meetings" },
    { id: "mobile", kind: "mobile-client", label: "Mobile app", role: "RSVP and reminders" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth and routing" },
    { id: "calendar-svc", kind: "service", label: "Calendar service", role: "Create, update and expand meetings" },
    { id: "availability-svc", kind: "service", label: "Free/busy service", role: "Merges busy intervals and finds common slots" },
    { id: "freebusy-cache", kind: "cache", label: "Free/busy cache", role: "Busy intervals per user per day" },
    { id: "room-svc", kind: "service", label: "Room booking", role: "Claims rooms without overlaps" },
    { id: "calendar-db", kind: "relational-db", label: "Events & rooms", role: "Meetings, attendees and room bookings" },
    { id: "external", kind: "partner-api", label: "External calendars", role: "Google / Outlook calendars via sync" },
    { id: "reminders", kind: "workflow", label: "Reminder scheduler", role: "Fires reminders at the right time" },
    { id: "events", kind: "event-stream", label: "Calendar events", role: "Created, changed, cancelled" },
    { id: "notify", kind: "notifications", label: "Email & push", role: "Invites, updates, reminders" },
  ],

  edges: [
    { id: "web-gateway", from: "web", to: "gateway" },
    { id: "mobile-gateway", from: "mobile", to: "gateway" },
    { id: "gateway-availability", from: "gateway", to: "availability-svc", protocol: "grpc" },
    { id: "availability-cache", from: "availability-svc", to: "freebusy-cache" },
    { id: "availability-external", from: "availability-svc", to: "external", label: "External busy times" },
    { id: "gateway-calendar", from: "gateway", to: "calendar-svc", protocol: "grpc" },
    { id: "calendar-room", from: "calendar-svc", to: "room-svc", protocol: "grpc" },
    { id: "room-db", from: "room-svc", to: "calendar-db", label: "Conditional insert" },
    { id: "calendar-db-write", from: "calendar-svc", to: "calendar-db" },
    { id: "calendar-events", from: "calendar-svc", to: "events", protocol: "stream" },
    { id: "events-cache", from: "events", to: "freebusy-cache", label: "Invalidate", protocol: "async" },
    { id: "events-notify", from: "events", to: "notify", label: "Invites", protocol: "async" },
    { id: "events-reminders", from: "events", to: "reminders", label: "Schedule", protocol: "async" },
    { id: "reminders-notify", from: "reminders", to: "notify", label: "Remind" },
  ],

  flows: [
    {
      id: "schedule",
      name: "Schedule a meeting",
      steps: [
        { edge: "web-gateway", text: "The organiser picks attendees and a duration." },
        { edge: "gateway-availability", text: "The free/busy service is asked for slots this week." },
        { edge: "availability-cache", text: "It merges each attendee's cached busy intervals…" },
        { edge: "availability-external", text: "…plus busy times from their external calendars, and returns common free slots." },
        { edge: "gateway-calendar", text: "The organiser picks a slot and a room." },
        { edge: "calendar-room", text: "The room service claims the room." },
        { edge: "room-db", text: "An exclusion constraint rejects the insert if anything overlaps — no double booking." },
        { edge: "calendar-db-write", text: "The meeting and attendees are saved." },
        { edge: "calendar-events", text: "A 'meeting created' event is published." },
        { edge: "events-cache", text: "Attendees' free/busy entries are refreshed." },
        { edge: "events-notify", text: "Invites go out." },
        { edge: "events-reminders", text: "A reminder is scheduled for 10 minutes before." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Merging calendars for large groups",
      fix: "Cache busy intervals per user per day and merge sorted interval lists (O(n log n)).",
      nodes: ["availability-svc", "freebusy-cache"],
    },
    {
      problem: "Two people booking the same room at once",
      fix: "Database exclusion constraint on (room, time range) — the second insert fails cleanly.",
      nodes: ["room-svc", "calendar-db"],
    },
    {
      problem: "Recurring meetings with exceptions",
      fix: "Store the recurrence rule plus overrides; expand instances lazily for the visible range.",
      nodes: ["calendar-svc"],
    },
  ],

  scaling: [
    "Shard events by organisation (tenant).",
    "Store times in UTC with the original time zone for display and recurrence.",
    "Run external calendar sync as background workers with webhooks.",
  ],

  extensions: [
    "Booking links for external people (Calendly-style).",
    "Automatic video-call links.",
    "Smart suggestions that respect working hours and focus time.",
  ],
};
