import type { ComponentKind, Concept, Flow, SystemDesign, SystemEdge, SystemNode } from "@/types/schema";

/** Cross-reference checks the schemas can't express. Returns human-readable problems. */
export function validateContent(
  components: ComponentKind[],
  systems: SystemDesign[],
  concepts: Concept[],
): string[] {
  const problems: string[] = [];
  const kindIds = new Set<string>();
  const conceptSlugs = new Set<string>();

  for (const c of concepts) {
    if (conceptSlugs.has(c.slug)) problems.push(`concept "${c.slug}" is defined twice`);
    conceptSlugs.add(c.slug);
  }
  for (const c of concepts) {
    for (const r of c.related) {
      if (!conceptSlugs.has(r)) problems.push(`concept "${c.slug}" links to unknown concept "${r}"`);
    }
  }

  for (const c of components) {
    if (kindIds.has(c.id)) problems.push(`component "${c.id}" is defined twice`);
    kindIds.add(c.id);
    if (c.category !== "client" && Object.keys(c.providers).length === 0 && c.thirdParty.length === 0) {
      problems.push(`component "${c.id}" has no provider or third-party options`);
    }
    for (const r of c.concepts) {
      if (!conceptSlugs.has(r)) problems.push(`component "${c.id}" links to unknown concept "${r}"`);
    }
  }

  const slugs = new Set<string>();
  for (const s of systems) {
    const at = `system "${s.slug}"`;
    if (slugs.has(s.slug)) problems.push(`${at} is defined twice`);
    slugs.add(s.slug);
    for (const r of s.concepts) {
      if (!conceptSlugs.has(r)) problems.push(`${at} links to unknown concept "${r}"`);
    }

    const nodeIds = checkGraph(at, s.nodes, s.edges, s.flows, kindIds, problems);

    for (const b of s.bottlenecks) {
      for (const id of b.nodes) {
        if (!nodeIds.has(id)) problems.push(`${at}: bottleneck "${b.problem}" references unknown node "${id}"`);
      }
    }
  }

  for (const c of concepts) {
    if (c.diagram) checkGraph(`concept "${c.slug}" diagram`, c.diagram.nodes, c.diagram.edges, c.diagram.flows, kindIds, problems);
  }

  return problems;
}

/** Shared structural checks for any diagram: unique ids, known kinds, edges and flow steps that resolve. */
function checkGraph(
  at: string,
  nodes: SystemNode[],
  edges: SystemEdge[],
  flows: Flow[],
  kindIds: Set<string>,
  problems: string[],
): Set<string> {
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (nodeIds.has(n.id)) problems.push(`${at}: node "${n.id}" is defined twice`);
    nodeIds.add(n.id);
    if (!kindIds.has(n.kind)) problems.push(`${at}: node "${n.id}" uses unknown kind "${n.kind}"`);
  }

  const edgeIds = new Set<string>();
  for (const e of edges) {
    if (edgeIds.has(e.id)) problems.push(`${at}: edge "${e.id}" is defined twice`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from)) problems.push(`${at}: edge "${e.id}" starts at unknown node "${e.from}"`);
    if (!nodeIds.has(e.to)) problems.push(`${at}: edge "${e.id}" ends at unknown node "${e.to}"`);
  }

  for (const f of flows) {
    for (const step of f.steps) {
      if (!edgeIds.has(step.edge)) problems.push(`${at}: flow "${f.id}" references unknown edge "${step.edge}"`);
    }
  }
  return nodeIds;
}
