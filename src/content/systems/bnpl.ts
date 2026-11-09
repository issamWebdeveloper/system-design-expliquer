import type { SystemDesignInput } from "@/types/schema";

export const bnpl: SystemDesignInput = {
  slug: "bnpl",
  name: "Buy now, pay later",
  tagline: "Instant credit at checkout, repaid later",
  description:
    "At a merchant's checkout the shopper chooses 'pay later'. The platform makes a credit decision in about a second — using its own risk model, the user's limit and, for new users, a credit-bureau check — then pays the merchant and records a loan in a double-entry ledger. A scheduler collects repayments by auto-debit, applies late fees and hands overdue accounts to collections.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["ledger", "idempotency", "event-driven", "saga", "authentication"],

  requirements: {
    functional: [
      "Sign up with KYC and get a credit limit",
      "Pay later at partner merchants with a one-tap checkout",
      "Instant credit decision; split into instalments where offered",
      "Repay by auto-debit or manually; late fees and reminders",
      "Merchant settlement and refunds that restore the user's limit",
    ],
    nonFunctional: [
      "Decision in under ~1 second at checkout",
      "Exactly-once money movement and an auditable ledger",
      "Regulatory compliance (KYC, data protection, lending rules)",
      "Fraud kept low without blocking good customers",
    ],
  },

  apis: [
    { method: "POST", path: "/checkout/eligibility", purpose: "Merchant asks: can this user pay later for this amount?" },
    { method: "POST", path: "/checkout/transactions", purpose: "Confirm the purchase (Idempotency-Key)" },
    { method: "POST", path: "/transactions/{id}/refund", purpose: "Merchant refund; restores the limit" },
    { method: "GET", path: "/users/{id}/statement", purpose: "Dues, due dates and history" },
    { method: "POST", path: "/repayments", purpose: "Repay now" },
  ],

  estimates: [
    { label: "Users", value: "≈ 10 M with limits", derivation: "Assumption" },
    { label: "Checkouts", value: "≈ 2 M/day (~25/s, ~250/s at sales)", derivation: "Assumption" },
    { label: "Decision latency", value: "< 1 s", derivation: "Must not slow the merchant's checkout" },
    { label: "Ledger entries", value: "≈ 10 M/day", derivation: "Purchase, merchant payout, fees, repayments" },
  ],

  dataModel: [
    {
      entity: "Credit line",
      store: "Relational DB",
      key: "userId",
      fields: ["limit", "available", "status", "riskTier", "version"],
      why: "Available limit changes atomically with each purchase or repayment",
    },
    {
      entity: "Loan / transaction",
      store: "Relational DB",
      key: "transactionId",
      fields: ["userId", "merchantId", "amount", "instalments", "status"],
      why: "Lifecycle from purchase to closure",
    },
    {
      entity: "Ledger entry",
      store: "Relational DB (append-only)",
      key: "entryId",
      fields: ["account", "debit", "credit", "transactionId"],
      why: "Double-entry record of every movement",
    },
    {
      entity: "Repayment schedule",
      store: "Relational DB",
      key: "transactionId + instalmentNo",
      fields: ["dueDate", "amount", "status", "attempts"],
      why: "Drives auto-debits, reminders and late fees",
    },
  ],

  nodes: [
    { id: "checkout", kind: "web-client", label: "Merchant checkout", role: "Offers 'pay later' via the platform's SDK" },
    { id: "app", kind: "mobile-client", label: "User app", role: "Limits, statements, repayments" },
    { id: "gateway", kind: "api-gateway", label: "API gateway", role: "Merchant and user auth, rate limits" },
    { id: "identity", kind: "identity", label: "KYC & identity", role: "Onboarding, OTP login, document checks" },
    { id: "decision-svc", kind: "service", label: "Credit decision", role: "Eligibility and approval at checkout" },
    { id: "risk", kind: "ml-platform", label: "Risk & fraud models", role: "Scores users and transactions" },
    { id: "bureau", kind: "partner-api", label: "Credit bureau", role: "Credit history for new users" },
    { id: "credit-svc", kind: "service", label: "Credit & loans", role: "Limits, loans, refunds" },
    { id: "ledger", kind: "relational-db", label: "Ledger & credit lines", role: "Double-entry ledger and limits" },
    { id: "scheduler", kind: "workflow", label: "Repayment scheduler", role: "Due dates, auto-debit, retries, late fees" },
    { id: "payment-svc", kind: "service", label: "Payments", role: "Merchant settlement, auto-debit, collections" },
    { id: "psp", kind: "payments", label: "Banks & payment rails", role: "Mandates, UPI autopay, payouts" },
    { id: "events", kind: "event-stream", label: "Credit events", role: "Purchases, repayments, defaults" },
    { id: "notify", kind: "notifications", label: "SMS & push", role: "Due reminders, receipts" },
    { id: "warehouse", kind: "data-warehouse", label: "Risk analytics", role: "Portfolio and model training data" },
  ],

  edges: [
    { id: "checkout-gateway", from: "checkout", to: "gateway", label: "Eligibility / confirm" },
    { id: "app-gateway", from: "app", to: "gateway" },
    { id: "gateway-identity", from: "gateway", to: "identity" },
    { id: "gateway-decision", from: "gateway", to: "decision-svc", protocol: "grpc" },
    { id: "decision-risk", from: "decision-svc", to: "risk", label: "Score" },
    { id: "decision-bureau", from: "decision-svc", to: "bureau", label: "New users" },
    { id: "decision-credit", from: "decision-svc", to: "credit-svc", label: "Reserve limit", protocol: "grpc" },
    { id: "credit-ledger", from: "credit-svc", to: "ledger" },
    { id: "credit-events", from: "credit-svc", to: "events", protocol: "stream" },
    { id: "events-payment", from: "events", to: "payment-svc", label: "Settle merchant", protocol: "async" },
    { id: "payment-psp", from: "payment-svc", to: "psp" },
    { id: "payment-ledger", from: "payment-svc", to: "ledger" },
    { id: "events-scheduler", from: "events", to: "scheduler", label: "Create schedule", protocol: "async" },
    { id: "scheduler-payment", from: "scheduler", to: "payment-svc", label: "Auto-debit" },
    { id: "scheduler-notify", from: "scheduler", to: "notify", label: "Reminders" },
    { id: "events-warehouse", from: "events", to: "warehouse", protocol: "stream" },
  ],

  flows: [
    {
      id: "purchase",
      name: "Pay later at checkout",
      steps: [
        { edge: "checkout-gateway", text: "The shopper picks 'pay later' for ₹4,000; the merchant asks for eligibility." },
        { edge: "gateway-decision", text: "The credit decision service evaluates." },
        { edge: "decision-risk", text: "The risk model scores the user, device and basket in milliseconds." },
        { edge: "decision-credit", text: "₹4,000 is reserved against the user's available limit with a conditional update." },
        { edge: "credit-ledger", text: "On confirmation, the loan is booked: debit the user's receivable, credit the merchant's payable." },
        { edge: "credit-events", text: "A 'purchase' event is published." },
        { edge: "events-payment", text: "The merchant is settled (net of fees) in the next payout cycle." },
        { edge: "events-scheduler", text: "A repayment schedule is created." },
      ],
    },
    {
      id: "repay",
      name: "Repayment due",
      steps: [
        { edge: "scheduler-notify", text: "Reminders go out before the due date." },
        { edge: "scheduler-payment", text: "On the due date the scheduler triggers an auto-debit." },
        { edge: "payment-psp", text: "The bank mandate is charged." },
        { edge: "payment-ledger", text: "The repayment is posted and the user's limit restored. Failed debits are retried, then late fees apply." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Checkout latency",
      fix: "Pre-approved limits and cached risk features so most decisions skip external calls.",
      nodes: ["decision-svc", "risk", "bureau"],
    },
    {
      problem: "Concurrent purchases overspending a limit",
      fix: "Conditional update on available limit with a version check.",
      nodes: ["credit-svc", "ledger"],
    },
    {
      problem: "Failed auto-debits",
      fix: "Smart retries around payday, multiple mandates, and early reminders.",
      nodes: ["scheduler", "payment-svc"],
    },
  ],

  scaling: [
    "Shard credit lines and ledger by userId.",
    "Keep the decision path stateless with features precomputed in a feature store.",
    "Use the event stream so settlement, schedules and analytics scale separately.",
  ],

  extensions: [
    "EMI conversion of larger purchases.",
    "Credit-limit increases from repayment history.",
    "Co-lending with partner banks.",
  ],
};
