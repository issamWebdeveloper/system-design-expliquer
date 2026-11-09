import { components, concepts, getComponentKind, getConcept, systemCategoryLabels, systems } from "@/content";
import type { SearchItem } from "./search-match";

/** Built on the server and handed to the client palette as plain data. */
export function buildSearchIndex(): SearchItem[] {
  const systemItems = systems.map((s) => ({
    type: "System" as const,
    title: s.name,
    subtitle: s.tagline,
    href: `/systems/${s.slug}`,
    keywords: [
      s.description,
      systemCategoryLabels[s.category],
      ...s.concepts.map((c) => getConcept(c)?.name ?? c),
      ...[...new Set(s.nodes.map((n) => getComponentKind(n.kind)?.name ?? n.kind))],
    ].join(" "),
  }));

  const componentItems = components.map((c) => ({
    type: "Component" as const,
    title: c.name,
    subtitle: c.what,
    href: `/components/${c.id}`,
    keywords: [
      ...Object.values(c.providers).flatMap((options) => options?.map((o) => o.name) ?? []),
      ...c.thirdParty.map((o) => o.name),
    ].join(" "),
  }));

  const conceptItems = concepts.map((c) => ({
    type: "Concept" as const,
    title: c.name,
    subtitle: c.summary,
    href: `/concepts/${c.slug}`,
    keywords: [...c.explanation, ...c.related].join(" "),
  }));

  return [...systemItems, ...componentItems, ...conceptItems];
}
