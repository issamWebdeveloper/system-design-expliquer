import type {
  ComponentCategory,
  ComponentKind,
  Concept,
  ConceptFamily,
  SystemCategory,
  SystemDesign,
} from "@/types/schema";
import type { Overlay } from "./overlay";

export interface ContentLabels {
  systemCategories: Record<SystemCategory, string>;
  conceptFamilies: Record<ConceptFamily, string>;
  difficulty: Record<1 | 2 | 3, string>;
  componentCategories: Record<ComponentCategory, string>;
}

/** A translation of the content: overlays keyed by component id, concept slug and system slug. */
export interface ContentTranslation {
  labels?: Overlay<ContentLabels>;
  components?: Record<string, Overlay<ComponentKind>>;
  concepts?: Record<string, Overlay<Concept>>;
  systems?: Record<string, Overlay<SystemDesign>>;
}
