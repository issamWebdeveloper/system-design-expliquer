/*
 * Translations are written as "overlays": partial copies of an English content
 * object holding only the text that changes. Anything an overlay leaves out
 * falls back to English, so a translation can be filled in piece by piece.
 *
 * - Strings replace strings.
 * - Objects merge key by key.
 * - Arrays merge item by item (by position) when the overlay is an array; arrays
 *   of objects with an `id` (nodes, edges, flows) can instead take a record keyed
 *   by id, so translations don't depend on the order of items.
 */

type Primitive = string | number | boolean | null | undefined;

export type Overlay<T> = T extends Primitive
  ? T
  : T extends readonly (infer U)[]
    ? U extends { id: string }
      ? Record<string, Overlay<U>> | (Overlay<U> | undefined)[]
      : (Overlay<U> | undefined)[]
    : { [K in keyof T]?: Overlay<T[K]> };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function applyOverlay<T>(base: T, translation: NoInfer<Overlay<T>> | undefined): T {
  const overlay: unknown = translation;
  if (overlay === undefined || overlay === null) return base;

  if (Array.isArray(base)) {
    if (Array.isArray(overlay)) {
      return base.map((item, i) => applyOverlay(item, overlay[i])) as T;
    }
    if (isPlainObject(overlay)) {
      return base.map((item) =>
        isPlainObject(item) && typeof item.id === "string" ? applyOverlay(item, overlay[item.id] as never) : item,
      ) as T;
    }
    return base;
  }

  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      out[key] = key in base ? applyOverlay(base[key], value as never) : value;
    }
    return out as T;
  }

  return (typeof overlay === typeof base ? overlay : base) as T;
}
