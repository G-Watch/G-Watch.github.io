"use client";

import { useMemo } from "react";
import {
  CHIP_GAP,
  chipLabel,
  type Overview,
  type PlacedStack,
} from "@/lib/arch/layout";
import {
  ArchDefs,
  ArchNode,
  Edges,
  groupTracks,
  nodeIndex,
} from "./arch-nodes";

/**
 * The whole model on one line: embedding, the layer stack, the head.
 *
 * Wired like the layer graph rather than laid out as a row of boxes — the stack
 * is a node in the same chain, so every relation in the picture is an actual
 * edge. Clicking a chip opens that layer's type.
 */

const LINE = "#c3c7cb";
const INK = "#0f1113";

/** Greys for the layer types, in the order the spec lists them. */
export const TYPE_TONES = ["#c3c7cb", "#d9dcdf", "#eceef0", "#f7f8f8"];
export const toneOf = (at: number) => TYPE_TONES[at % TYPE_TONES.length];

/** The tone a block hanging off the stack is drawn in. */
export const BRANCH_TONE = "#4a5157";

function Stack({
  node,
  onOpen,
  label,
  onOpenBranch,
}: {
  node: PlacedStack;
  onOpen: (layer: number, type: number) => void;
  label: (layer: number, type: number) => string;
  onOpenBranch: () => void;
}) {
  // A branch is one chip, named beside itself: on its own, a chip says nothing.
  if (node.branch) {
    return (
      <g transform={`translate(${node.x},${node.y})`}>
        <rect
          width={node.chipW}
          height={node.h}
          rx={1.5}
          fill={BRANCH_TONE}
          className="cursor-pointer transition-opacity hover:opacity-70"
          onClick={onOpenBranch}
        >
          <title>{node.branch}</title>
        </rect>
        <text
          // Left-aligned on the chip, not centred on it: the chip is 11px wide
          // and the diagram cuts the strip at its left edge to open the block,
          // so a centred caption leaves a sliver of the name behind the cut.
          x={0}
          y={node.h + 12}
          textAnchor="start"
          fontSize={9.5}
          fill={INK}
          className="pointer-events-none"
        >
          {node.branch}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${node.x},${node.y})`}>
      {node.typeOf.map((type, i) => {
        const x = i * (node.chipW + CHIP_GAP);
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={node.chipW}
              height={node.h}
              rx={1.5}
              fill={toneOf(type)}
              stroke={LINE}
              strokeWidth={0.75}
              className="cursor-pointer transition-opacity hover:opacity-70"
              onClick={() => onOpen(i, type)}
            >
              <title>{label(i, type)}</title>
            </rect>
            {/*
              The layer's own index, inside the chip. A row of blank chips
              cannot say which layer is which, and the tooltip only answers
              for the one under the pointer.
            */}
            <text
              x={x + node.chipW / 2}
              y={node.h / 2 + 3.5}
              textAnchor="middle"
              fontSize={9.5}
              fill={INK}
              className="pointer-events-none select-none"
            >
              {chipLabel(i)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function ArchOverview({
  layout,
  lo,
  hi,
  onOpen,
  label,
  onOpenBranch,
}: {
  /**
   * Laid out by the caller, not here: the diagram splits this strip in two at
   * the layer being opened, and it can only do that if it knows the geometry.
   */
  layout: Overview;
  lo: number;
  hi: number;
  onOpen: (layer: number, type: number) => void;
  label: (layer: number, type: number) => string;
  /** Opens the block that hangs off the stack, when the strip has one. */
  onOpenBranch: () => void;
}) {
  const byId = useMemo(() => nodeIndex(layout.nodes), [layout]);
  const tracks = useMemo(() => groupTracks(layout, byId), [layout, byId]);

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="block"
      role="img"
    >
      <ArchDefs />
      <Edges edges={layout.edges} byId={byId} />
      {layout.nodes.map((node) => {
        if (node.type === "stack") {
          return (
            <Stack
              key={node.id}
              node={node}
              onOpen={onOpen}
              label={label}
              onOpenBranch={onOpenBranch}
            />
          );
        }
        return (
          <ArchNode
            key={node.id}
            node={node}
            lo={lo}
            hi={hi}
            tracks={tracks.get(node.id)}
          />
        );
      })}
    </svg>
  );
}
