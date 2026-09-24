"use client";

import {
  GROUP_DX,
  GROUP_DY,
  GROUP_LABEL,
  GROUP_PAD,
  OP_H,
  OP_W,
  STACK_DX,
  TENSOR_H,
  TENSOR_W,
  edgePaths,
  glyphGeom,
  sheetOffset,
  sheetsFor,
  type Edge,
  type PlacedGroup,
  type PlacedNode,
  type PlacedOp,
  type PlacedTensor,
} from "@/lib/arch/layout";
import type { Dim } from "@/lib/arch/types";

/**
 * The marks the architecture diagrams are drawn from — shared by the overview
 * and the layer graph so both read as one picture.
 *
 * Greyscale, as the rest of the site is. An operator is told apart by its
 * SHAPE; the one quantitative channel is a trapezoid's two edges, log-scaled,
 * so a low-rank projection reads as a taper before its label is read. A weight
 * tensor is hatched and an activation is not — one distinction, which is what
 * hatching is good for.
 */

const INK = "#0f1113";
const SOFT = "#3f464d";
const MUTED = "#6b7278";
const EDGE = "#b6bbbf";
const HATCH_ID = "arch-hatch";

/**
 * Every operator is the same dark grey, whatever it does, with its name in
 * white. The kind is told apart by SHAPE alone — a trapezoid, a chevron, a
 * bracket — so spending the fill on it too said the same thing twice and left
 * the glyphs too pale to find on the page.
 */
const OP_FILL = "#434a51";
const OP_STROKE = "#2b3137";
const OP_INK = "#ffffff";
/** A sheet behind the front one: the outline, nothing more. */
const OP_FADED = "#ffffff";

/** No thousands separators: shapes separate axes with commas too. */
export const fmtDim = (d: Dim) => String(d);

/** Characters that fit across an op box at this font size. */
const MAX_LABEL = 20;

export function widthRange(dims: number[]): { lo: number; hi: number } {
  const real = dims.filter((d) => Number.isFinite(d) && d > 0);
  if (real.length === 0) return { lo: 1, hi: 1 };
  return { lo: Math.min(...real), hi: Math.max(...real) };
}

/** The hatch every weight tensor is filled with. Include once per SVG. */
export function ArchDefs() {
  return (
    <defs>
      <pattern
        id={HATCH_ID}
        width={5}
        height={5}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={5} height={5} fill="#ffffff" />
        <line x1={0} y1={0} x2={0} y2={5} stroke="#c3c7cb" strokeWidth={1} />
      </pattern>
    </defs>
  );
}

export interface GroupTracks {
  /** Tracks arriving, index 0 for the front box. */
  in?: string[];
  /** Tracks leaving, index 0 from the front box's contents. */
  out?: string[];
}

/* -------------------------------------------------------------------------
 * Operator
 * ---------------------------------------------------------------------- */

