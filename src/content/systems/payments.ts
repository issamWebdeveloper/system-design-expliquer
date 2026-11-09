import type { SystemDesignInput } from "@/types/schema";

export const payments: SystemDesignInput = {
  slug: "payments",
  name: "Payment gateway",
  tagline: "Stripe-style card payments with an exactly-once ledger",
  description:
    "Merchants call one API to charge a customer. Card numbers go straight from the browser into a locked-down vault and are replaced by tokens, so almost nothing else touches sensitive data. Each payment is recorded before anything external happens, checked for fraud, routed to an acquiring bank, and written to a double-entry ledger. Idempotency keys make every retry safe, and nightly reconciliation proves the books match the banks.",
  category: "commerce-fintech",
  difficulty: 3,
  concepts: ["idempotency", "ledger", "event-driven", "authentication", "sharding"],

  requirements: {
    functional: [
      "Authorise and capture payments by card, wallet, UPI or bank transfer — in one step or two",
      "Full and partial refunds; handle chargebacks and disputes",
      "Store cards as reusable tokens for repeat and subscription payments",
      "Notify merchants of every status change via webhooks",
      "Daily settlement to merchants and reconciliation with banks",
    ],
    nonFunctional: [
      "Exactly-once money movement: a retry must never double-charge",
      "Strong consistency for balances and transaction state",
      "PCI DSS compliance: raw card data only inside an isolated vault",
      "99.99%+ availability; authorisation in a few seconds",
      "Every change auditable and immutable",
    ],
  },

  apis: [
    { method: "POST", path: "/v1/payments", purpose: "Create (and optionally capture) a payment; requires an Idempotency-Key header" },
    { method: "POST", path: "/v1/payments/{id}/capture", purpose: "Capture a previously authorised amount" },
    { method: "POST", path: "/v1/refunds", purpose: "Refund all or part of a captured payment" },
    { method: "GET", path: "/v1/payments/{id}", purpose: "Payment status and history" },
    { method: "POST", path: "/v1/tokens", purpose: "Called by the browser SDK: exchange card details for a token" },
    { method: "POST", path: "{merchant webhook URL}", purpose: "Signed event sent to the merchant (payment.succeeded, refund.created …)" },
  ],

  estimates: [
    { label: "Payments", value: "≈ 50 M/day (~600/s)", derivation: "Assumption; peak shopping days 10× (~6 k/s)" },
    { label: "Ledger entries", value: "≈ 200 M/day", derivation: "Each payment posts 2–4 balanced debit/credit entries" },
    { label: "Transaction storage", value: "≈ 50 GB/day", derivation: "50 M × ~1 KB including history; kept for years for audit" },
    { label: "Authorisation latency", value: "1–3 s", derivation: "Dominated by the card network and issuer; our own path must add < 100 ms" },
    { label: "Webhooks", value: "≈ 150 M/day", derivation: "~3 events per payment, retried with backoff" },
  ],

  dataModel: [
    {
      entity: "Payment",
      store: "Relational DB",
      key: "paymentId",
      fields: ["merchantId", "amount", "currency", "status", "methodToken", "processorRef", "idempotencyKey", "createdAt"],
      why: "A state machine (PENDING → AUTHORIZED → CAPTURED / FAILED / REFUNDED) that needs transactions",
    },
    {
      entity: "Ledger entry",
      store: "Relational DB (append-only)",
      key: "entryId",
      fields: ["transactionId", "account", "debit", "credit", "currency", "postedAt"],
      why: "Double-entry: every transaction's entries sum to zero, so money can't appear or vanish",
    },
    {
      entity: "Idempotency key",
      store: "Cache + relational DB",
      key: "merchantId + key",
      fields: ["requestHash", "response", "expiresAt"],
      why: "A retried request returns the original response instead of charging again",
    },
    {
      entity: "Card token",
      store: "Vault (encrypted, PCI zone)",
      key: "token",
      fields: ["encrypted PAN", "expiry", "fingerprint", "last4"],
      why: "Keeps raw card numbers out of every other system",
    },
    {
      entity: "Refund / Dispute",
      store: "Relational DB",
      key: "refundId / disputeId",
      fields: ["paymentId", "amount", "status", "reason"],
      why: "Linked to the original payment and posted to the ledger",
    },
  ],

  nodes: [
    { id: "checkout", kind: "web-client", label: "Merchant checkout page", role: "Collects card details with the gateway's SDK" },
    { id: "merchant", kind: "web-client", label: "Merchant backend", role: "Creates payments with a secret API key and receives webhooks" },
    { id: "gateway", kind: "api-gateway", label: "Public API", role: "API-key auth, rate limits, request validation" },
    { id: "idempotency", kind: "cache", label: "Idempotency store", role: "Remembers each request key and its response" },
    { id: "payment-svc", kind: "service", label: "Payment service", role: "Runs the payment state machine" },
    { id: "risk", kind: "ml-platform", label: "Risk engine", role: "Scores each payment for fraud; may block or require 3-D Secure" },
    { id: "router", kind: "service", label: "Processor router", role: "Picks an acquirer and translates to its protocol" },
    { id: "vault", kind: "service", label: "Card vault", role: "Tokenises and detokenises card numbers inside the PCI zone" },
    { id: "kms", kind: "secrets", label: "HSM / key management", role: "Encryption keys for card data" },
    { id: "ledger-svc", kind: "service", label: "Ledger service", role: "Posts balanced double-entry records" },
    { id: "webhook-svc", kind: "service", label: "Webhook dispatcher", role: "Delivers signed events with retries" },
    { id: "events", kind: "event-stream", label: "Payment events", role: "Every status change, in order per payment" },
    { id: "recon", kind: "batch-processing", label: "Reconciliation & settlement", role: "Matches bank reports to the ledger; schedules payouts" },
    { id: "txn-db", kind: "relational-db", label: "Transactions", role: "Payments, refunds and disputes" },
    { id: "ledger-db", kind: "relational-db", label: "Ledger", role: "Append-only double-entry journal" },
    { id: "acquirer", kind: "payments", label: "Acquirers & card networks", role: "Banks and schemes that move the money" },
  ],

  edges: [
    { id: "checkout-vault", from: "checkout", to: "vault", label: "Card → token" },
    { id: "merchant-gateway", from: "merchant", to: "gateway", label: "Create payment" },
    { id: "gateway-idempotency", from: "gateway", to: "idempotency", label: "Seen this key?" },
    { id: "gateway-payment", from: "gateway", to: "payment-svc", protocol: "grpc" },
    { id: "payment-db", from: "payment-svc", to: "txn-db", label: "State changes" },
    { id: "payment-risk", from: "payment-svc", to: "risk", label: "Score", protocol: "grpc" },
    { id: "payment-router", from: "payment-svc", to: "router", label: "Authorise", protocol: "grpc" },
    { id: "router-vault", from: "router", to: "vault", label: "Detokenise", protocol: "grpc" },
    { id: "vault-kms", from: "vault", to: "kms" },
    { id: "router-acquirer", from: "router", to: "acquirer", label: "ISO 8583 / API" },
    { id: "payment-events", from: "payment-svc", to: "events", protocol: "stream" },
    { id: "events-ledger", from: "events", to: "ledger-svc", protocol: "async" },
    { id: "ledger-db-write", from: "ledger-svc", to: "ledger-db" },
    { id: "events-webhook", from: "events", to: "webhook-svc", protocol: "async" },
    { id: "webhook-merchant", from: "webhook-svc", to: "merchant", label: "Signed webhook" },
    { id: "acquirer-recon", from: "acquirer", to: "recon", label: "Settlement reports" },
    { id: "recon-ledger", from: "recon", to: "ledger-db", label: "Match & payout" },
  ],

  flows: [
    {
      id: "charge",
      name: "Charge a card",
      steps: [
        { edge: "checkout-vault", text: "The customer's card goes straight from the browser to the vault and comes back as a token. The merchant never sees the number." },
        { edge: "merchant-gateway", text: "The merchant's server creates a payment with the token, the amount and an idempotency key." },
        { edge: "gateway-idempotency", text: "If the key was seen before, the original response is returned — no second charge." },
        { edge: "gateway-payment", text: "Otherwise the payment service takes over." },
        { edge: "payment-db", text: "It records the payment as PENDING before calling anyone else." },
        { edge: "payment-risk", text: "The risk engine scores it; high-risk payments are blocked or challenged." },
        { edge: "payment-router", text: "The router picks the best acquirer for this card and currency." },
        { edge: "router-vault", text: "Inside the PCI zone the token is swapped back for the card number." },
        { edge: "router-acquirer", text: "The authorisation goes through the card network to the issuing bank, which approves or declines." },
        { edge: "payment-db", text: "The result is saved: CAPTURED or FAILED." },
        { edge: "payment-events", text: "A status event is published." },
      ],
    },
    {
      id: "after",
      name: "Ledger and webhooks",
      steps: [
        { edge: "payment-events", text: "The 'payment captured' event is published once, in order." },
        { edge: "events-ledger", text: "The ledger service consumes it (deduplicating by paymentId)." },
        { edge: "ledger-db-write", text: "It posts balanced entries: debit the customer's funding account, credit the merchant's balance and fee revenue." },
        { edge: "events-webhook", text: "The webhook dispatcher picks up the same event." },
        { edge: "webhook-merchant", text: "The merchant gets a signed webhook; failed deliveries are retried with backoff." },
      ],
    },
    {
      id: "recon",
      name: "Nightly reconciliation",
      steps: [
        { edge: "acquirer-recon", text: "Acquirers send settlement files listing what actually moved." },
        { edge: "recon-ledger", text: "Every line is matched to the ledger; mismatches are flagged for investigation and merchant payouts are scheduled." },
      ],
    },
  ],

  bottlenecks: [
    {
      problem: "Retries and timeouts causing double charges",
      fix: "Idempotency keys at the API, a unique constraint on (merchant, key), and processor calls that reuse the same reference.",
      nodes: ["gateway", "idempotency", "payment-svc"],
    },
    {
      problem: "Unknown outcome when the bank call times out",
      fix: "Keep the payment PENDING, query the processor for the result, and never assume failure; reconciliation catches anything left.",
      nodes: ["router", "acquirer", "recon"],
    },
    {
      problem: "Ledger writes becoming a hotspot for large merchants",
      fix: "Append-only entries partitioned by account; compute balances from entries plus periodic snapshots.",
      nodes: ["ledger-svc", "ledger-db"],
    },
    {
      problem: "One acquirer slowing down or failing",
      fix: "Circuit breakers per acquirer and automatic routing to a healthy backup.",
      nodes: ["router", "acquirer"],
    },
    {
      problem: "Sensitive card data spreading through the system",
      fix: "Tokenise at the edge; only the vault (with HSM-held keys) can see card numbers, which keeps PCI scope small.",
      nodes: ["vault", "kms"],
    },
  ],

  scaling: [
    "Shard transactions and ledger by merchantId; keep each payment's history on one shard.",
    "Stateless API and payment services scale horizontally; state lives in the database.",
    "Use the event stream (with an outbox table) so DB writes and published events never disagree.",
    "Synchronous replication within a region for the transaction DB; asynchronous DR replicas in another region.",
    "Keep the vault small, isolated and separately scaled.",
  ],

  extensions: [
    "Subscriptions and recurring billing with retries for failed renewals.",
    "Wallets and peer-to-peer transfers (PayPal, PhonePe style) on the same ledger.",
    "Buy-now-pay-later credit with risk scoring.",
    "Multi-currency with FX conversion at capture time.",
    "A dispute workflow with evidence uploads.",
  ],
};
