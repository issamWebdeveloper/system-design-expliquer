"use client";

import type { Provider, SystemDesign } from "@/types/schema";
import { getComponentKind } from "@/content";
import { getCategoryColor, resolveService } from "@/lib/resolve";
import { tierOf, tiers } from "@/lib/layout";
import { KindIcon } from "@/lib/icons";

/**
 * Phone-sized alternative to the diagram: the same components grouped by tier,
 * top to bottom, with walkthrough steps highlighted.
 */
export default function TierList({
  system,
  provider,
  selectedNodeId,
  activeNodeIds,
  onNodeSelect,
}: {
  system: SystemDesign;
  provider: Provider;
  selectedNodeId: string | null;
  /** Nodes touched by the current walkthrough step. */
  activeNodeIds: Set<string>;
  onNodeSelect: (nodeId: string) => void;
}) {
  const groups = tiers
    .map((tier) => ({
      tier,
      nodes: system.nodes.filter((n) => tierOf(getComponentKind(n.kind)?.category) === tier.id),
    }))
    .filter((g) => g.nodes.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ tier, nodes }) => (
        <section key={tier.id}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">{tier.label}</h3>
          <ul className="space-y-1.5">
            {nodes.map((node) => {
              const kind = getComponentKind(node.kind);
              const resolved = resolveService(node, kind, provider);
              const color = getCategoryColor(kind?.category);
              const inStep = activeNodeIds.has(node.id);
              const selected = node.id === selectedNodeId;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onNodeSelect(node.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      inStep
                        ? "border-amber-400 bg-amber-500/10"
                        : selected
                          ? "border-fg bg-surface"
                          : "border-line bg-surface/60 hover:border-line-strong"
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}26`, color }}
                      aria-hidden
                    >
                      <KindIcon kindId={node.kind} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{resolved.label}</span>
                      <span className="block truncate text-xs text-muted">
                        {resolved.mapped ? `${node.label} · ` : ""}
                        {node.role}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