function OpShape({
  op,
  lo,
  hi,
  node,
  faded,
}: {
  op: PlacedOp["op"];
  lo: number;
  hi: number;
  /** For the track counts the glyph has to be tall enough for. */
  node: PlacedOp;
  /** A sheet behind the front one: same outline, quieter. */
  faded?: boolean;
}) {
  const fill = faded ? OP_FADED : OP_FILL;
  const mid = OP_H / 2;
  const stroke = {
    fill,
    stroke: faded ? EDGE : OP_STROKE,
    strokeWidth: faded ? 0.75 : 1,
  };
  // The same geometry the edges are routed to, so a line always meets a shape.
  const g = glyphGeom(op, lo, hi, node.lanesIn, node.lanesOut);

  switch (op.kind) {
    case "linear":
    case "expert":
    case "embed":
    case "reduce":
    case "expand": {
      return (
        <polygon
          {...stroke}
          points={`0,${mid - g.leftHalf} ${OP_W},${mid - g.rightHalf} ${OP_W},${mid + g.rightHalf} 0,${mid + g.leftHalf}`}
        />
      );
    }
    case "attention":
      return (
        <>
          <rect {...stroke} width={OP_W} height={OP_H} rx={3} />
          {!faded &&
            [0.25, 0.5, 0.75].map((at) => (
              <line
                key={at}
                x1={OP_W * at}
                y1={3}
                x2={OP_W * at}
                y2={OP_H - 3}
                stroke={OP_INK}
                strokeWidth={0.6}
                opacity={0.35}
              />
            ))}
        </>
      );
    case "route":
      // A flat left edge for the lines arriving and one point on the right: a
      // router takes what it is given and decides where it goes. The old shape
      // was notched at BOTH ends, which left the incoming lines meeting a
      // concave edge and the name sitting in the pinch.
      return (
        <polygon
          {...stroke}
          points={`0,1 ${OP_W - 16},1 ${OP_W},${mid} ${OP_W - 16},${OP_H - 1} 0,${OP_H - 1}`}
        />
      );
    case "norm":
      return (
        <rect
          {...stroke}
          y={g.top}
          width={OP_W}
          height={g.bottom - g.top}
          rx={2}
        />
      );
    case "elementwise":
      // Clipped corners, so it is not mistaken for a norm at a glance.
      return (
        <polygon
          {...stroke}
          points={`6,${g.top} ${OP_W - 6},${g.top} ${OP_W},${mid} ${OP_W - 6},${g.bottom} 6,${g.bottom} 0,${mid}`}
        />
      );
    case "reshape":
      // The same dark ground as every other operator, with the brackets that
      // say "reinterpreted, not computed" drawn on it in white.
      return (
        <>
          <rect
            {...stroke}
            y={g.top}
            width={OP_W}
            height={g.bottom - g.top}
            rx={2}
          />
          {!faded && (
            <path
              d={`M20,${g.top + 5} h-6 v${g.bottom - g.top - 10} h6 M${OP_W - 20},${g.top + 5} h6 v${g.bottom - g.top - 10} h-6`}
              fill="none"
              stroke={OP_INK}
              strokeWidth={1}
              opacity={0.75}
            />
          )}
        </>
      );
  }
}

/**
 * What a pile of sheets cannot say for itself.
 *
 * Four instances draw as four sheets, so writing "x4" beside them says the same
 * thing twice. Past the cap the drawing stops counting — eight groups and 256
 * experts are both four sheets — and only then is the number worth the ink. It
 * goes with the name, inside the glyph, not as a caption floating under it.
 */
function countSuffix(op: PlacedOp["op"], sheets: number): string {
  const count = op.repeat ?? 1;
  if (count <= sheets) return "";
  return op.active && op.active !== count
    ? ` ${op.active} of ${count}`
    : ` ×${count}`;
}

/**
 * An operator: its glyph with the width change written inside, its name below.
 *
 * `repeat` instances draw as that many boxes stacked back to front (capped, with
 * the count in the label) — so 256 experts read as a stack, not as one box with
 * a number next to it. A stack that carries `inner` is openable: one instance
 * holds one copy of the data, and that is what opening it shows.
 */
