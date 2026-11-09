import {
  componentKindSchema,
  conceptSchema,
  systemSchema,
  type ComponentCategory,
  type ConceptFamily,
  type ComponentKind,
  type Concept,
  type SystemCategory,
  type SystemDesign,
  type SystemNode,
} from "@/types/schema";
import { componentCatalogue } from "./components";
import { conceptFamilyBySlug, conceptInputs } from "./concepts";
import { conceptDiagrams } from "./conceptDiagrams";
import { systemInputs } from "./systems";

/** Parsed content with defaults applied. Throws at build time if a file is malformed. */
export const components: ComponentKind[] = componentCatalogue.map((c) => componentKindSchema.parse(c));
export const systems: SystemDesign[] = systemInputs.map((s) => systemSchema.parse(s));
export const concepts: Concept[] = conceptInputs
  .map((c) => conceptSchema.parse({ ...c, family: conceptFamilyBySlug[c.slug], ...conceptDiagrams[c.slug] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const componentsById = new Map(components.map((c) => [c.id, c]));
const conceptsBySlug = new Map(concepts.map((c) => [c.slug, c]));

export function getComponentKind(id: string): ComponentKind | undefined {
  return componentsById.get(id);
}

export function getSystem(slug: string): SystemDesign | undefined {
  return systems.find((s) => s.slug === slug);
}

export function getConcept(slug: string): Concept | undefined {
  return conceptsBySlug.get(slug);
}

/** Every place a component kind appears, for "Used in" lists. */
export function usagesOfComponent(kindId: string): { system: SystemDesign; nodes: SystemNode[] }[] {
  return systems
    .map((system) => ({ system, nodes: system.nodes.filter((n) => n.kind === kindId) }))
    .filter((u) => u.nodes.length > 0);
}

/** Wraps a concept's diagram as a minimal SystemDesign so the shared diagram engine can render it. */
export function conceptDiagramSystem(concept: Concept): SystemDesign | null {
  if (!concept.diagram) return null;
  return {
    slug: `concept-${concept.slug}`,
    name: concept.name,
    tagline: concept.summary,
    description: concept.summary,
    category: "infrastructure",
    difficulty: 1,
    concepts: [],
    requirements: { functional: [], nonFunctional: [] },
    apis: [],
    estimates: [],
    dataModel: [],
    nodes: concept.diagram.nodes,
    edges: concept.diagram.edges,
    flows: concept.diagram.flows,
    bottlenecks: [],
    scaling: [],
    extensions: [],
  };
}

export function systemsUsingConcept(slug: string): SystemDesign[] {
  return systems.filter((s) => s.concepts.includes(slug));
}

export function componentsUsingConcept(slug: string): ComponentKind[] {
  return components.filter((c) => c.concepts.includes(slug));
}

export const systemCategoryLabels: Record<SystemCategory, string> = {
  "media-social": "Media & Social",
  mobility: "Mobility & Logistics",
  "commerce-fintech": "Commerce & Fintech",
  bookings: "Bookings & Marketplaces",
  infrastructure: "Building Blocks",
};

export const conceptFamilyLabels: Record<ConceptFamily, string> = {
  data: "Data & storage",
  scale: "Scale & distribution",
  messaging: "Messaging & flow",
  reliability: "Reliability & correctness",
  security: "Security",
};

export const difficultyLabels = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" } as const;

export const componentCategoryLabels: Record<ComponentCategory, string> = {
  client: "Clients",
  edge: "Edge & networking",
  security: "Security & identity",
  compute: "Compute",
  messaging: "Messaging",
  storage: "Storage",
  database: "Databases & search",
  cache: "Caching",
  analytics: "Analytics & processing",
  ml: "Machine learning",
  ops: "Operations",
  external: "External services",
};
