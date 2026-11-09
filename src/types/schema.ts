import { z } from "zod";

/* Providers ---------------------------------------------------------------- */

export const providerIds = ["generic", "aws", "gcp", "azure", "oss"] as const;
export const providerSchema = z.enum(providerIds);
export type Provider = z.infer<typeof providerSchema>;

/** Providers that map a component kind to concrete services. */
export type ServiceProvider = Exclude<Provider, "generic">;

/* Component catalogue ------------------------------------------------------ */

export const componentCategories = [
  "client",
  "edge",
  "compute",
  "storage",
  "database",
  "cache",
  "messaging",
  "analytics",
  "ml",
  "security",
  "ops",
  "external",
] as const;
export const componentCategorySchema = z.enum(componentCategories);
export type ComponentCategory = z.infer<typeof componentCategorySchema>;

export const serviceOptionSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
  managed: z.boolean(),
});
export type ServiceOption = z.infer<typeof serviceOptionSchema>;

const serviceOptions = z.array(serviceOptionSchema).min(1);

export const componentKindSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  category: componentCategorySchema,
  what: z.string().min(1),
  whenToUse: z.array(z.string()).default([]),
  pitfalls: z.array(z.string()).default([]),
  /** First option per provider is the default shown on the diagram. */
  providers: z
    .object({
      aws: serviceOptions,
      gcp: serviceOptions,
      azure: serviceOptions,
      oss: serviceOptions,
    })
    .partial(),
  /** Third-party SaaS that works with any cloud (Cloudflare, Stripe, Twilio …). */
  thirdParty: z.array(serviceOptionSchema).default([]),
  concepts: z.array(z.string()).default([]),
});
export type ComponentKind = z.infer<typeof componentKindSchema>;
export type ComponentKindInput = z.input<typeof componentKindSchema>;

/* System designs ----------------------------------------------------------- */

export const systemCategories = [
  "media-social",
  "mobility",
  "commerce-fintech",
  "bookings",
  "infrastructure",
] as const;
export const systemCategorySchema = z.enum(systemCategories);
export type SystemCategory = z.infer<typeof systemCategorySchema>;

export const nodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  label: z.string().min(1),
  /** What this component does in this particular system. */
  role: z.string().min(1),
  /** Replace the catalogue's default service name for a provider. */
  overrides: z.partialRecord(providerSchema, z.string()).optional(),
  group: z.string().optional(),
});
export type SystemNode = z.infer<typeof nodeSchema>;

export const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  protocol: z.enum(["https", "grpc", "ws", "async", "cdc", "stream"]).optional(),
});
export type SystemEdge = z.infer<typeof edgeSchema>;

/** A named, step-by-step path through a diagram; each step highlights one edge. */
export const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(z.object({ edge: z.string(), text: z.string() })).min(1),
});
export type Flow = z.infer<typeof flowSchema>;

export const systemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  category: systemCategorySchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Concept slugs this design demonstrates. */
  concepts: z.array(z.string()).default([]),
  requirements: z
    .object({ functional: z.array(z.string()), nonFunctional: z.array(z.string()) })
    .default({ functional: [], nonFunctional: [] }),
  apis: z
    .array(
      z.object({
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "WS", "GRPC"]),
        path: z.string(),
        purpose: z.string(),
      }),
    )
    .default([]),
  estimates: z
    .array(z.object({ label: z.string(), value: z.string(), derivation: z.string().optional() }))
    .default([]),
  dataModel: z
    .array(
      z.object({
        entity: z.string(),
        store: z.string(),
        key: z.string(),
        fields: z.array(z.string()),
        why: z.string(),
      }),
    )
    .default([]),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
  flows: z.array(flowSchema).default([]),
  bottlenecks: z
    .array(z.object({ problem: z.string(), fix: z.string(), nodes: z.array(z.string()) }))
    .default([]),
  scaling: z.array(z.string()).default([]),
  extensions: z.array(z.string()).default([]),
});
export type SystemDesign = z.infer<typeof systemSchema>;
/** Shape content files are written in (optional sections may be omitted). */
export type SystemDesignInput = z.input<typeof systemSchema>;

/* Concepts ----------------------------------------------------------------- */

export const conceptFamilies = ["data", "scale", "messaging", "reliability", "security"] as const;
export type ConceptFamily = (typeof conceptFamilies)[number];

export const conceptVisuals = [
  "hash-ring",
  "bloom-filter",
  "token-bucket",
  "prefix-trie",
  "snowflake-id",
  "geo-grid",
  "ledger-table",
] as const;
export type ConceptVisual = (typeof conceptVisuals)[number];

export const conceptSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** One or two sentences shown on cards and in search. */
  summary: z.string().min(1),
  explanation: z.array(z.string()).min(1),
  howItWorks: z.array(z.string()).default([]),
  tradeoffs: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  /** Colour family used for the concept's identity on cards and pages. */
  family: z.enum(conceptFamilies),
  /** A small architecture showing the concept in action, with step-through flows. */
  diagram: z
    .object({
      nodes: z.array(nodeSchema).min(2),
      edges: z.array(edgeSchema).min(1),
      flows: z.array(flowSchema).default([]),
    })
    .optional(),
  /** A bespoke interactive illustration shown above the diagram. */
  visual: z.enum(conceptVisuals).optional(),
});
export type Concept = z.infer<typeof conceptSchema>;
export type ConceptInput = z.input<typeof conceptSchema>;