export function OpBox({
  node,
  lo,
  hi,
  tracks,
}: {
  node: PlacedOp;
  lo: number;
  hi: number;
  /**
   * The tracks in and out, in absolute coordinates, index 0 for the front
   * sheet — drawn here, not in the shared edge layer, so track i sits in sheet
   * i's own layer and the sheets in front of it cover what passes behind them.
   */
  tracks?: GroupTracks;
}) {
  const { op, sheets } = node;
  // The widths are already in the trapezoid's two edges and in the tensor
  // boxes either side, so the box carries the name instead. How many instances
  // there are is what the pile of sheets says — a caption repeating it below
  // the box only added a line of litter to every stacked operator.
  const name = `${op.label}${countSuffix(op, sheets)}`;
  const label =
    name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name;
  const line = (d?: string) =>
    d ? (
      <path
        d={d}
        fill="none"
        stroke={EDGE}
        strokeWidth={1}
        strokeLinejoin="miter"
      />
    ) : null;

  return (
    <g>
      {/* The tooltip is where implementation detail belongs: the graph itself
          shows the logical relation, and `fusedInto` names the kernel a
          profile would actually report. */}
      <title>
        {[
          op.weight ?? op.label,
          op.note,
          op.fusedInto ? `runs as ${op.fusedInto}` : null,
        ]
          .filter(Boolean)
          .join(" — ")}
      </title>

      {/*
       * A stack of instances: same width and height throughout, receding up and
       * LEFT — the direction a stacked tensor and an instance group recede in,
       * so all three read the same way and `x`/`w` bound the whole pile.
       * Back to front: track in, sheet, track out, one layer per sheet.
       */}
      {Array.from({ length: sheets }, (_, k) => sheets - 1 - k).map((i) => (
        <g key={i}>
          {line(tracks?.in?.[i])}
          <g
            transform={`translate(${node.x + (sheets - 1 - i) * STACK_DX},${node.y + sheetOffset(i, sheets)})`}
          >
            <OpShape op={op} lo={lo} hi={hi} node={node} faded={i !== 0} />
            {i === 0 && (
              <text
                x={OP_W / 2}
                y={OP_H / 2 + 3.4}
                textAnchor="middle"
                fontSize={9}
                fill={OP_INK}
              >
                {label}
              </text>
            )}
          </g>
          {line(tracks?.out?.[i])}
        </g>
      ))}

    </g>
  );
}

/* -------------------------------------------------------------------------
 * Tensor
 * ---------------------------------------------------------------------- */

/**
 * A tensor: its shape in the box, its role below, its precision above when
 * known. Weights are hatched, activations plain; parallel copies stack.
 */
