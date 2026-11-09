"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export interface PacketEdgeData extends Record<string, unknown> {
  /** The current walkthrough step: a packet travels along the edge. */
  packet?: boolean;
  packetColor?: string;
}

/** A smoothstep edge that can carry a moving packet dot for the active walkthrough step. */
function PacketEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  ...props
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const { packet, packetColor } = (data ?? {}) as PacketEdgeData;

  return (
    <>
      <BaseEdge
        path={path}
        labelX={labelX}
        labelY={labelY}
        style={props.style}
        markerEnd={props.markerEnd}
        label={props.label}
        labelStyle={props.labelStyle}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        interactionWidth={props.interactionWidth}
      />
      {packet && (
        <g className="flow-packet">
          <circle r={9} fill={packetColor} opacity={0.25}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r={4.5} fill={packetColor}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
          </circle>
        </g>
      )}
    </>
  );
}

export default memo(PacketEdgeComponent);
