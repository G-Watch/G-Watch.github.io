"use client";

import { useMemo } from "react";
import type { Layout } from "@/lib/arch/layout";
import {
  ArchDefs,
  ArchNode,
  Edges,
  groupTracks,
  nodeIndex,
} from "./arch-nodes";

/**
 * One layer, drawn as a left-to-right graph.
 *
 * Geometry comes from lib/arch/layout.ts — exact accumulation, so nothing
 * overlaps and the chains of a section line up. Sections are alternating bands
 * with their name inside the band, top-left, rather than a caption strip below
 * the picture.
 */

const MUTED = "#6b7278";

export function ArchLayerGraph({
  layout,
  lo,
  hi,
}: {
  /**
   * Laid out by the caller: the diagram opens the layer into a gap it has to
   * size in advance, so it needs the width and height before it renders this.
   */
  layout: Layout;
  /** The log scale shared with the rest of the model. */
  lo: number;
  hi: number;
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

      {/* Phase bands, named inside themselves. */}
      {layout.bands.map((band, at) => (
        <g key={`${band.label}-${at}`}>
          {band.note && <title>{band.note}</title>}
          {/* A band covers the rows its section uses, not the whole diagram. */}
          <rect
            x={band.x}
            y={band.y}
            width={band.w}
            height={band.h}
            rx={3}
            fill={at % 2 === 0 ? "#fbfbfc" : "#ffffff"}
            stroke="#f0f1f3"
          />
          {/* Inside the band, not above it: a band that reaches up to cover
              its weight nodes can start at the very top of the diagram, and a
              title drawn above it would be clipped. */}
          <text x={band.x + 8} y={band.y + 12} fontSize={9.5} fill={MUTED}>
            {band.label}
          </text>
        </g>
      ))}

      <Edges edges={layout.edges} byId={byId} />

      {layout.nodes.map((node) => (
        <ArchNode
          key={node.id}
          node={node}
          lo={lo}
          hi={hi}
          tracks={tracks.get(node.id)}
        />
      ))}
    </svg>
  );
}
