import type { SystemDesignInput } from "@/types/schema";

export const practo: SystemDesignInput = {
  slug: "practo",
  name: "Practo / teleconsultation",
  tagline: "Find doctors, book appointments, consult over video",
  description:
    "Patients search doctors by specialty and location, then book a slot from the doctor's calendar with a short hold while they pay. At the appointment time both join a video call set up through WebRTC signalling, with TURN relays for hard networks. Prescriptions and reports are stored as encrypted health records that only the patient and their doctors can access.",
  category: "bookings",
  difficulty: 2,
  concepts: ["webrtc", "distributed-locks", "websockets", "idempotency", "search-indexing", "authentication"],

  requirements: {
    functional: [
      "Search doctors by specialty, location, language, fee and rating",
      "Book clinic visits or video consultations from available slots",
      "Video, audio and chat consultations",
      "E-prescriptions and medical records shared with the patient",
      "Payments, reminders and follow-ups",
    ],
    nonFunctional: [
      "Health data encrypted and access-controlled (HIPAA-style compliance)",
      "No double-booked slots",
      "Calls work on mobile networks with low latency",
      "Every access to records is audited",
    ],
  },

  apis: [
    { method: "GET", path: "/doctors?specialty=&city=&mode=video", purpose: "Doctors with next available slots" },
    { method: "POST", path: "/appointments", purpose: "Book a slot (holds it during payment)" },
    { method: "WS", path: "/consultations/{id}/signal", purpose: "WebRTC signalling for the call" },
    { method: "POST", path: "/consultations/{id}/prescription", purpose: "Doctor issues an e-prescription" },
    { method: "GET", path: "/records", purpose: "Patient's own records and prescriptions" },
  ],

  estimates: [
    { label: "Consultations", value: "≈ 100 k/day", derivation: "Assumption; video and clinic combined" },
    { label: "Concurrent calls at peak", value: "≈ 5 k", derivation: "Evening peak, ~15 minutes each" },
    { label: "Doctors", value: "≈ 100 k listed", derivation: "Assumption" },
    { label: "Records", value: "≈ 50 GB/day", derivation: "Prescriptions and uploaded reports" },
  ],

  dataModel: [
    {
      entity: "Doctor slot",
      store: "Relational DB",
      key: "doctorId + start",
      fields: ["mode (clinic/video)", "status", "appointmentId"],
      why: "Conditional booking prevents double booking",
    },
    {
      entity: "Appointment",
      store: "Relational DB",
      key: "appointmentId",
      fields: ["patientId", "doctorId", "slot", "mode", "status", "paymentId"],
      why: "Lifecycle and payment",
    },
    {
      entity: "Health record",
      store: "Encrypted object storage + metadata DB",
      key: "patientId/recordId",
      fields: ["type", "doctorId", "encrypted file", "accessList"],
      why: "Sensitive; per-record keys and access lists",
    },
  ],

  nodes: [
    { id: "patient", kind: "mobile-client", label: "Patient app", role: "Search, book, consult, view records" },
    { id: "doctor", kind: "web-client", label: "Doctor app", role: "Calendar, consultations, prescriptions" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Auth, roles, audit logging" },
    { id: "identity", kind: "identity", label: "Identity", role: "Patient and verified-doctor accounts" },
    { id: "search-svc", kind: "service", label: "Doctor search", role: "Specialty, location and availability" },
    { id: "doctor-index", kind: "search", label: "Doctor index", role: "Doctors, clinics and next free slot" },
    { id: "booking-svc", kind: "service", label: "Appointment service", role: "Slots, holds and bookings" },
    { id: "slot-holds", kind: "cache", label: "Slot holds", role: "Short-lived holds during payment" },
    { id: "main-db", kind: "relational-db", label: "Appointments & slots", role: "Source of truth" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Consultation fees and refunds" },
    { id: "psp", kind: "payments", label: "Payment provider", role: "UPI, cards" },
    { id: "signal", kind: "realtime-gateway", label: "Call signalling & chat", role: "WebRTC signalling and in-call chat" },
    { id: "media", kind: "webrtc-media", label: "TURN / media servers", role: "Relays calls on restrictive networks" },
    { id: "records-svc", kind: "service", label: "Records service", role: "Prescriptions and reports with access control" },
    { id: "records", kind: "object-storage", label: "Encrypted records", role: "Health documents" },
    { id: "kms", kind: "secrets", label: "Key management", role: "Encryption keys for records" },
    { id: "notify", kind: "notifications", label: "Reminders", role: "SMS and push reminders" },
  ],

  edges: [
    { id: "patient-gateway", from: "patient", to: "gateway" },
    { id: "doctor-gateway", from: "doctor", to: "gateway" },
    { id: "gateway-identity", from: "gateway", to: "identity", label: "Verify token" },
    { id: "gateway-search", from: "gateway", to: "search-svc", protocol: "grpc" },
    { id: "search-index", from: "search-svc", to: "doctor-index" },
    { id: "gateway-booking", from: "gateway", to: "booking-svc", protocol: "grpc" },
    { id: "booking-holds", from: "booking-svc", to: "slot-holds", label: "Hold slot" },
    { id: "booking-payment", from: "booking-svc", to: "payment-svc", protocol: "grpc" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "booking-db", from: "booking-svc", to: "main-db", label: "Confirm" },
    { id: "booking-notify", from: "booking-svc", to: "notify" },
    { id: "patient-signal", from: "patient", to: "signal", protocol: "ws" },
    { id: "doctor-signal", from: "doctor", to: "signal", protocol: "ws" },
    { id: "patient-media", from: "patient", to: "media", label: "Video" },
    { id: "doctor-media", from: "doctor", to: "media" },
    { id: "gateway-records", from: "gateway", to: "records-svc", protocol: "grpc" },
    { id: "records-store", from: "records-svc", to: "records" },
    { id: "records-kms", from: "records-svc", to: "kms", label: "Encrypt / decrypt" },
  ],

  flows: [
    {
      id: "book",
      name: "Book a video consult",
      steps: [
        { edge: "patient-gateway", text: "The patient searches for a dermatologist available today by video." },
        { edge: "gateway-search", text: "Search filters by specialty, language and mode." },
        { edge: "search-index", text: "Results include each doctor's next free slot." },
        { edge: "gateway-booking", text: "The patient picks 6:30pm." },
        { edge: "booking-holds", text: "The slot is held for a few minutes." },
        { edge: "booking-payment", text: "The fee is paid." },
        { edge: "payment-psp", text: "The payment provider approves." },
        { edge: "booking-db", text: "The slot is booked with a conditional update." },
        { edge: "booking-notify", text: "Both get confirmations and reminders." },
      ],
    },
    {
      id: "consult",
      name: "Consultation",
      steps: [
        { edge: "patient-signal", text: "At 6:30 the patient joins; signalling exchanges WebRTC offers." },
        { edge: "doctor-signal", text: "The doctor joins from the dashboard." },
        { edge: "patient-media", text: "Video flows peer-to-peer or through a TURN relay." },
        { edge: "gateway-records", text: "After the call the doctor issues a prescription." },
        { edge: "records-kms", text: "It's encrypted with a key from key management…" },
        { edge: "records-store", text: "…and stored; only the patient and permitted doctors can read it, and every read is logged." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Calls failing on poor mobile networks",
      fix: "TURN relays in-region, adaptive bitrate and audio-only fallback.",
      nodes: ["media", "signal"],
    },
    {
      problem: "Protecting health data",
      fix: "Encryption with managed keys, strict role-based access, and audit logs on every access.",
      nodes: ["records-svc", "kms", "gateway"],
    },
    {
      problem: "Double-booked slots",
      fix: "Holds during payment plus conditional confirmation in the database.",
      nodes: ["slot-holds", "main-db"],
    },
  ],

  scaling: [
    "Keep health data in-country to meet data-residency rules.",
    "Scale media relays by concurrent calls.",
    "Partition appointments by region.",
  ],

  extensions: [
    "Lab test bookings and home sample collection.",
    "Medicine delivery from prescriptions.",
    "AI symptom checker before booking.",
  ],
};
