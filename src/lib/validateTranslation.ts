import type { ComponentKind, Concept, SystemDesign } from "@/types/schema";
import type { ContentTranslation } from "@/content/translation";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Overlay text that points at nothing in the English content (a typo'd id, an extra flow step …). */
function orphans(base: unknown, overlay: unknown, path: string, out: string[]) {
  if (overlay === undefined || overlay === null) return;
  if (Array.isArray(base)) {
    if (Array.isArray(overlay)) {
      if (overlay.length > base.length) out.push(`${path}: ${overlay.length} items translated, English has ${base.length}`);
      overlay.forEach((item, i) => orphans(base[i], item, `${path}[${i}]`, out));
    } else if (isObject(overlay)) {
      for (const [id, item] of Object.entries(overlay)) {
        const match = base.find((b) => isObject(b) && b.id === id);
        if (!match) out.push(`${path}: no item with id "${id}"`);
        else orphans(match, item, `${path}.${id}`, out);
      }
    }
    return;
  }
  if (isObject(base) && isObject(overlay)) {
    for (const [key, value] of Object.entries(overlay)) {
      if (!(key in base) && !(isObject(value) || Array.isArray(value))) continue; // optional text the English omits
      if (!(key in base)) out.push(`${path}.${key}: not in the English content`);
      else orphans(base[key], value, `${path}.${key}`, out);
    }
  }
}

/* Fields that are identifiers, code or brand names, not prose: never translated, so not counted. */
const notProse = new Set([
  "id", "slug", "kind", "from", "to", "edge", "category", "family", "protocol", "method", "path", "visual",
  "group", "overrides", "concepts", "related", "key", "fields", "providers", "thirdParty",
]);

/** Counts English prose strings and how many of them a translation covers. */
function coverage(base: unknown, overlay: unknown): { total: number; done: number } {
  if (typeof base === "string") return { total: 1, done: typeof overlay === "string" ? 1 : 0 };
  const sum = (parts: { total: number; done: number }[]) =>
    parts.reduce((a, b) => ({ total: a.total + b.total, done: a.done + b.done }), { total: 0, done: 0 });
  if (Array.isArray(base)) {
    return sum(
      base.map((item, i) => {
        const o = Array.isArray(overlay)
          ? overlay[i]
          : isObject(overlay) && isObject(item)
            ? overlay[item.id as string]
            : undefined;
        return coverage(item, o);
      }),
    );
  }
  if (isObject(base)) {
    return sum(
      Object.entries(base)
        .filter(([k]) => !notProse.has(k))
        .map(([k, v]) => coverage(v, isObject(overlay) ? overlay[k] : undefined)),
    );
  }
  return { total: 0, done: 0 };
}

export function validateTranslation(
  label: string,
  translation: ContentTranslation,
  content: { components: ComponentKind[]; concepts: Concept[]; systems: SystemDesign[] },
) {
  const problems: string[] = [];
  const sections = [
    ["components", content.components, (c: ComponentKind) => c.id],
    ["concepts", content.concepts, (c: Concept) => c.slug],
    ["systems", content.systems, (s: SystemDesign) => s.slug],
  ] as const;

  const report: string[] = [];
  for (const [section, items, keyOf] of sections) {
    const overlays = (translation[section] ?? {}) as Record<string, unknown>;
    const byKey = new Map<string, unknown>((items as readonly unknown[]).map((item) => [keyOf(item as never), item]));
    for (const [key, overlay] of Object.entries(overlays)) {
      const base = byKey.get(key);
      if (!base) problems.push(`${label} ${section}: unknown "${key}"`);
      else orphans(base, overlay, `${label} ${section}.${key}`, problems);
    }
    let total = 0;
    let done = 0;
    for (const [key, base] of byKey) {
      const c = coverage(base, overlays[key]);
      total += c.total;
      done += c.done;
    }
    report.push(`${section} ${Math.round((done / Math.max(total, 1)) * 100)}%`);
  }
  return { problems, coverage: `${label}: ${report.join(", ")}` };
}
