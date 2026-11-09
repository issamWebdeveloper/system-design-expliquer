"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { TierNodeData } from "@/lib/transformDiagram";
import { tierHues, type TierId } from "@/lib/layout";
import { useMessages } from "@/i18n/client";

/** A horizontal swimlane behind one tier of components. */
function TierNodeComponent({ data }: NodeProps) {
  const { tier } = data as TierNodeData;
  const label = useMessages().diagram.tiers[tier as TierId] ?? tier;
  const hue = tierHues[tier as TierId] ?? "#64748b";

  return (
    <div
      className="pointer-events-none h-full w-full rounded-2xl border-l-[3px]"
      style={{
        background: `color-mix(in srgb, ${hue} 7%, transparent)`,
        borderLeftColor: `color-mix(in srgb, ${hue} 55%, transparent)`,
      }}
    >
      <p className="flex items-center gap-1.5 px-4 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} aria-hidden />
        {label}
      </p>
    </div>
  );
}

export default memo(TierNodeComponent);
