"use client";

import { useSearchParams } from "next/navigation";
import NodeDetailPanel from "@/components/NodeDetailPanel";
import { providerSchema, type Provider, type SystemDesign } from "@/types/schema";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { updateSearchParams } from "@/lib/url";

/** On wide screens, component details open over the details panel instead of the diagram. */
export default function NodeSheet({ system }: { system: SystemDesign }) {
  const searchParams = useSearchParams();
  const isWide = useMediaQuery("(min-width: 1024px)");

  const nodeId = searchParams.get("node");
  if (!isWide || !nodeId || !system.nodes.some((n) => n.id === nodeId)) return null;

  const parsed = providerSchema.safeParse(searchParams.get("cloud"));
  const provider: Provider = parsed.success ? parsed.data : "generic";

  return (
    <div className="absolute inset-0 z-10 bg-surface">
      <NodeDetailPanel
        nodeId={nodeId}
        system={system}
        provider={provider}
        variant="sheet"
        onClose={() => updateSearchParams({ node: null })}
      />
    </div>
  );
}
