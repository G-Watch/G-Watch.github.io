import type { ArchOp, ArchSection, ArchStep, ArchTensor, Dim } from "./types";

/**
 * Turns a layer's sections into placed nodes and the edges between them.
 *
 * USER-OWNED. The diagram is a left-to-right graph, so geometry is computed
 * here rather than left to a flex container.
 *
 * **Every x is an exact accumulation.** A node's left edge is the previous
 * node's right edge plus one gap — never a column index times an average
 * width, which is what let nodes overlap before. Op boxes and tensor boxes have
 * different widths, so only exact accumulation keeps them apart, and because
 * the k-th step of every chain in a section has the same widths, the chains
 * line up without being told to.
 *
 * **Weights are nodes too.** An operator that multiplies by something shows
 * that something: a weight tensor above it, its own shape and precision on it,
 * a vertical edge into the operator. Activations and weights are told apart by
 * fill (hatched vs. plain), not by position alone.
 *
 * **Lanes.** The hidden state may be several parallel copies (`[b,s,4,d]` under
 * hyper-connections). Those draw as that many tracks; a `reduce` gathers them
 * into one and an `expand` fans them back out, and an edge whose ends disagree
 * is drawn as the gather or the fan it is.
 *
 * **Everything hangs off a centre line.** Op boxes and tensor boxes are
 * different heights, so they are positioned by their centres, not their tops —
 * otherwise every op→tensor edge picks up a kink from the 7px the two centres
 * differ by, and a graph of straight runs turns into a graph of corners. For
 * the same reason a section with fewer chains than its neighbours is centred
 * against them, so a gather is symmetric rather than dragged upward.
 */

export const OP_W = 116;
export const OP_H = 40;
export const TENSOR_W = 116;
export const TENSOR_H = 26;
/**
 * How far above its operator a weight node sits — enough for a visible drop
 * line, no more. It also sets the clearance a row with weights needs, so every
 * point here costs vertical space three times over.
 */
export const WEIGHT_DY = 44;
/**
 * Horizontal gap between a node and the next — where edges turn. Parallel
 * tracks spread `BEND_STEP` apart inside it, so it cannot shrink much further.
 */
export const GAP_X = 30;
/**
 * Space between rows, on top of each row's own measured height.
 *
 * Two sizes, because only some rows need the big one: a weight node hangs above
 * its operator and outside the row's height, so a row that has one needs
 * clearance for it, and a row that does not — an instance group's row, say,
 * since a group carries its weights inside — would otherwise be pushed a
 * needless 100 points away from its neighbour.
 */
export const ROW_GAP = 20;
/**
 * A row carrying weights needs its neighbour's labels to clear them: the
 * operator label below one row ends `OP_H/2 + 20` past its centre, and the
 * weight above the next starts `OP_H/2 + WEIGHT_DY + TENSOR_H` before its own.
 */
export const ROW_GAP_WEIGHT = WEIGHT_DY + TENSOR_H + 10;
/**
 * The strip an instance box keeps at its top for the operator's name.
 *
 * Inside the box, not floating above it: a caption set above the pile sat
 * closer to whatever the row above ended with than to the boxes it named.
 */
export const GROUP_LABEL = 14;
/**
 * Boxes drawn for a stack of instances, and the offset between them.
 *
 * `STACK_DY` is also the spacing of parallel tracks, and both are laid out in
 * ONE direction from the centre line — so track i sits at exactly the height of
 * stack sheet i, and "one copy per instance" is visible rather than asserted.
 */
export const STACK_MAX = 4;
/** Vertical spacing of both stack sheets and parallel tracks. */
export const STACK_DY = 10;
/**
 * Horizontal offset between stack sheets.
 *
 * Same direction as an instance group's boxes: the stack recedes UP AND LEFT,
 * sheet 0 in front, lowest and rightmost. That is what lets edges work — an
 * incoming track meets sheet i's own left edge without passing under the sheets
 * in front of it, and every outgoing track leaves from sheet 0's right edge,
 * which is the rightmost point of the pile.
 */
export const STACK_DX = 9;
export const GROUP_PAD = 12;
/**
 * How far apart the turning points of parallel tracks are.
 *
 * Tracks running side by side each turn on their OWN vertical. Sharing one —
 * which is right for a gather or a fan, where the lines really do meet — makes
 * four parallel tracks draw as a single thick column instead of four.
 */
export const BEND_STEP = 6;

/**
 * How far the boxes of an instance group are offset from one another. They are
 * STACKED, overlapping, not listed one below the other — just far enough apart
 * to be counted. Only the front box is drawn out.
 *
 * The stack recedes UP AND LEFT: box 0 (the drawn one) is front, lowest and
 * rightmost, box n-1 is behind, highest and leftmost. That direction is what
 * lets the incoming tracks work — track i meets box i's own left edge, and
 * since the boxes behind sit further left, no track has to pass under the front
 * box's fill to get there.
 */
export const GROUP_DX = 12;
export const GROUP_DY = 10;
/**
 * Room between a box's border and the instance drawn inside it.
 *
 * The contents come with their own margin, but at six points the two together
 * still read as a graph pressed against the glass — the border of the box and
 * the first tensor in it were closer than any two things inside.
 */
export const LANE_GAP = STACK_DY;
export const PAD_X = 14;
/**
 * Room between a section band's border and the glyphs inside it.
 *
 * This used to be two points, because edges bend in the gutter — a bundle on
 * `BUNDLE_BEND`, parallel tracks spread `BEND_STEP` apart around it — and a
 * band reaching into a 30-point gutter put its border straight through a
 * track's turn. Two points is not padding: every band's border sat on the first
 * glyph and ON the last one. The gutter BETWEEN sections is widened instead, so
 * the padding and the bends each get their own room.
 */
export const BAND_PAD_X = 12;
/** Breathing room a band keeps above and below the rows it covers. */
export const BAND_PAD = 10;
/**
 * The role caption under a tensor — "hidden", "kv latent", "copies".
 *
 * It hangs below the row and is not part of the row's height, which is
 * symmetric about the line. A band therefore has to make room for it on its
 * own: where a captioned four-sheet tensor was the tallest thing in its row it
 * ate 13 of the band's 20 points of bottom clearance and left 7.
 */
export const CAPTION_H = 13;
/**
 * The gutter between two sections, wider than the one inside a section.
 *
 * It carries what a within-section gutter never does: the band border either
 * side, and a bundle's turns — a gather onto the section that starts here and a
 * fan off the one that ends here, each spread over `BEND_STEP` per track.
 */
export const SECTION_GAP = 72;
/**
 * Where a bundle turns, measured from the end that owns it.
 *
 * Far enough past the band border that the two never coincide, near enough that
 * a gather's turns and a fan's stay on their own halves of the gutter.
 */
export const BUNDLE_BEND = 26;
/**
 * Extra height at a band's top for its own title. Without it the title lands on
 * whatever the section starts with — an instance group's label sits just above
 * its boxes, in exactly that spot.
 */
export const BAND_LABEL = 13;
/**
 * Room above the first row. Only a row that actually carries a weight node
 * needs the tall version — reserving it unconditionally left a band of empty
 * space above every diagram that has none.
 *
 * The weight version is measured from the row's centre line: a weight node's
 * top sits `OP_H/2 + WEIGHT_DY + TENSOR_H` above it, and 8 points of margin is
 * all that is wanted beyond that.
 */
export const PAD_TOP_WEIGHT = WEIGHT_DY + TENSOR_H - OP_H / 2 + 8;
/**
 * Room above the first row: enough for a stacked tensor's topmost sheet, a
 * dtype caption, and the band that covers them — a band reaches `BAND_PAD`
 * past its rows on each side, twice over, so anything less and the topmost
 * band's border runs off the canvas.
 */
export const PAD_TOP_PLAIN = BAND_PAD * 2 + 4;
/**
 * Below the last row: the caption under a tensor, and the band that covers it.
 * Anything less and the bottom band's border runs off the canvas.
 */
export const PAD_BOTTOM = BAND_PAD * 2 + CAPTION_H + 4;

interface Base {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
}

export interface PlacedOp extends Base {
  type: "op";
  op: ArchOp;
  /**
   * The shape of what it produces.
   *
   * Carried so an assertion can ask whether what arrives fits what leaves: a
   * norm and an elementwise operator keep the last axis, and an edge that
   * breaks that is a line to the wrong place.
   */
  outDims?: Dim[];
  /** Tracks arriving and leaving — the glyph must be tall enough for both. */
  lanesIn: number;
  lanesOut: number;
  /**
   * Instance sheets drawn (capped). The stack recedes up and LEFT, exactly as
   * a stacked tensor's and an instance group's do, so `x`/`w` bound the whole
   * pile and the front sheet is the rightmost, lowest one.
   */
  sheets: number;
}

export interface PlacedTensor extends Base {
  type: "tensor";
  tensor: ArchTensor;
  /**
   * A stand-in for whatever is off the left or right edge, placed outside the
   * canvas so the tracks into and out of the picture come from somewhere rather
   * than starting in mid-air. Nothing of the box itself is ever visible.
   */
  lead?: boolean;
  /** Parallel copies this tensor carries. */
  lanes: number;
  /** A weight rather than an activation — drawn hatched. */
  weight: boolean;
  /** Precision, when known. */
  dtype?: string;
}

/**
 * An operator with several identical instances, drawn as that many boxes of the
 * SAME width and height stacked vertically. The first box holds the instance's
 * contents laid out in full; the rest are empty boxes, which is all they need
 * to be — they say "and this happens N times" without repeating the drawing.
 */
