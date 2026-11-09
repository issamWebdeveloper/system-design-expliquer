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
import type { Locale } from "@/i18n/config";
import { componentCatalogue } from "./components";
import { conceptFamilyBySlug, conceptInputs } from "./concepts";
import { conceptDiagrams } from "./conceptDiagrams";
import { systemInputs } from "./systems";
import { applyOverlay } from "./overlay";
import type { ContentLabels, ContentTranslation } from "./translation";
import { fr } from "./fr";

/* English source content, parsed with defaults applied. Throws at build time if a file is malformed. */
const baseComponents: ComponentKind[] = componentCatalogue.map((c) => componentKindSchema.parse(c));
const baseSystems: SystemDesign[] = systemInputs.map((s) => systemSchema.parse(s));
const baseConcepts: Concept[] = conceptInputs.map((c) =>
  conceptSchema.parse({ ...c, family: conceptFamilyBySlug[c.slug], ...conceptDiagrams[c.slug] }),
);

const enLabels: ContentLabels = {
  systemCategories: {
    "media-social": "Media & Social",
    mobility: "Mobility & Logistics",
    "commerce-fintech": "Commerce & Fintech",
    bookings: "Bookings & Marketplaces",
    infrastructure: "Building Blocks",
  },
  conceptFamilies: {
    data: "Data & storage",
    scale: "Scale & distribution",
    messaging: "Messaging & flow",
    reliability: "Reliability & correctness",
    security: "Security",
  },
  difficulty: { 1: "Beginner", 2: "Intermediate", 3: "Advanced" },
  componentCategories: {
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
  },
};

/** Everything a page needs to read content, in one language. */
export interface Content {
  locale: Locale;
  components: ComponentKind[];
  systems: SystemDesign[];
  concepts: Concept[];
  systemCategoryLabels: Record<SystemCategory, string>;
  conceptFamilyLabels: Record<ConceptFamily, string>;
  difficultyLabels: Record<1 | 2 | 3, string>;
  componentCategoryLabels: Record<ComponentCategory, string>;
  getComponentKind(id: string): ComponentKind | undefined;
  getSystem(slug: string): SystemDesign | undefined;
  getConcept(slug: string): Concept | undefined;
  /** Every place a component kind appears, for "Used in" lists. */
  usagesOfComponent(kindId: string): { system: SystemDesign; nodes: SystemNode[] }[];
  /** Wraps a concept's diagram as a minimal SystemDesign so the shared diagram engine can render it. */
  conceptDiagramSystem(concept: Concept): SystemDesign | null;
  systemsUsingConcept(slug: string): SystemDesign[];
  componentsUsingConcept(slug: string): ComponentKind[];
}

function buildContent(locale: Locale, translation?: ContentTranslation): Content {
  const components = baseComponents.map((c) => applyOverlay(c, translation?.components?.[c.id]));
  const systems = baseSystems.map((s) => applyOverlay(s, translation?.systems?.[s.slug]));
  const concepts = baseConcepts
    .map((c) => applyOverlay(c, translation?.concepts?.[c.slug]))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const labels = applyOverlay(enLabels, translation?.labels);

  const componentsById = new Map(components.map((c) => [c.id, c]));
  const systemsBySlug = new Map(systems.map((s) => [s.slug, s]));
  const conceptsBySlug = new Map(concepts.map((c) => [c.slug, c]));

  return {
    locale,
    components,
    systems,
    concepts,
    systemCategoryLabels: labels.systemCategories,
    conceptFamilyLabels: labels.conceptFamilies,
    difficultyLabels: labels.difficulty,
    componentCategoryLabels: labels.componentCategories,
    getComponentKind: (id) => componentsById.get(id),
    getSystem: (slug) => systemsBySlug.get(slug),
    getConcept: (slug) => conceptsBySlug.get(slug),
    usagesOfComponent: (kindId) =>
      systems
        .map((system) => ({ system, nodes: system.nodes.filter((n) => n.kind === kindId) }))
        .filter((u) => u.nodes.length > 0),
    conceptDiagramSystem: (concept) => {
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
    },
    systemsUsingConcept: (slug) => systems.filter((s) => s.concepts.includes(slug)),
    componentsUsingConcept: (slug) => components.filter((c) => c.concepts.includes(slug)),
  };
}

const contentByLocale: Record<Locale, Content> = {
  en: buildContent("en"),
  fr: buildContent("fr", fr),
};

/** Content in the given language; untranslated text falls back to English. */
export function getContent(locale: Locale): Content {
  return contentByLocale[locale];
}

/* English shortcuts (the source language), kept for scripts and existing imports. */
const en = contentByLocale.en;
export const components = en.components;
export const systems = en.systems;
export const concepts = en.concepts;
export const systemCategoryLabels = en.systemCategoryLabels;
export const conceptFamilyLabels = en.conceptFamilyLabels;
export const difficultyLabels = en.difficultyLabels;
export const componentCategoryLabels = en.componentCategoryLabels;
export const getComponentKind = en.getComponentKind;
export const getSystem = en.getSystem;
export const getConcept = en.getConcept;
export const usagesOfComponent = en.usagesOfComponent;
export const conceptDiagramSystem = en.conceptDiagramSystem;
export const systemsUsingConcept = en.systemsUsingConcept;
export const componentsUsingConcept = en.componentsUsingConcept;
