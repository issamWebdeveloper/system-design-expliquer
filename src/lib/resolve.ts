import type { ComponentCategory, ComponentKind, Provider, SystemNode } from "@/types/schema";

export interface ResolvedService {
  /** Text shown on the diagram node. */
  label: string;
  /** True when the label came from the catalogue or an override rather than the node's own label. */
  mapped: boolean;
}

export function resolveService(
  node: SystemNode,
  kind: ComponentKind | undefined,
  provider: Provider,
): ResolvedService {
  if (provider === "generic") return { label: node.label, mapped: false };

  const override = node.overrides?.[provider];
  if (override) return { label: override, mapped: true };

  const service = kind?.providers[provider]?.[0];
  if (service) return { label: service.name, mapped: true };

  return { label: node.label, mapped: false };
}

export const categoryColors: Record<ComponentCategory, string> = {
  client: "#6366f1",
  edge: "#0ea5e9",
  compute: "#22c55e",
  storage: "#f59e0b",
  database: "#ec4899",
  cache: "#ef4444",
  messaging: "#a855f7",
  analytics: "#14b8a6",
  ml: "#eab308",
  security: "#64748b",
  ops: "#78716c",
  external: "#f97316",
};

export function getCategoryColor(category: ComponentCategory | undefined): string {
  return (category && categoryColors[category]) ?? "#64748b";
}