export interface PlacedGroup extends Base {
  type: "group";
  op: ArchOp;
  /** One instance, laid out. Rendered inside the first box. */
  inner: Layout;
  /** How many boxes are drawn (capped). */
  sheets: number;
  /** Height of one box. */
  cellH: number;
  /** Where the contents sit inside a box — `inner.centre` lands on its middle. */
  innerDy: number;
}

export type PlacedNode = PlacedOp | PlacedTensor | PlacedGroup;

export interface Edge {
  from: string;
  to: string;
  /** Tracks at each end; unequal means a gather or a fan. */
  fromLanes: number;
  toLanes: number;
  /** A weight feeding its operator, drawn vertically. */
  vertical?: boolean;
  /** Where the target's glyph starts below its box, for a vertical edge. */
  topInset?: number;
  /**
   * Track spacing at each end. Sheets of a stack are `STACK_DY` apart, and the
   * boxes of an instance group are `GROUP_DY` apart in the other direction; a
   * track has to land on the box it belongs to.
   */
  fromPitch?: number;
  toPitch?: number;
  /**
   * Horizontal step per track, for an end whose boxes recede sideways: track i
   * arrives `(n-1-i) * toStagger` right of the node's left edge.
   */
  toStagger?: number;
  fromStagger?: number;
  /**
   * Drawn by the target instead of the shared edge layer.
   *
   * An instance group has to interleave its incoming tracks with its boxes:
   * track i belongs under box i, and track 0 runs INTO the front box, which is
   * the one whose contents are drawn. A single flat edge layer cannot express
   * that, so the group draws these itself.
   */
  ownedByTarget?: boolean;
  /**
   * Drawn by the SOURCE instead of the shared edge layer — the mirror of
   * `ownedByTarget`, for an instance group's outgoing tracks. Track 0 leaves
   * the contents of the front box, so it has to be drawn over them.
   */
  ownedBySource?: boolean;
  /**
   * Where track 0 ends when it runs into a drawn-out box: the centre of the
   * tensor the contents start from, in absolute coordinates.
   *
   * Not the box's centre — the contents are laid out with room above them for
   * weight nodes, so the entry tensor sits well below the middle of the box,
   * and a line to the middle would end in mid-air.
   */
  pierce?: { x: number; y: number };
  /**
   * Where track 0 starts when it leaves a drawn-out box: the right edge and
   * vertical centre of the last tensor in the contents. Without it the track
   * starts on the box's border and the chain inside appears to go nowhere.
   */
  exit?: { x: number; y: number };
  /**
   * The line an end's tracks are centred on, when it is not the middle of its
   * box. An instance stack is centred on the CONTENT line of its boxes — the
   * one the chain inside the front box runs along — and that is not the middle
   * of a box whose contents reserve room at the top for weights.
   */
  fromCentre?: number;
  toCentre?: number;
  /**
   * Which end owns the bend. Several edges arriving at one node bend on the
   * gutter in front of THAT node ("gather"); several leaving one node bend on
   * the gutter behind it ("fan"). Without this the bend sits at each edge's own
   * midpoint, and edges whose sources are different lengths bend on different
   * verticals — which is what makes a graph look like a pile of corners.
   */
  bundle?: "gather" | "fan";
  /**
   * A dependency that is not the straight line: the y of the rail it travels
   * on, below everything else.
   *
   * It leaves its source in the gutter behind it, runs along the rail, and
   * turns up into the gutter in front of its target — the same discipline as
   * every other corner (R9), but on a row of its own so it crosses nothing.
   */
  rail?: number;
}

export interface Band {
  label: string;
  note?: string;
  x: number;
  w: number;
  /** The rows this section actually occupies, not the whole diagram. */
  y: number;
  h: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: Edge[];
  bands: Band[];
  width: number;
  height: number;
  /**
   * The line the graph enters and leaves on, measured from the top.
   *
   * A group centres its contents on this rather than on their bounding box, so
   * the track running into the front box and the track leaving it are the same
   * horizontal as the tracks meeting the boxes behind it. Centred by the box
   * instead, every instance group put a kink in its own line — the
   * contents reserve room above for weights and bands that the bottom has no
   * counterpart for.
   */
  centre: number;
  /**
   * The line it leaves on, which is not always the one it entered on.
   *
   * A graph fed by two things enters on the row of the FIRST of them and
   * leaves on the row its last section is centred on. Whatever draws it has to
   * step with that, or the seam at one end will not meet.
   */
  exit: number;
}

/** Sheets drawn for `count` instances, capped. */
export function sheetsFor(count: number): number {
  return Math.min(Math.max(count, 1), STACK_MAX);
}

/**
 * Vertical offset of sheet / track `i` of `count`, centred on the row.
 *
 * Index 0 is the FRONT sheet and sits lowest; higher indices recede upward.
 * Same convention as an instance group's boxes, so a stacked tensor and a
 * stacked operator read the same way, and the front sheet — the one carrying
 * the text — is never covered by the ones behind it.
 */
export function sheetOffset(i: number, count: number): number {
  return ((count - 1) / 2 - i) * STACK_DY;
}

/** Width a stacked tensor occupies, offsets included. */
export function stackedWidth(lanes: number): number {
  return TENSOR_W + (sheetsFor(lanes) - 1) * STACK_DX;
}

/** Width a stacked operator occupies, offsets included. */
export function stackedOpWidth(sheets: number): number {
  return OP_W + (sheetsFor(sheets) - 1) * STACK_DX;
}

/** Height a stacked operator occupies, offsets included. */
export function stackedOpHeight(sheets: number): number {
  return OP_H + (sheetsFor(sheets) - 1) * STACK_DY;
}

/** The glyph height a set of tracks needs to land on. */
export function trackSpan(count: number): number {
  return (sheetsFor(count) - 1) * STACK_DY + 10;
}

/**
 * Parallel copies a tensor carries — read off the tensor, never guessed.
 *
 * A shape cannot tell them apart from anything else: `[b,s,8,128]` is eight
 * attention heads, `[b,s,4,4096]` is four copies of the hidden state, and both
 * are a four-axis shape with a small integer third axis. Inferring from the
 * shape drew eight tracks through Llama's K projection, which is why the spec
 * declares it instead.
 */
