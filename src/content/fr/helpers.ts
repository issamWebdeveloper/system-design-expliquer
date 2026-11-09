/*
 * Compact builders for translation overlays, so translation files read like
 * the English text they replace instead of nested objects.
 */

/** Nodes: id → [label, role] (use undefined to keep the English label). */
export function nodes(entries: Record<string, [string | undefined, string]>) {
  return Object.fromEntries(Object.entries(entries).map(([id, [label, role]]) => [id, { label, role }]));
}

/** Edges: id → label. */
export function edges(entries: Record<string, string>) {
  return Object.fromEntries(Object.entries(entries).map(([id, label]) => [id, { label }]));
}

/** Flows: id → [name, ...step texts in order]. */
export function flows(entries: Record<string, [string, ...string[]]>) {
  return Object.fromEntries(
    Object.entries(entries).map(([id, [name, ...steps]]) => [id, { name, steps: steps.map((text) => ({ text })) }]),
  );
}

/** A concept's mini-architecture: nodes, edge labels and flows. */
export function diagram(
  n: Parameters<typeof nodes>[0],
  e: Parameters<typeof edges>[0],
  f: Parameters<typeof flows>[0],
) {
  return { nodes: nodes(n), edges: edges(e), flows: flows(f) };
}

/** API purposes, in the order the English lists them. */
export function apis(...purposes: string[]) {
  return purposes.map((purpose) => ({ purpose }));
}

/** Capacity estimates: [label, value, derivation?], in order. */
export function estimates(...rows: [string, string, string?][]) {
  return rows.map(([label, value, derivation]) => ({ label, value, ...(derivation ? { derivation } : {}) }));
}

/** Data model: [entity, store, why], in order (keys and field names stay as in the English). */
export function dataModel(...rows: [string, string, string][]) {
  return rows.map(([entity, store, why]) => ({ entity, store, why }));
}

/** Bottlenecks: [problem, fix], in order. */
export function bottlenecks(...rows: [string, string][]) {
  return rows.map(([problem, fix]) => ({ problem, fix }));
}