export function TensorBox({
  node,
  tracks,
}: {
  node: PlacedTensor;
  /**
   * The tracks in and out, in absolute coordinates, index 0 for the front
   * sheet. Drawn here rather than in the shared edge layer so each track sits
   * in ITS OWN sheet's layer: sheet i covers the end of track i, and the sheets
   * in front of it cover what passes behind them.
   */
  tracks?: GroupTracks;
}) {
  const { tensor, lanes, weight } = node;
  const sheets = sheetsFor(lanes);
  const body = weight ? `url(#${HATCH_ID})` : "#ffffff";
  const front = sheetOffset(0, sheets);
  const frontX = (sheets - 1) * STACK_DX;
  const label = tensor.label
    ? tensor.label.length > MAX_LABEL
      ? `${tensor.label.slice(0, MAX_LABEL - 1)}…`
      : tensor.label
    : undefined;
  const line = (d?: string) =>
    d ? (
      <path
        d={d}
        fill="none"
        stroke={EDGE}
        strokeWidth={1}
        strokeLinejoin="miter"
      />
    ) : null;

  return (
    <g>
      <title>
        {[tensor.label, node.dtype].filter(Boolean).join(" — ") || "tensor"}
      </title>
      {/* Back to front: track in, sheet, track out — one layer per sheet. */}
      {Array.from({ length: sheets }, (_, k) => sheets - 1 - k).map((i) => (
        <g key={i}>
          {line(tracks?.in?.[i])}
          <rect
            x={node.x + (sheets - 1 - i) * STACK_DX}
            y={node.y + sheetOffset(i, sheets)}
            width={TENSOR_W}
            height={TENSOR_H}
            rx={2}
            fill={body}
            stroke={weight ? MUTED : SOFT}
            strokeWidth={0.9}
            strokeDasharray={weight ? "3 2" : undefined}
          />
          {line(tracks?.out?.[i])}
        </g>
      ))}
      <text
        x={node.x + frontX + (node.dtype ? TENSOR_W / 2 - 14 : TENSOR_W / 2)}
        y={node.y + front + TENSOR_H / 2 + 3.4}
        textAnchor="middle"
        fontSize={9}
        fill={INK}
      >
        [{tensor.dims.map(fmtDim).join(", ")}]
      </text>
      {node.dtype && (
        <text
          x={node.x + frontX + TENSOR_W - 6}
          y={node.y + front + TENSOR_H / 2 + 3.2}
          textAnchor="end"
          fontSize={7.5}
          fill={MUTED}
        >
          {node.dtype}
        </text>
      )}
      {label && (
        <text
          x={node.x + frontX + TENSOR_W / 2}
          y={node.y + front + TENSOR_H + 11}
          textAnchor="middle"
          fontSize={8.5}
          fill={MUTED}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* -------------------------------------------------------------------------
 * Edges
 * ---------------------------------------------------------------------- */

/** Every edge, drawn under the nodes so no line crosses a glyph's face. */
export function Edges({
  edges,
  byId,
}: {
  edges: Edge[];
  byId: Map<string, { x: number; y: number; w: number; h: number }>;
}) {
  return (
    <g fill="none" stroke={EDGE} strokeWidth={1} strokeLinejoin="miter">
      {edges.map((edge, at) => {
        if (edge.ownedByTarget || edge.ownedBySource) return null;
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        return edgePaths(from, to, edge).map((d, i) => (
          <path key={`${at}-${i}`} d={d} />
        ));
      })}
    </g>
  );
}

/** Index any placed nodes by id — the overview's stack included. */
export function nodeIndex<T extends { id: string }>(
  nodes: readonly T[],
): Map<string, T> {
  return new Map(nodes.map((n) => [n.id, n] as const));
}

/* -------------------------------------------------------------------------
 * Instance groups
 * ---------------------------------------------------------------------- */

/**
 * An operator with several identical instances.
 *
 * `sheets` boxes of the same width and height, stacked vertically. The FIRST
 * box holds the instance laid out in full; the others are empty outlines,
 * because that is all they need to say — the work in them is the same work.
 * Track i of the incoming edge lands on box i.
 */
export function GroupBox({
  node,
  lo,
  hi,
  tracks,
}: {
  node: PlacedGroup;
  lo: number;
  hi: number;
  /**
   * The tracks in and out, in absolute coordinates, index 0 for the front box.
   * The group draws them itself so each sits in its own box's layer — and so
   * track 0 can run into and out of the contents rather than stopping at the
   * border.
   */
  tracks?: GroupTracks;
}) {
  const { inner, sheets, cellH, op } = node;
  const innerById = nodeIndex(inner.nodes);
  const cellW = node.w - (sheets - 1) * GROUP_DX;
  /** Box i, in absolute coordinates. The stack recedes up and left. */
  const at = (i: number) => ({
    x: node.x + (sheets - 1 - i) * GROUP_DX,
    y: node.y + (sheets - 1 - i) * GROUP_DY,
  });
  const line = (d?: string) =>
    d ? (
      <path
        d={d}
        fill="none"
        stroke={EDGE}
        strokeWidth={1}
        strokeLinejoin="miter"
      />
    ) : null;

  return (
    <g>
      <title>
        {[op.weight ?? op.label, op.note].filter(Boolean).join(" — ")}
      </title>

      {/*
       * Back to front: each track is laid down, then the box it belongs to
       * covers its end — so the line reads as entering that box.
       */}
      {Array.from({ length: sheets - 1 }, (_, k) => sheets - 1 - k).map((i) => {
        const o = at(i);
        return (
          <g key={i}>
            {line(tracks?.in?.[i])}
            <rect
              x={o.x}
              y={o.y}
              width={cellW}
              height={cellH}
              rx={3}
              fill="#ffffff"
              stroke={EDGE}
              strokeWidth={0.75}
            />
            {line(tracks?.out?.[i])}
          </g>
        );
      })}

      {/* The front box: its fill, then the track that runs INTO it, then its
          contents — so the track is visible inside the box. */}
      <rect
        x={at(0).x}
        y={at(0).y}
        width={cellW}
        height={cellH}
        rx={3}
        fill="#ffffff"
        stroke={SOFT}
        strokeWidth={1}
      />
      {line(tracks?.in?.[0])}
      <g
        transform={`translate(${at(0).x + GROUP_PAD},${at(0).y + node.innerDy})`}
      >
        <Edges edges={inner.edges} byId={innerById} />
        {inner.nodes.map((child) => (
          <ArchNode key={child.id} node={child} lo={lo} hi={hi} />
        ))}
      </g>
      {/* Leaves the contents, so it is drawn over them. */}
      {line(tracks?.out?.[0])}

      {/* The name belongs to the box, so it goes in the box — above the
          contents, in the strip kept for it. */}
      <text
        x={at(0).x + GROUP_PAD}
        y={at(0).y + GROUP_LABEL}
        fontSize={9}
        fill={SOFT}
      >
        {op.label}
        {countSuffix(op, sheets)}
      </text>
    </g>
  );
}

/**
 * Tracks that a node draws itself, per node id.
 *
 * Track 0 is extended past the front box's edge to where its contents start,
 * so it reads as running INTO the box that is drawn out; the rest stop on their
 * own box's edge. They are handed to the group rather than drawn here because
 * each belongs in its own box's layer.
 */
export function groupTracks(
  layout: {
    nodes: readonly {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }[];
    edges: readonly Edge[];
  },
  byId: Map<string, { id: string; x: number; y: number; w: number; h: number }>,
): Map<string, GroupTracks> {
  const out = new Map<string, GroupTracks>();
  const at = (id: string) => {
    const got = out.get(id) ?? {};
    out.set(id, got);
    return got;
  };
  /**
   * Two edges can own the same end — a tensor feeding two chains leaves each of
   * its sheets twice. Assigning the second over the first silently dropped one
   * of them, so the paths for a sheet are merged into ONE `d`: a path may hold
   * several subpaths, and they all belong in that sheet's layer anyway.
   */
  const merge = (had: string[] | undefined, got: string[]) =>
    had ? got.map((d, i) => (had[i] ? `${had[i]} ${d}` : d)) : got;

  /**
   * An end with fewer sheets than the edge has tracks — the single side of a
   * gather or a fan — takes all the leftover legs in its last sheet, deduped.
   * Handed out one per sheet they would simply have been dropped.
   */
  const fold = (paths: string[], slots: number) => {
    if (slots >= paths.length) return paths;
    const bins: string[][] = Array.from({ length: slots }, () => []);
    paths.forEach((d, i) => bins[Math.min(i, slots - 1)].push(d));
    return bins.map((bin) => [...new Set(bin)].join(" "));
  };

  for (const edge of layout.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    // When both ends own the track, each draws only its own half.
    const split = edge.ownedBySource && edge.ownedByTarget;
    if (edge.ownedByTarget) {
      const slot = at(to.id);
      const paths = edgePaths(from, to, edge, split ? "target" : undefined);
      slot.in = merge(slot.in, fold(paths, sheetsFor(edge.toLanes)));
    }
    if (edge.ownedBySource) {
      const slot = at(from.id);
      const paths = edgePaths(from, to, edge, split ? "source" : undefined);
      slot.out = merge(slot.out, fold(paths, sheetsFor(edge.fromLanes)));
    }
  }
  return out;
}

/** Any placed node, including a group and whatever it contains. */
export function ArchNode({
  node,
  lo,
  hi,
  tracks,
}: {
  node: PlacedNode;
  lo: number;
  hi: number;
  /** Tracks a group draws itself. */
  tracks?: GroupTracks;
}) {
  if (node.type === "group")
    return <GroupBox node={node} lo={lo} hi={hi} tracks={tracks} />;
  if (node.type === "op")
    return <OpBox node={node} lo={lo} hi={hi} tracks={tracks} />;
  return <TensorBox node={node} tracks={tracks} />;
}