export function lanesOf(tensor: ArchTensor): number {
  const n = tensor.copies ?? 1;
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/**
 * The vertical extent of an operator's glyph inside its box, and the height its
 * left and right edges present.
 *
 * Edges attach to the GLYPH, never to the box. A norm fills 22 of the box's 40
 * points, a taper's narrow end is a few points tall, and a line drawn to the
 * box's own edge would end in mid-air — which is what made the graph look
 * unaligned however carefully the columns were computed.
 */
export interface GlyphGeom {
  /** Top and bottom of the glyph, relative to the box. */
  top: number;
  bottom: number;
  /** Half-heights available for edges at the left and right edges. */
  leftHalf: number;
  rightHalf: number;
}

/** Smallest edge a taper is drawn with, so an edge always has something to meet. */
export const MIN_EDGE = 11;
export const MAX_EDGE = OP_H - 2;
/** Glyphs that are a bar rather than a full box. */
export const BAR_HALF = 11;

/** Log-scaled edge length for a width. */
export function edgeFor(dim: number, lo: number, hi: number): number {
  if (!Number.isFinite(dim) || dim <= 0) return MIN_EDGE;
  if (hi <= lo) return (MIN_EDGE + MAX_EDGE) / 2;
  const t =
    (Math.log(Math.max(dim, 1)) - Math.log(Math.max(lo, 1))) /
    (Math.log(hi) - Math.log(Math.max(lo, 1)));
  return MIN_EDGE + Math.min(Math.max(t, 0), 1) * (MAX_EDGE - MIN_EDGE);
}

export function glyphGeom(
  op: ArchOp,
  lo: number,
  hi: number,
  /** Tracks arriving and leaving, so the glyph is never too short for them. */
  lanesIn = 1,
  lanesOut = 1,
): GlyphGeom {
  const mid = OP_H / 2;
  switch (op.kind) {
    case "linear":
    case "expert":
    case "embed":
    case "reduce":
    case "expand": {
      // An edge that a width has not been given still has to be met, and a
      // taper carrying four tracks has to be at least as tall as they are.
      const l = Math.max(edgeFor(op.inDim ?? 0, lo, hi), trackSpan(lanesIn));
      const r = Math.max(
        edgeFor(op.outDim ?? op.inDim ?? 0, lo, hi),
        trackSpan(lanesOut),
      );
      return {
        top: mid - Math.max(l, r) / 2,
        bottom: mid + Math.max(l, r) / 2,
        leftHalf: l / 2,
        rightHalf: r / 2,
      };
    }
    case "attention":
    case "route":
      return { top: 0, bottom: OP_H, leftHalf: OP_H / 2, rightHalf: OP_H / 2 };
    case "norm":
    case "elementwise": {
      const half = Math.max(
        BAR_HALF,
        trackSpan(Math.max(lanesIn, lanesOut)) / 2,
      );
      return {
        top: mid - half,
        bottom: mid + half,
        leftHalf: half,
        rightHalf: half,
      };
    }
    case "reshape":
      return {
        top: 3,
        bottom: OP_H - 3,
        leftHalf: mid - 3,
        rightHalf: mid - 3,
      };
  }
}

/**
 * The weight an operator multiplies by, if any.
 *
 * A linear map's weight is `[out, in]` — the order PyTorch stores it in — which
 * is also the shape the safetensors header reports, so the node can be checked
 * against the checkpoint. A spec overrides this when the weight is not a plain
 * matrix.
 */
/**
 * Vertical pitch of a pile of an operator's stored parameters.
 *
 * A weight node is its box AND the name written under it, so the pitch has to
 * clear both. Written as `TENSOR_H + 12` the caption of one parameter sat on
 * the top edge of the box below it.
 */
export const WEIGHT_STEP = TENSOR_H + CAPTION_H + 8;

/** Clearance below the content before the first carry rail, and between rails. */
export const RAIL_GAP = 22;
export const RAIL_STEP = 14;

/**
 * Every stored parameter an operator reads, nearest the operator first.
 *
 * One node each: they have different shapes and different dtypes, and an
 * operator that reads three tensors while the picture names one cannot be
 * traced back to the checkpoint.
 */
export function weightNodesOf(
  op: ArchOp,
): { dims: Dim[]; label: string; dtype?: string }[] {
  const out: { dims: Dim[]; label: string; dtype?: string }[] = [];
  const main = weightShapeOf(op);
  if (main) out.push({ dims: main, label: op.weight ?? op.label, dtype: op.dtype });
  for (const extra of op.extras ?? [])
    out.push({ dims: extra.shape, label: extra.name, dtype: extra.dtype });
  return out;
}

function weightShapeOf(op: ArchOp): Dim[] | undefined {
  if (op.weightShape) return op.weightShape;
  const linear =
    op.kind === "linear" ||
    op.kind === "embed" ||
    op.kind === "reduce" ||
    op.kind === "expert" ||
    (op.kind === "route" && op.inDim !== undefined);
  if (!linear || op.inDim === undefined || op.outDim === undefined) {
    return undefined;
  }
  return op.kind === "embed" ? [op.inDim, op.outDim] : [op.outDim, op.inDim];
}

/** How deep an instance group may nest before it stops expanding. */
const MAX_DEPTH = 2;

/**
 * Copies leaving a step, given the copies entering it. A `reduce` folds them to
 * one, an `expand` restores the layer's own count, anything else passes through
 * whatever its output tensor declares.
 *
 * Shared by the measuring pass and the placing pass — computed twice from two
 * copies of the rule, the passes disagreed and the columns drifted apart.
 */
function lanesAfter(step: ArchStep, lanes: number, baseLanes: number): number {
  if (step.op.kind === "reduce") return 1;
  if (step.op.kind === "expand") return baseLanes;
  return lanesOf(step.out) || lanes;
}

/**
 * The tensor one instance of `op` receives.
 *
 * Inside an instance there is ONE copy of the data — that is what an instance
 * is — so the copies axis is dropped. An operator that states its input width
 * uses it; one that does not keeps the incoming width.
 */
function tensorOf(op: ArchOp, io: ArchTensor): ArchTensor {
  if (op.inDim !== undefined) {
    return { dims: [...io.dims.slice(0, 2), op.inDim], label: io.label };
  }
  const dims =
    io.dims.length >= 4
      ? [...io.dims.slice(0, -2), io.dims[io.dims.length - 1]]
      : io.dims.slice();
  // The label survives: inside the box it is what a `uses` names when a step
  // reads the copy the box was handed rather than the step before it.
  return { dims, label: io.label };
}


/**
 * A section every operator of which runs the same number of times, rewritten as
 * ONE instance repeated that many times.
 *
 * Four copies flowing through `scale by post` and then `add comb residual` are
 * not two four-high piles with a four-lane tensor between them — they are four
 * copies of a two-step chain, which is exactly what `hc_attn_fn` is one section
 * earlier. Drawn as piles it was the same construction in two different
 * idioms, and the pile idiom hides that a copy stays a copy the whole way
 * through: the tensor in the middle looked like a place the four met.
 *
 * Only a single-chain section qualifies, and only when EVERY step repeats the
 * same number of times. The box then has a name already — the section's — so
 * nothing has to be invented for it, and the band keeps the background without
 * repeating the title.
 */
function asInstance(section: ArchSection): ArchSection {
  const whole = section.chains.length === 1 ? section.chains[0].steps : [];
  const count = whole[0]?.op.repeat ?? 1;
  if (
    whole.length > 1 &&
    count > 1 &&
    whole.every((step) => (step.op.repeat ?? 1) === count)
  ) {
    // The whole phase is the instance, and it has a name already.
    return {
      ...section,
      label: "",
      chains: [
        {
          steps: [
            instance(section.label, count, whole, {
              active: whole[0].op.active,
              note: section.note,
            }),
          ],
        },
      ],
    };
  }
  // Otherwise every repeated operator is an instance of itself.
  return {
    ...section,
    chains: section.chains.map((chain) => ({
      ...chain,
      steps: chain.steps.map((step) => {
        const n = step.op.repeat ?? 1;
        if (n < 2 || step.op.inner) return step;
        return instance(step.op.label, n, [step], {
          active: step.op.active,
          note: step.op.note,
          weight: step.op.weight,
        });
      }),
    })),
  };
}

/** The step that draws `steps` as `count` boxes, one of them laid out. */
function instance(
  label: string,
  count: number,
  steps: ArchStep[],
  extra: { active?: number; note?: string; weight?: string },
): ArchStep {
  const last = steps[steps.length - 1];
  // What the wrapped operators read from outside the box, the box now reads.
  // Dropped here, every dependency of a repeated operator vanished — and a
  // repeated operator is most of this architecture.
  const uses = [...new Set(steps.flatMap((step) => step.uses ?? []))];
  return {
    uses: uses.length ? uses : undefined,
    op: {
      kind: last.op.kind,
      label,
      repeat: count,
      // The widths the box takes in and gives out, from the operators it
      // wraps. Without them the tensor drawn INSIDE the box was derived from
      // the layer's own io — right for a box that spans the hidden state,
      // wrong for `attn.wo_a`, which takes one group's worth.
      inDim: steps[0].op.inDim,
      outDim: last.op.outDim,
      inner: [
        {
          label: "",
          kind: "sequence",
          chains: [
            {
              steps: steps.map((step) => ({
                // One instance runs each operator once, on one copy. `uses`
                // is deliberately NOT carried inside: the tensor it names is
                // outside the box, so it is the BOX that reads it.
                op: { ...step.op, repeat: undefined, active: undefined },
                out: perCopy(step.op, step.out),
              })),
            },
          ],
        },
      ],
      ...extra,
    },
    out: last.out,
  };
}

/**
 * What ONE instance of `op` produces, given what all of them together do.
 *
 * Either the copies axis goes, or — when the instances are slices of one wide
 * result, the way each of `attn.wo_a`'s eight groups makes a slice of the o
 * latent — the last axis becomes the operator's own output width. The role
 * caption goes with it: it named the whole, and a slice of the whole is not
 * that thing. A spec that wants the part named writes its own `inner`.
 */
function perCopy(op: ArchOp, out: ArchTensor): ArchTensor {
  if ((out.copies ?? 1) > 1) {
    const dims = out.dims.slice();
    dims.splice(dims.length - 2, 1);
    return { dims, dtype: out.dtype };
  }
  if (op.outDim !== undefined && out.dims[out.dims.length - 1] !== op.outDim) {
    return { dims: [...out.dims.slice(0, -1), op.outDim], dtype: out.dtype };
  }
  return out;
}


/**
 * One instance box, sized so the contents sit on ITS middle.
 *
 * A laid-out graph is not vertically symmetric — it reserves room at the top
 * for weight nodes and band titles that the bottom has no counterpart for — so
 * a box sized to the bounding box puts the chain above or below its own centre,
 * and the track running into the front box bends to reach it while the tracks
 * meeting the boxes behind it stay straight. Both halves are padded to the
 * larger one instead, and the name takes a strip at the top.
 */
function groupCell(inner: Layout): {
  cellH: number;
  innerDy: number;
  /** Where the chain runs, measured from the box's top. */
  line: number;
} {
  const innerDy = GROUP_LABEL + GROUP_PAD;
  return {
    cellH: innerDy + inner.height + GROUP_PAD,
    innerDy,
    line: innerDy + inner.centre,
  };
}

/**
 * How a layer joins what is drawn either side of it.
 *
 * Opened in place, a layer is spliced into the model's own line: the lines have
 * to leave the picture at both edges and meet what continues there, and the
 * tensor the previous thing already shows must not be drawn a second time.
 */
export interface LayerFrame {
  /** Tracks enter from the left edge rather than starting at a tensor. */
  leadIn?: boolean;
  /** Tracks leave at the right edge rather than stopping at the last tensor. */
  leadOut?: boolean;
  /**
   * The FIRST input is already on screen to the left — don't repeat it.
   *
   * Only the first: a block fed by two things has one of them continuing a
   * line from outside and the other arriving from nowhere, and only the first
   * can already be drawn.
   */
  omitEntry?: boolean;
  /**
   * The output is already drawn by whatever is to the right — don't repeat it.
   *
   * The mirror of `omitEntry`. The last layer of a stack hands on to the very
   * tensor the strip draws after the stack, and drawn at both ends of the cut
   * it is one tensor shown twice. Hiding the strip's copy instead would take
   * the source of everything that reads it away with it.
   */
  omitExit?: boolean;
}

export function layoutLayer(
  input: {
    io: ArchTensor;
    /**
     * What the graph is given, when that is more than one thing.
     *
     * The MTP block takes the stack's hidden state AND the next token, and
     * neither comes from the other — drawn from one entry, one of the two would
     * have been a line claiming a dependency that is not there. Input `i` feeds
     * chain `i` of the first section; omitted, it is `[io]`.
     */
    inputs?: ArchTensor[];
    sections: ArchSection[];
  },
  /** The log scale the glyphs are drawn at — needed to find a glyph's top. */
  lo = 1,
  hi = 1,
  depth = 0,
  frame: LayerFrame = {},
): Layout {
  const nodes: PlacedNode[] = [];
  const edges: Edge[] = [];
  const bands: Band[] = [];

  // A phase whose every operator repeats the same way is one instance drawn
  // that many times, not that many piles of operators.
  const type = { io: input.io, sections: input.sections.map(asInstance) };
  const inputs = input.inputs?.length ? input.inputs : [type.io];
  const baseLanes = lanesOf(inputs[0]);
  const expands = depth < MAX_DEPTH;

  /**
   * Pass one: measure each section on its own.
   *
   * Row heights used to be global — the tallest thing anywhere on row 1 set the
   * height of row 1 for every section — so a section holding a 256-expert group
   * pushed every other section's rows apart and left them floating in space.
   * Each section is measured and stacked by ITSELF here, and the sections are
   * then centred on one line, which is all they need to share for their edges
   * to meet.
   */
  const groupOf = new Map<string, Layout>();
  /**
   * Whether an instance gets a box of its own.
   *
   * Everything that repeats does — `asInstance` has already given every
   * repeated operator an `inner`, so a repeated operator and a repeated chain
   * read the same way: here is one of them, and there are N. Left as a bare
   * pile of glyphs instead, `scale by pre` said nothing about what one copy
   * carries, while its mirror image on the way out (`scale by post`) was drawn
   * out in full one section later. Only past `MAX_DEPTH` does a stack stay a
   * pile, because that is where the drawing stops opening things.
   */
  const isGroup = (op: ArchOp) =>
    expands && op.inner !== undefined && (op.repeat ?? 1) > 1;

  /** Per section: each row's height, and the clearance its weights need. */
  const secRowH: number[][] = [];
  const secRowTop: number[][] = [];
  const secH: number[] = [];

  type.sections.forEach((section, si) => {
    const rows: number[] = [];
    const tops: number[] = [];
    section.chains.forEach((chain, row) => {
      let tallest = Math.max(OP_H, TENSOR_H);
      let top = 0;
      chain.steps.forEach((step, k) => {
        if (isGroup(step.op)) {
          const inner = layoutLayer(
            { io: tensorOf(step.op, type.io), sections: step.op.inner! },
            lo,
            hi,
            depth + 1,
          );
          groupOf.set(`s${si}r${row}o${k}`, inner);
          const sheets = sheetsFor(step.op.repeat ?? 1);
          const { cellH, line } = groupCell(inner);
          // The stack hangs off the line its tracks run on, not off its own
          // bounding box: `up` above that line, `down` below. A box holding
          // weights is top-heavy, and padding the row to twice `up` would have
          // left as much dead space under the boxes as the weights take above
          // them — the excess is declared as clearance instead, the same way a
          // weight node's is.
          const up = ((sheets - 1) / 2) * GROUP_DY + line;
          const down = ((sheets - 1) / 2) * GROUP_DY + (cellH - line);
          tallest = Math.max(tallest, down * 2);
          top = Math.max(top, up - down);
          return;
        }
        // A stacked operator and a stacked tensor both reach half their pile
        // above and below the centre line. A row measured at OP_H regardless
        // let the next row's boxes sit on top of those sheets.
        const sh = sheetsFor(step.op.repeat ?? 1);
        const outL =
          step.op.kind === "reduce"
            ? 1
            : step.op.kind === "expand"
              ? baseLanes
              : lanesOf(step.out);
        tallest = Math.max(
          tallest,
          stackedOpHeight(sh),
          TENSOR_H + (sheetsFor(outL) - 1) * STACK_DY,
        );
        const stored = weightNodesOf(step.op).length;
        if (stored > 0) {
          // A weight hangs above the row, outside its height — above the
          // TOPMOST sheet when the operator is a stack. Several parameters
          // pile upwards, so the clearance grows with how many there are.
          top = Math.max(
            top,
            WEIGHT_DY +
              TENSOR_H -
              OP_H / 2 +
              6 +
              ((sh - 1) / 2) * STACK_DY +
              (stored - 1) * WEIGHT_STEP,
          );
        }
      });
      rows.push(tallest);
      tops.push(top);
    });
    secRowH.push(rows);
    secRowTop.push(tops);
    // The clearance the FIRST row's weights need sits above the section and is
    // not part of what gets centred — otherwise a section with weights is
    // pushed down by half of it, and every edge crossing into it bends.
    secH.push(
      rows.reduce((sum, h) => sum + h, 0) +
        tops.slice(1).reduce((sum, t) => sum + t, 0) +
        Math.max(rows.length - 1, 0) * ROW_GAP,
    );
  });

  const tallestSection = Math.max(OP_H, ...secH);
  const topmost = Math.max(0, ...secRowTop.map((t) => t[0] ?? 0));
  const mid = PAD_TOP_PLAIN + BAND_LABEL + topmost + tallestSection / 2;

  /**
   * Centre line of chain `row` of section `si`.
   *
   * Every section is centred on `mid` by its ROWS, so the first row of one
   * section lines up with the first row of the next and a chain running
   * through them is straight.
   */
  const centreOf = (si: number, row: number) => {
    const rows = secRowH[si] ?? [Math.max(OP_H, TENSOR_H)];
    const tops = secRowTop[si] ?? [0];
    let y = mid - (secH[si] ?? OP_H) / 2;
    for (let r = 0; r < row; r++) y += rows[r] + ROW_GAP + (tops[r + 1] ?? 0);
    return y + rows[row] / 2;
  };

  /** Vertical extent of a section, weights included. */
  const bandSpan = (si: number) => {
    const top0 = secRowTop[si]?.[0] ?? 0;
    return {
      y: mid - (secH[si] ?? OP_H) / 2 - top0 - BAND_PAD - BAND_LABEL,
      h:
        (secH[si] ?? OP_H) + top0 + BAND_PAD * 2 + BAND_LABEL + CAPTION_H,
    };
  };

  /**
   * Column widths: for each step of a section, the widest operator and the
   * widest following tensor any of its chains puts there — so the chains of a
   * section stay in step even when one holds an instance group and another a
   * plain box.
   */
  const colW: number[][] = type.sections.map((section, si) =>
    Array.from(
      { length: Math.max(...section.chains.map((c) => c.steps.length), 0) },
      (_, k) =>
        Math.max(
          ...section.chains.map((chain, row) => {
            const step = chain.steps[k];
            if (!step) return 0;
            const inner = groupOf.get(`s${si}r${row}o${k}`);
            if (!inner) return stackedOpWidth(step.op.repeat ?? 1);
            const sheets = sheetsFor(step.op.repeat ?? 1);
            return inner.width + GROUP_PAD * 2 + (sheets - 1) * GROUP_DX;
          }),
          OP_W,
        ),
    ),
  );

  const colTW: number[][] = [];
  {
    let inLanes = baseLanes;
    type.sections.forEach((section, si) => {
      colTW[si] = [];
      let outLanes = inLanes;
      for (const chain of section.chains) {
        let l = inLanes;
        chain.steps.forEach((step, k) => {
          l = lanesAfter(step, l, baseLanes);
          colTW[si][k] = Math.max(colTW[si][k] ?? 0, stackedWidth(l));
        });
        outLanes = l;
      }
      inLanes = outLanes;
    });
  }

  const firstChains = type.sections[0]?.chains.length ?? 1;
  const entryCentre =
    (centreOf(0, 0) + centreOf(0, Math.max(firstChains - 1, 0))) / 2;
  const lastSection = Math.max(type.sections.length - 1, 0);
  const lastChains = type.sections[lastSection]?.chains.length ?? 1;
  const exitCentre =
    (centreOf(lastSection, 0) +
      centreOf(lastSection, Math.max(lastChains - 1, 0))) /
    2;

  /**
   * What the next section reads, one entry per source. `lanes[i]` belongs to
   * `ids[i]`; a single value covers every id, which is the usual case.
   */
  /**
   * The most recent tensor node for each label, so a `uses` can name it.
   *
   * Most recent wins: `hidden` is produced once per sub-layer, and a carry in
   * the ffn half must reach the ffn half's own copy, not the attention half's.
   */
  const produced = new Map<string, { id: string; lanes: number; right: number }>();
  /** Sources a `uses` claimed, which are therefore not wired onwards. */
  const claimed = new Set<string>();
  /** Carry edges, with the span each one crosses, for rail assignment. */
  const carries: { edge: Edge; from: number; to: number }[] = [];
  /** A label a `uses` named that nothing produced — a spec bug, not a layout one. */
  const unresolved: string[] = [];

  let incoming: { ids: string[]; lanes: number[]; pitch?: number };
  /** The lane count for source `at`, falling back to the first. */
  const laneOf = (lanes: number[], at: number) => lanes[at] ?? lanes[0] ?? 1;
  const entryW = stackedWidth(baseLanes);
  const leadIn = frame.leadIn || frame.omitEntry;
  let cursor = leadIn ? GAP_X : PAD_X;
  /**
   * The line input `at` enters on.
   *
   * One input sits on the line its whole first section is centred on — it feeds
   * every chain of it. Several sit each on the line of the one chain they feed,
   * and the first of them is the line the picture as a whole enters on.
   */
  const entryY = (at: number) =>
    inputs.length === 1
      ? entryCentre
      : centreOf(0, Math.min(at, (type.sections[0]?.chains.length ?? 1) - 1));

  if (leadIn) {
    // Right up against the left edge and entirely outside it: the tracks it
    // sends out are clipped to start on the edge, which is where whatever comes
    // before this picture left off.
    nodes.push({
      type: "tensor",
      id: "lead",
      tensor: type.io,
      x: -entryW,
      y: entryY(0) - TENSOR_H / 2,
      w: entryW,
      h: TENSOR_H,
      row: 0,
      lanes: baseLanes,
      weight: false,
      lead: true,
    });
    incoming = { ids: ["lead"], lanes: [baseLanes] };
  }

  {
    // One entry per input, each level with the chain it feeds. The lead-in,
    // when there is one, belongs to the first: it is the only one continuing a
    // line from outside the picture — and when that one is already drawn out
    // there, it is the one left out here.
    const ids: string[] = [];
    const lanes: number[] = [];
    let widest = 0;
    inputs.forEach((io, at) => {
      const n = lanesOf(io);
      const w = stackedWidth(n);
      if (at === 0 && frame.omitEntry) {
        ids.push("lead");
        lanes.push(n);
        return;
      }
      nodes.push({
        type: "tensor",
        id: at === 0 ? "entry" : `entry${at}`,
        tensor: io,
        x: cursor,
        y: entryY(at) - TENSOR_H / 2,
        w,
        h: TENSOR_H,
        row: at,
        lanes: n,
        weight: false,
      });
      ids.push(at === 0 ? "entry" : `entry${at}`);
      if (io.label)
        produced.set(io.label, {
          id: at === 0 ? "entry" : `entry${at}`,
          lanes: n,
          right: cursor + w,
        });
      lanes.push(n);
      widest = Math.max(widest, w);
    });
    if (leadIn && !frame.omitEntry) {
      edges.push({
        from: "lead",
        to: "entry",
        fromLanes: baseLanes,
        toLanes: baseLanes,
        toStagger: baseLanes > 1 ? STACK_DX : undefined,
        ownedBySource: baseLanes > 1,
        ownedByTarget: baseLanes > 1,
      });
    }
    incoming = { ids, lanes };
    // Nothing was placed at all when the only input is the one left out.
    if (widest > 0) cursor += widest + GAP_X;
  }

  type.sections.forEach((section, si) => {
    // A section stands off from whatever came before it: the band border needs
    // room on both sides of the gutter, and the bundles need room between them.
    cursor += SECTION_GAP - GAP_X;
    const startX = cursor;
    let endX = cursor;
    let outPitch: number | undefined;
    const endIds: string[] = [];
    const endLanes: number[] = [];

    section.chains.forEach((chain, row) => {
      const cy = centreOf(si, row);
      let x = startX;
      const one = incoming.ids.length === section.chains.length;
      const prevAt = one ? [row] : incoming.ids.map((_, at) => at);
      let prev = prevAt.map((at) => incoming.ids[at]);
      /** Lane count per source in `prev`, until the first step merges them. */
      let prevLanes = prevAt.map((at) => laneOf(incoming.lanes, at));
      let lanes = Math.max(...prevLanes);
      let pitch = incoming.pitch;

      chain.steps.forEach((step, k) => {
        const opId = `s${si}r${row}o${k}`;
        // What this step reads besides the thing before it. Resolved here, so
        // the source is whatever was produced up to this point.
        // A detached step reads only what it names, so there is no line from
        // the thing before it — the chain is a line and this step is not on it.
        if (step.detached) {
          prev = [];
          prevLanes = [];
        }
        for (const label of step.uses ?? []) {
          const src = produced.get(label);
          if (!src) {
            unresolved.push(label);
            continue;
          }
          claimed.add(src.id);
          const edge: Edge = {
            from: src.id,
            to: opId,
            fromLanes: 1,
            toLanes: 1,
            rail: 0,
          };
          edges.push(edge);
          carries.push({ edge, from: src.right, to: x });
        }
        const colOpW = colW[si][k] ?? OP_W;
        const colTensorW = colTW[si][k] ?? TENSOR_W;
        const bundle =
          prev.length > 1
            ? ("gather" as const)
            : section.chains.length > 1 && k === 0
              ? ("fan" as const)
              : undefined;
        const after = lanesAfter(step, lanes, baseLanes);

        const inner = groupOf.get(opId);
        if (inner) {
          const sheets = sheetsFor(step.op.repeat ?? 1);
          const { cellH, innerDy, line } = groupCell(inner);
          // Overlapping sheets: the box plus however far the stack is offset.
          const h = cellH + (sheets - 1) * GROUP_DY;
          const w = inner.width + GROUP_PAD * 2 + (sheets - 1) * GROUP_DX;
          const up = ((sheets - 1) / 2) * GROUP_DY + line;
          nodes.push({
            type: "group",
            id: opId,
            op: step.op,
            inner,
            sheets,
            cellH,
            x,
            // Hung off the line the tracks run on, so the chain inside the
            // front box is level with the row rather than the box being.
            y: cy - up,
            w,
            h,
            row,
            innerDy,
          });
          // Box i sits GROUP_DY higher and GROUP_DX further left than box
          // i-1, which is exactly the direction `sheetOffset` runs in, so the
          // pitch is positive.
          const groupPitch = GROUP_DY;
          const groupNode = nodes[nodes.length - 1] as PlacedGroup;
          const pierce = pierceTarget(groupNode);
          // Every box gets its own track. The instances all read the same
          // input, so when the source carries one copy this is a fan — without
          // it the boxes behind the front one have nothing arriving at them.
          prev.forEach((from, at) => {
            edges.push({
              from,
              to: opId,
              fromLanes: prevLanes[at] ?? lanes,
              toLanes: sheets,
              bundle,
              fromPitch: pitch,
              fromStagger:
                (prevLanes[at] ?? lanes) > 1 ? STACK_DX : undefined,
              toPitch: groupPitch,
              toStagger: GROUP_DX,
              toCentre: cy,
              // Both ends when both are stacks: each draws its own half, so the
              // leg leaving sheet i is covered by the source's nearer sheets
              // and the leg arriving at box i by the boxes in front of it.
              ownedBySource: (prevLanes[at] ?? lanes) > 1,
              ownedByTarget: true,
              pierce,
            });
          });
          x += colOpW + GAP_X;
          const tid = `s${si}r${row}t${k}`;
          nodes.push({
            type: "tensor",
            id: tid,
            tensor: step.out,
            x,
            y: cy - TENSOR_H / 2,
            w: stackedWidth(after),
            h: TENSOR_H,
            row,
            lanes: after,
            weight: false,
          });
          edges.push({
            from: opId,
            to: tid,
            fromLanes: sheets,
            toLanes: after,
            fromPitch: groupPitch,
            fromStagger: GROUP_DX,
            fromCentre: cy,
            toStagger: after > 1 ? STACK_DX : undefined,
            ownedBySource: true,
            ownedByTarget: after > 1,
            exit: exitPoint(groupNode),
          });
          lanes = after;
          pitch = undefined;
          if (step.out.label)
            produced.set(step.out.label, { id: tid, lanes: after, right: x + stackedWidth(after) });
          x += colTensorW + GAP_X;
          prev = [tid];
          prevLanes = [after];
          return;
        }

        const opSheets = sheetsFor(step.op.repeat ?? 1);
        const opW = stackedOpWidth(opSheets);
        /** Where the topmost sheet sits, relative to the centre sheet. */
        const backDy = sheetOffset(opSheets - 1, opSheets);
        nodes.push({
          type: "op",
          id: opId,
          op: step.op,
          outDims: step.out.dims,
          x,
          y: cy - OP_H / 2,
          w: opW,
          h: OP_H,
          row,
          lanesIn: lanes,
          lanesOut: after,
          sheets: opSheets,
        });

        // Parameter 0 sits nearest the operator; the rest pile upwards. One
        // spelling for the id, because `w` and `w0` as two names for the same
        // node left every pile's second parameter pointing at nothing.
        const widOf = (k: number) => (k === 0 ? `${opId}w` : `${opId}w${k}`);
        weightNodesOf(step.op).forEach((stored, at) => {
          const wid = widOf(at);
          nodes.push({
            type: "tensor",
            id: wid,
            tensor: { dims: stored.dims, label: stored.label },
            x: x + (opW - TENSOR_W) / 2,
            y: cy - OP_H / 2 + backDy - WEIGHT_DY - at * WEIGHT_STEP,
            w: TENSOR_W,
            h: TENSOR_H,
            row,
            lanes: 1,
            weight: true,
            dtype: stored.dtype,
          });
          edges.push({
            from: wid,
            to: at === 0 ? opId : widOf(at - 1),
            fromLanes: 1,
            toLanes: 1,
            vertical: true,
            // Onto the topmost sheet's glyph, which is what the drop line
            // passes over on its way down. A parameter above another drops
            // onto that one's box, which has no glyph inset.
            topInset:
              at === 0
                ? backDy + glyphGeom(step.op, lo, hi, lanes, after).top
                : 0,
          });
        });

        /**
         * Tracks at an operator's two edges, counted separately.
         *
         * Arriving: one per copy, and one per instance when the operator is a
         * stack — every instance reads the same input, so four sheets need four
         * tracks in, not one. Leaving: one per copy of the OUTPUT. Reusing the
         * incoming count on the way out drew a four-into-one gather on the far
         * side of `sum copies`, after the glyph had already reduced them.
         */
        const tracksIn = Math.max(lanes, opSheets);
        const tracksOut = Math.max(after, opSheets);
        prev.forEach((from, at) => {
          const fromLanes = prevLanes[at] ?? lanes;
          edges.push({
            from,
            to: opId,
            fromLanes,
            toLanes: tracksIn,
            bundle,
            fromPitch: pitch,
            // Sheets recede leftward, so sheet i's right edge is i steps short
            // of the pile's — a track leaving it has to start there, not at the
            // bounding box's edge.
            fromStagger: fromLanes > 1 ? STACK_DX : undefined,
            toStagger: opSheets > 1 ? STACK_DX : undefined,
            // Each stacked end owns its own half of the track.
            ownedBySource: fromLanes > 1,
            ownedByTarget: opSheets > 1,
          });
        });
        x += colOpW + GAP_X;

        if (
          frame.omitExit &&
          si === type.sections.length - 1 &&
          k === chain.steps.length - 1
        ) {
          // Whatever is to the right draws this one. The operator is what
          // leaves the picture.
          lanes = after;
          pitch = undefined;
          x += colOpW;
          prev = [opId];
          prevLanes = [after];
          return;
        }

        const tid = `s${si}r${row}t${k}`;
        nodes.push({
          type: "tensor",
          id: tid,
          tensor: step.out,
          x,
          y: cy - TENSOR_H / 2,
          w: stackedWidth(after),
          h: TENSOR_H,
          row,
          lanes: after,
          weight: false,
        });
        edges.push({
          from: opId,
          to: tid,
          fromLanes: tracksOut,
          toLanes: after,
          fromStagger: opSheets > 1 ? STACK_DX : undefined,
          toStagger: after > 1 ? STACK_DX : undefined,
          ownedBySource: opSheets > 1,
          ownedByTarget: after > 1,
        });
        lanes = after;
        pitch = undefined;
        if (step.out.label)
          produced.set(step.out.label, { id: tid, lanes: after, right: x + stackedWidth(after) });
        x += colTensorW + GAP_X;
        prev = [tid];
        prevLanes = [after];
      });

      endIds.push(...prev);
      endLanes.push(...prevLanes);
      outPitch = pitch;
      endX = Math.max(endX, x);
    });

    // A section that IS one instance box carries its name inside the box, and a
    // second frame around it with nothing written on it is just a line.
    const span = bandSpan(si);
    if (section.label) bands.push({
      label: section.label,
      note: section.note,
      x: startX - BAND_PAD_X,
      // `endX - GAP_X` is the right edge of the last column; the band clears it
      // by the same padding it keeps on the left.
      w: endX - GAP_X + BAND_PAD_X - (startX - BAND_PAD_X),
      y: span.y - BAND_PAD,
      h: span.h + BAND_PAD * 2,
    });
    /*
     * A chain whose output something else already reads does NOT also feed the
     * next section.
     *
     * This is where the false edges came from: `pre post comb` is read by
     * `scale by pre` and by the two operators of `hc_post`, and because the
     * picture had no way to say so, its chain was wired onwards like any other
     * and appeared to feed `attn_norm`.
     */
    const kept = endIds
      .map((id, at) => ({ id, lanes: endLanes[at] }))
      .filter((e) => !claimed.has(e.id));
    incoming = kept.length
      ? { ids: kept.map((e) => e.id), lanes: kept.map((e) => e.lanes), pitch: outPitch }
      : { ids: endIds, lanes: endLanes, pitch: outPitch };
    cursor = endX;
  });

  if (frame.leadOut) {
    // The mirror of the lead-in: outside the right edge, so the tracks out of
    // the last tensor are clipped to stop on the edge and whatever continues
    // there picks them up.
    // Whatever leaves carries the widest of the ends that reach here.
    const outLanes = Math.max(...incoming.lanes, 1);
    const outW = stackedWidth(outLanes);
    nodes.push({
      type: "tensor",
      id: "trail",
      tensor: type.io,
      x: cursor,
      y: exitCentre - TENSOR_H / 2,
      w: outW,
      h: TENSOR_H,
      row: 0,
      lanes: outLanes,
      weight: false,
      lead: true,
    });
    incoming.ids.forEach((from, at) => {
      const fromLanes = laneOf(incoming.lanes, at);
      const node = nodes.find((n) => n.id === from);
      const sheets =
        node?.type === "tensor"
          ? sheetsFor(node.lanes)
          : node?.type === "op"
            ? node.sheets
            : 1;
      edges.push({
        from,
        to: "trail",
        fromLanes,
        toLanes: outLanes,
        bundle: incoming.ids.length > 1 ? "gather" : undefined,
        fromPitch: incoming.pitch,
        fromStagger: sheets > 1 ? STACK_DX : undefined,
        toStagger: outLanes > 1 ? STACK_DX : undefined,
        ownedBySource: sheets > 1,
      });
    });
  }

  /*
   * Rails for the carry edges, below everything else.
   *
   * Two carries share a rail when their spans do not overlap — greedy, lowest
   * free rail first — so a label used once per sub-layer stays on one line
   * across the whole picture instead of stepping down each time.
   */
  const contentBottom = mid + tallestSection / 2 + PAD_BOTTOM;
  const railEnd: number[] = [];
  for (const carry of carries.sort((a, b) => a.from - b.from)) {
    let at = railEnd.findIndex((end) => end <= carry.from);
    if (at < 0) at = railEnd.length;
    railEnd[at] = carry.to;
    carry.edge.rail = contentBottom + RAIL_GAP + at * RAIL_STEP;
  }
  if (unresolved.length)
    // Loud, because a `uses` naming a tensor nothing produces is a dependency
    // the picture silently drops — exactly what `uses` exists to prevent.
    throw new Error(
      `uses names tensors nothing produces: ${[...new Set(unresolved)].join(", ")}`,
    );

  return {
    nodes,
    edges,
    bands,
    width: frame.leadOut ? cursor : cursor - GAP_X + PAD_X,
    height:
      contentBottom +
      (railEnd.length ? RAIL_GAP + (railEnd.length - 1) * RAIL_STEP + RAIL_GAP : 0),
    // The line the graph enters on — what a group centres its box on, and what
    // the strip lines its own centre up with when the layer is opened in place.
    // With several inputs it is the first one's: that is the one continuing a
    // line from outside.
    centre: entryY(0),
    exit: exitCentre,
  };
}

/**
 * Where the front box's contents begin: the left edge and vertical centre of
 * the tensor its chain starts from. An incoming track runs to this point rather
 * than stopping at the box's edge or aiming at the box's middle.
 */
export function pierceTarget(group: PlacedGroup): { x: number; y: number } {
  const frontX = (group.sheets - 1) * GROUP_DX;
  const frontY = (group.sheets - 1) * GROUP_DY;
  const entry = group.inner.nodes[0];
  return {
    x: group.x + frontX + GROUP_PAD + (entry?.x ?? 0),
    y:
      group.y +
      frontY +
      group.innerDy +
      (entry ? entry.y + entry.h / 2 : group.inner.centre),
  };
}

/**
 * Where the front box's contents end: the right edge and vertical centre of the
 * last node in its chain — the point an outgoing track leaves from.
 */
export function exitPoint(group: PlacedGroup): { x: number; y: number } {
  const frontX = (group.sheets - 1) * GROUP_DX;
  const frontY = (group.sheets - 1) * GROUP_DY;
  let last = group.inner.nodes[0];
  for (const node of group.inner.nodes) {
    if (node.x + node.w > last.x + last.w) last = node;
  }
  return {
    x: group.x + frontX + GROUP_PAD + (last ? last.x + last.w : 0),
    y:
      group.y +
      frontY +
      group.innerDy +
      (last ? last.y + last.h / 2 : group.inner.centre),
  };
}

/**
 * The path from one node to another.
 *
 * Horizontal runs and one right-angled turn, the turn always on the gutter
 * midpoint so every bend in the graph falls on the same line. When the two ends
 * carry different track counts the path gathers or fans instead: the many side
 * runs to the gutter, turns to the centre, and one line completes the trip — so
 * a `reduce` visibly takes in four tracks and emits one.
 */
/**
 * Which half of a track to draw.
 *
 * A track between two stacks belongs to two layers at once: the leg leaving
 * sheet i of the source has to be covered by the source's nearer sheets, and
 * the leg arriving at sheet i of the target by the target's. Drawn as one path
 * it can only live in one of them, and the other end's front sheets then have
 * lines lying across their faces. So each end draws its own half, split on the
 * bend, and the two halves meet on the same horizontal.
 */
export type EdgePart = "source" | "target";

export function edgePaths(
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
  edge: Edge,
  part?: EdgePart,
): string[] {
  if (edge.vertical) {
    // A weight drops onto the top of its operator's GLYPH. `topInset` is how
    // far the glyph starts below the box, so the line stops on the shape.
    const x = to.x + to.w / 2;
    return [`M${x},${from.y + from.h} V${to.y + (edge.topInset ?? 0)}`];
  }

  const c1 = edge.fromCentre ?? from.y + from.h / 2;
  const c2 = edge.toCentre ?? to.y + to.h / 2;

  if (edge.rail !== undefined) {
    // Down in the gutter behind the source, across, up in the gutter in front
    // of the target. Both turns are a half-gutter from the thing they belong
    // to, so neither lands on a node.
    const sx = from.x + from.w;
    const ex = to.x;
    const down = sx + GAP_X / 2;
    const up = ex - GAP_X / 2;
    return [`M${sx},${c1} H${down} V${edge.rail} H${up} V${c2} H${ex}`];
  }
  // A receding stack's boxes end at different x, so each track does too.
  const fromX = (i: number) =>
    from.x + from.w - (edge.fromStagger ? i * edge.fromStagger : 0);
  const toX = (i: number, count: number) =>
    to.x + (edge.toStagger ? (count - 1 - i) * edge.toStagger : 0);
  const x1 = fromX(0);
  const x2 = toX(0, 1);
  const n = sheetsFor(Math.max(edge.fromLanes, edge.toLanes));
  /**
   * Track i's offset from the centre line — the SAME expression `sheetOffset`
   * places sheets and instance boxes with. Written the other way round once,
   * it silently paired track i with sheet n-1-i, and every stacked tensor's
   * edges landed on the wrong sheet.
   */
  const fromTrack = (i: number, count: number) =>
    ((count - 1) / 2 - i) * (edge.fromPitch ?? STACK_DY);
  const toTrack = (i: number, count: number) =>
    ((count - 1) / 2 - i) * (edge.toPitch ?? STACK_DY);

  /**
   * The vertical every bend on this edge happens on. A bundle puts it on the
   * shared end's gutter so sibling edges bend together; otherwise it is the
   * edge's own midpoint, which for a lone edge is the same thing.
   */
  /**
   * Both kinds of bundle turn on the gutter in front of the TARGET.
   *
   * A gather has to, or its several sources — each a different distance away —
   * would each turn somewhere else. A fan does not have to, but it reads far
   * better there: anchored at the source, the tracks split the moment they
   * leave the tensor and then run to the section as four long verticals
   * standing in empty gutter, which is exactly what they looked like — a
   * picket fence between the previous layer and this one. Anchored at the
   * target they carry on along the line they arrived on and part where the
   * thing they are entering actually is.
   */
  /**
   * A turn belongs in a gutter, never in the middle of a long run.
   *
   * For two things standing next to each other the midpoint IS the gutter, so
   * that is what it used to be. But an edge that travels a long way to change
   * rows — the branch leaving the stack for the block that hangs off it — then
   * turned halfway along, which put its horizontal leg across everything on the
   * row it was leaving: the fork ran over `hc_head`, `norm` and `lm_head`
   * before dropping. Turning a gutter's width from the source instead, it
   * leaves its row at once and makes the journey on the row it is going to.
   *
   * Half a `GAP_X` from the source, which is the midpoint for neighbours —
   * every gutter is at least that wide — so nothing standing next to anything
   * moves. Further out and the turn lands ON the next thing along the row it is
   * leaving: at `BUNDLE_BEND` the branch's corner went under `hc_head`.
   *
   * A bundle still turns by its target: a gather's several sources are each a
   * different distance away, and only the target's gutter is one line for all
   * of them.
   */
  const bend = edge.bundle
    ? x2 - BUNDLE_BEND
    : x1 + Math.min(GAP_X / 2, (x2 - x1) / 2);

  /*
   * One complete path per track, in track order — so `paths[i]` is always
   * track i and a caller can hand path i to sheet i. A gather's paths share
   * their last leg and a fan's share their first, which is what makes them
   * read as converging or spreading; they are not separate lead-in lines,
   * because that shifted every index by one.
   */
  /**
   * Gather, fan or parallel is decided by the TRACK counts, not the copy
   * counts.
   *
   * `sheetsFor` caps a pile at `STACK_MAX`, so sixteen copies and four
   * instances are both four tracks and belong side by side — compared raw,
   * sixteen against four read as a gather and every track landed somewhere
   * else. It only ever agreed because the model this was written against has
   * `hc_mult` equal to the cap.
   */
  const fromTracks = sheetsFor(edge.fromLanes);
  const toTracks = sheetsFor(edge.toLanes);

  if (fromTracks === toTracks) {
    const count = fromTracks;
    return Array.from({ length: count }, (_, i) => {
      const exited = i === 0 && edge.exit;
      const y1 = exited ? edge.exit!.y : c1 + fromTrack(i, count);
      const pierced = i === 0 && edge.pierce;
      const y2 = pierced ? edge.pierce!.y : c2 + toTrack(i, count);
      const sx = exited ? edge.exit!.x : fromX(i);
      const ex = pierced ? edge.pierce!.x : toX(i, count);
      // Each parallel track turns on its own vertical, so the bundle reads as
      // the several tracks it is.
      const turn = bend + (count > 1 ? (i - (count - 1) / 2) * BEND_STEP : 0);
      if (part === "source") return `M${sx},${y1} H${turn}`;
      const rest =
        Math.abs(y1 - y2) < 0.5 ? `H${ex}` : `V${y2} H${ex}`;
      if (part === "target") return `M${turn},${y1} ${rest}`;
      return Math.abs(y1 - y2) < 0.5
        ? `M${sx},${y1} H${ex}`
        : `M${sx},${y1} H${turn} V${y2} H${ex}`;
    });
  }

  // Gather: every track runs to the bend, turns to the single centre, and the
  // last leg is shared.
  if (fromTracks > toTracks) {
    return Array.from({ length: n }, (_, i) => {
      const exited = i === 0 && edge.exit;
      const y1 = exited ? edge.exit!.y : c1 + fromTrack(i, n);
      const sx = exited ? edge.exit!.x : fromX(i);
      if (part === "source") return `M${sx},${y1} H${bend}`;
      if (part === "target") return `M${bend},${y1} V${c2} H${x2}`;
      return `M${sx},${y1} H${bend} V${c2} H${x2}`;
    });
  }

  // Fan: every track leaves the single centre, turns at the bend, and arrives
  // on its own sheet.
  return Array.from({ length: n }, (_, i) => {
    const pierced = i === 0 && edge.pierce;
    const y2 = pierced ? edge.pierce!.y : c2 + toTrack(i, n);
    const ex = pierced ? edge.pierce!.x : toX(i, n);
    if (part === "source") return `M${x1},${c1} H${bend}`;
    if (part === "target") return `M${bend},${c1} V${y2} H${ex}`;
    return `M${x1},${c1} H${bend} V${y2} H${ex}`;
  });
}

/* -------------------------------------------------------------------------
 * Overview
 * ---------------------------------------------------------------------- */

/** Narrowest a layer chip is ever drawn, and the gap between chips. */
export const CHIP_W = 11;
export const CHIP_GAP = 2;
export const STACK_H = 56;
/** Clear space either side of a chip's label. */
export const CHIP_PAD = 5;
/** Width of one character at the chip label's font size. */
const CHIP_CH = 5.6;

/**
 * What is written inside the chip for layer `i`.
 *
 * The checkpoint's own index, zero-based: this chip is `layers.7` in the
 * safetensors file, and a picture that numbered it 8 would be one more thing
 * the reader has to convert.
 */
export function chipLabel(layer: number): string {
  return `L${layer}`;
}

/**
 * One width for every chip in a stack of `layerCount` layers, taken from the
 * widest label it will have to hold.
 *
 * Uniform on purpose: the pitch is what a cut is computed by (`splice`), and a
 * per-chip width would make the position of layer `i` a sum instead of a
 * product. So `L7` in a stack of 128 is as wide as `L127`.
 */
export function chipWidth(layerCount: number): number {
  const widest = chipLabel(Math.max(layerCount - 1, 0)).length;
  return Math.max(CHIP_W, Math.ceil(widest * CHIP_CH) + CHIP_PAD * 2);
}

/** The layer stack, sitting on the same line as the rest of the overview. */
export interface PlacedStack {
  type: "stack";
  id: string;
  /**
   * Set when this is not the layer stack but a block hanging off it — the name
   * to write beside it, since one chip on its own says nothing.
   */
  branch?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  /** Which layer type each layer index belongs to. */
  typeOf: number[];
  /**
   * Width of one chip, and with `CHIP_GAP` the pitch between them.
   *
   * Carried on the node rather than read from a constant, because it depends
   * on how many layers there are — and because the renderer, `splice` and the
   * assertions all need the SAME number. Read as a constant in three places,
   * one of them would have been stale.
   */
  chipW: number;
}

export type OverviewNode = PlacedNode | PlacedStack;

export interface Overview {
  nodes: OverviewNode[];
  edges: Edge[];
  width: number;
  height: number;
  /** The one line everything in the strip hangs off, measured from the top. */
  centre: number;
}

/**
 * The whole model on one line: embedding, the layer stack, the head.
 *
 * Same exact-accumulation rule as a layer, and the stack is just another node
 * in the chain — so the strip is wired like everything else rather than being a
 * row of boxes that happen to sit side by side.
 */
/** How far below the line the branch row runs. */
export const BRANCH_DROP = STACK_H / 2 + 46;

export function layoutOverview(
  /** The model's own input, drawn before the embedding. */
  input: ArchTensor,
  prologue: ArchChainLike,
  epilogue: ArchChainLike,
  layerCount: number,
  typeOf: number[],
  lo = 1,
  hi = 1,
  /**
   * The block that hangs off the stack rather than sitting in it.
   *
   * Drawn on a second line, fed from the state the stack ends on — the same
   * state the model's own head reads. It is placed past the end of the first
   * line, not under it: opening it cuts the strip where its chip is, and a cut
   * in the middle would have put the whole block between `norm` and `lm_head`.
   */
  branch?: {
    label: string;
    /** What it is fed. */
    io: ArchTensor;
    /** What it produces — drawn after it, like every other block's output. */
    out: ArchTensor;
    /**
     * How far its output line sits below its input line. Its own picture steps
     * down by this, so the strip steps with it and both seams meet.
     */
    drop: number;
  },
): Overview {
  const nodes: OverviewNode[] = [];
  const edges: Edge[] = [];
  /** The one centre line everything in the strip hangs off. */
  // The strip is one line and has no rails, so a dependency that is not the
  // straight line cannot be drawn there. Loud rather than silent: dropped
  // quietly, a spec would state a dependency the picture never shows.
  for (const step of [...prologue.steps, ...epilogue.steps])
    if (step.uses?.length || step.detached)
      throw new Error(
        `the strip cannot draw a carry: ${step.op.label} declares uses/detached`,
      );

  // The tallest pile of stored parameters in the strip, since they hang above
  // the line and the whole strip has to make room for the highest one.
  const stored = Math.max(
    0,
    ...prologue.steps.map((step) => weightNodesOf(step.op).length),
    ...epilogue.steps.map((step) => weightNodesOf(step.op).length),
  );
  const cy =
    (stored > 0
      ? PAD_TOP_WEIGHT + (stored - 1) * WEIGHT_STEP
      : PAD_TOP_PLAIN) +
    OP_H / 2;
  let cursor = PAD_X;
  let prev: string | null = null;
  /** Only a tensor draws its own tracks; the layer stack is one solid block. */
  let prevIsTensor = false;
  let lanes = lanesOf(input);

  nodes.push({
    type: "tensor",
    id: "input",
    tensor: input,
    x: cursor,
    y: cy - TENSOR_H / 2,
    w: stackedWidth(lanes),
    h: TENSOR_H,
    row: 0,
    lanes,
    weight: false,
    dtype: input.dtype,
  });
  prev = "input";
  prevIsTensor = true;
  cursor += stackedWidth(lanes) + GAP_X;

  /**
   * The tensor flowing at `cursor`, which is what the stack hands on.
   *
   * Written as `branch?.io ?? input` once, which is the hanging block's input
   * and happens to be the same tensor — so the strip was right only while the
   * block was shown, and with it hidden the stack's output was captioned with
   * the model's token ids.
   */
  let flow = input;

  const chain = (steps: ArchChainLike["steps"], tag: string) => {
    steps.forEach((step, k) => {
      const opId = `${tag}o${k}`;
      const lanesOutOf = lanesAfter(step, lanes, lanesOf(step.out) || 1);
      const sheets = sheetsFor(step.op.repeat ?? 1);
      nodes.push({
        type: "op",
        id: opId,
        op: step.op,
        outDims: step.out.dims,
        x: cursor,
        y: cy - OP_H / 2,
        w: stackedOpWidth(sheets),
        h: OP_H,
        row: 0,
        lanesIn: lanes,
        lanesOut: lanesOutOf,
        sheets,
      });
      const widOf = (k: number) => (k === 0 ? `${opId}w` : `${opId}w${k}`);
      weightNodesOf(step.op).forEach((held, at) => {
        const wid = widOf(at);
        nodes.push({
          type: "tensor",
          id: wid,
          tensor: { dims: held.dims, label: held.label },
          x: cursor + (stackedOpWidth(sheets) - TENSOR_W) / 2,
          y: cy - OP_H / 2 - WEIGHT_DY - at * WEIGHT_STEP,
          w: TENSOR_W,
          h: TENSOR_H,
          row: 0,
          lanes: 1,
          weight: true,
          dtype: held.dtype,
        });
        edges.push({
          from: wid,
          to: at === 0 ? opId : widOf(at - 1),
          fromLanes: 1,
          toLanes: 1,
          vertical: true,
          topInset:
            at === 0 ? glyphGeom(step.op, lo, hi, lanes, lanesOutOf).top : 0,
        });
      });
      if (prev)
        edges.push({
          from: prev,
          to: opId,
          fromLanes: lanes,
          toLanes: Math.max(lanes, sheets),
          // Only a receding pile of sheets staggers; the layer stack is a row
          // of chips, and staggering it started three of the four tracks a
          // sheet's width INSIDE the chips — visible in the gaps between them,
          // and chopped in half the moment the strip is cut there to open a
          // layer.
          fromStagger: lanes > 1 && prevIsTensor ? STACK_DX : undefined,
          toStagger: sheets > 1 ? STACK_DX : undefined,
          // Same rule as a layer's own graph: each stacked end draws its half
          // of the track, so a sheet never has a line lying across its face.
          ownedBySource: lanes > 1 && prevIsTensor,
          ownedByTarget: sheets > 1,
        });
      cursor += stackedOpWidth(sheets) + GAP_X;

      const after = lanesOutOf;
      const tid = `${tag}t${k}`;
      nodes.push({
        type: "tensor",
        id: tid,
        tensor: step.out,
        x: cursor,
        y: cy - TENSOR_H / 2,
        w: stackedWidth(after),
        h: TENSOR_H,
        row: 0,
        lanes: after,
        weight: false,
      });
      edges.push({
        from: opId,
        to: tid,
        fromLanes: Math.max(after, sheets),
        toLanes: after,
        fromStagger: sheets > 1 ? STACK_DX : undefined,
        toStagger: after > 1 ? STACK_DX : undefined,
        ownedBySource: sheets > 1,
        ownedByTarget: after > 1,
      });
      lanes = after;
      flow = step.out;
      cursor += stackedWidth(after) + GAP_X;
      prev = tid;
      prevIsTensor = true;
    });
  };

  chain(prologue.steps, "p");

  const chipW = chipWidth(layerCount);
  const stackW = layerCount * chipW + Math.max(layerCount - 1, 0) * CHIP_GAP;
  const stackId = "stack";
  nodes.push({
    type: "stack",
    id: stackId,
    x: cursor,
    y: cy - STACK_H / 2,
    w: stackW,
    h: STACK_H,
    row: 0,
    typeOf,
    chipW,
  });
  if (prev)
    edges.push({
      from: prev,
      to: stackId,
      fromLanes: lanes,
      toLanes: lanes,
      fromStagger: lanes > 1 ? STACK_DX : undefined,
      // The stack cannot draw tracks of its own, so the tensor owns the whole
      // line — it is drawn first, and the chips cover where it arrives.
      ownedBySource: lanes > 1 && prevIsTensor,
    });
  prev = stackId;
  prevIsTensor = false;
  cursor += stackW + GAP_X;

  // What the stack hands on. Drawn because every other operator in the strip
  // has its input drawn, and because it is where the branch forks from.
  const outId = "stackOut";
  nodes.push({
    type: "tensor",
    id: outId,
    tensor: flow,
    x: cursor,
    y: cy - TENSOR_H / 2,
    w: stackedWidth(lanes),
    h: TENSOR_H,
    row: 0,
    lanes,
    weight: false,
  });
  edges.push({
    from: stackId,
    to: outId,
    fromLanes: lanes,
    toLanes: lanes,
    toStagger: lanes > 1 ? STACK_DX : undefined,
    ownedByTarget: lanes > 1,
  });
  prev = outId;
  prevIsTensor = true;
  /**
   * How many copies the stack hands on.
   *
   * Taken here, not after the epilogue: the epilogue's `hc_head` folds the
   * copies to one, and the branch forks from BEFORE that. Read afterwards, the
   * fork handed over a single track to a block expecting four.
   */
  const forkLanes = lanes;
  cursor += stackedWidth(lanes) + GAP_X;

  chain(epilogue.steps, "e");

  if (branch) {
    const line = cy + BRANCH_DROP;
    nodes.push({
      type: "stack",
      id: "branch",
      x: cursor,
      y: line - STACK_H / 2,
      w: chipW,
      h: STACK_H,
      row: 1,
      typeOf: [0],
      chipW,
      branch: branch.label,
    });
    edges.push({
      from: outId,
      to: "branch",
      fromLanes: forkLanes,
      toLanes: forkLanes,
      fromStagger: forkLanes > 1 ? STACK_DX : undefined,
      ownedBySource: forkLanes > 1,
    });
    // The name is a caption under the chip, the way a tensor's role is: one
    // chip on its own says nothing, and written beside it the line out would
    // have had to start past the text.
    cursor += Math.max(chipW, Math.round(branch.label.length * 5.6)) + GAP_X;

    // What it produces. The strip steps down with the block's own step, so the
    // line arriving at this tensor and the line leaving the block are one.
    const outLanes = lanesOf(branch.out);
    nodes.push({
      type: "tensor",
      id: "branchOut",
      tensor: branch.out,
      x: cursor,
      y: line + branch.drop - TENSOR_H / 2,
      w: stackedWidth(outLanes),
      h: TENSOR_H,
      row: 1,
      lanes: outLanes,
      weight: false,
    });
    edges.push({
      from: "branch",
      to: "branchOut",
      fromLanes: outLanes,
      toLanes: outLanes,
      toStagger: outLanes > 1 ? STACK_DX : undefined,
      ownedByTarget: outLanes > 1,
    });
    cursor += stackedWidth(outLanes) + GAP_X;
  }

  return {
    nodes,
    edges,
    width: cursor - GAP_X + PAD_X,
    height:
      cy +
      (branch ? BRANCH_DROP + Math.max(0, branch.drop) : 0) +
      Math.max(OP_H, STACK_H) / 2 +
      PAD_BOTTOM,
    centre: cy,
  };
}

/** Just the part of a chain the overview reads. */
interface ArchChainLike {
  // The full step, so the strip can refuse a dependency it cannot draw rather
  // than ignore it.
  steps: ArchStep[];
}
