import type {
  ArchChain,
  ArchInput,
  ArchOp,
  ArchSection,
  ArchStep,
  ArchTensor,
  Dim,
} from "./types";

/**
 * Pieces shared across architecture specs.
 *
 * USER-OWNED. A spec in this directory describes ONE `architectures` entry, for
 * every model that declares it — so nothing here, and nothing in a spec, may
 * hard-code a number from a particular checkpoint. Every width is read from the
 * config of the model being rendered.
 *
 * What belongs here: the vocabulary that recurs across architectures (a linear
 * map, an RMSNorm, a SwiGLU expert, a top-k router, the layer-bucketing rule).
 * What belongs in a spec: the topology, and whatever that architecture does
 * that nothing else does.
 */

/**
 * A tensor node. `copies` is for parallel copies of the same state (see
 * `ArchTensor.copies`) — leave it out unless the architecture really keeps
 * several, because it is what the diagram draws tracks for.
 */
export function tensor(
  dims: Dim[],
  label?: string,
  copies?: number,
): ArchTensor {
  return { dims, label, copies };
}

/**
 * First numeric value among `keys`, searched across the root config and every
 * extra file the spec asked for.
 *
 * The aliases matter: the same quantity is spelled differently by the config a
 * model publishes for `transformers` and by the one its own reference
 * implementation reads (`hidden_size` vs. `dim`, `n_layers` vs.
 * `num_hidden_layers`).
 */
export function pickNum(
  input: ArchInput,
  ...keys: string[]
): number | undefined {
  const sources = [input.config, ...Object.values(input.extra)];
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

/** First array value among `keys`, as strings — e.g. `layer_types`. */
export function pickStrs(input: ArchInput, ...keys: string[]): string[] {
  const sources = [input.config, ...Object.values(input.extra)];
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key];
      if (Array.isArray(value)) return value.map(String);
    }
  }
  return [];
}

/** First array value among `keys`, coerced to numbers. */
export function pickNums(input: ArchInput, ...keys: string[]): number[] {
  const sources = [input.config, ...Object.values(input.extra)];
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key];
      if (Array.isArray(value)) return value.map(Number);
    }
  }
  return [];
}

/* -------------------------------------------------------------------------
 * Step builders
 * ---------------------------------------------------------------------- */

export function linear(
  label: string,
  inDim: number,
  outDim: number,
  out: ArchTensor,
  extra: Partial<ArchOp> = {},
): ArchStep {
  return { op: { kind: "linear", label, inDim, outDim, ...extra }, out };
}

export function norm(
  label: string,
  out: ArchTensor,
  extra: Partial<ArchOp> = {},
): ArchStep {
  return { op: { kind: "norm", label, weight: label, ...extra }, out };
}

/**
 * Rotary embedding. `ropeDim` is the trailing slice of each head it covers —
 * the whole head in most architectures, only part of it where the head is
 * split into positional and non-positional halves (MLA's nope/rope split).
 *
 * Every RoPE reads the model's `positions`, which the picture does not draw as
 * a tensor: it is the model's second input and it reaches five different
 * operators in DeepSeek-V4, so five lines would cross the whole diagram to say
 * something every reader of a RoPE already knows. The note says it instead,
 * and `omitted` declares the choice.
 */
export function rope(
  out: ArchTensor,
  ropeDim: number,
  headDim?: number,
): ArchStep {
  // `ropeDim` of zero means the config never stated one, so nothing is known
  // to be partial — written as `< headDim` alone it captioned the box
  // "last 0 of 512 dims".
  const partial = headDim !== undefined && ropeDim > 0 && ropeDim < headDim;
  return {
    op: {
      kind: "elementwise",
      label: "RoPE",
      note: partial
        ? `by position, last ${ropeDim} of ${headDim} dims`
        : "by position",
    },
    out,
  };
}

/**
 * The inverse rotation, which MLA applies to the attention OUTPUT before the
 * output projection — the rope half comes back out of the rotated frame.
 */
export function unrope(
  out: ArchTensor,
  ropeDim: number,
  headDim?: number,
): ArchStep {
  const partial = headDim !== undefined && ropeDim > 0 && ropeDim < headDim;
  return {
    op: {
      kind: "elementwise",
      label: "inverse RoPE",
      note: partial
        ? `by position, last ${ropeDim} of ${headDim} dims`
        : "by position",
    },
    out,
  };
}

export function reshape(label: string, out: ArchTensor): ArchStep {
  return { op: { kind: "reshape", label }, out };
}

/* -------------------------------------------------------------------------
 * Recurring blocks
 * ---------------------------------------------------------------------- */

/**
 * A low-rank projection pair: `d → rank → out`. Used by every architecture
 * that factors a big matrix (MLA's Q and O paths, LoRA-shaped heads).
 */
export function lowRankPair(
  names: { down: string; up: string; norm?: string },
  dim: number,
  rank: number,
  outDim: number,
  make: (width: number, label?: string) => ArchTensor,
  extra: Partial<ArchOp> = {},
): ArchStep[] {
  const steps: ArchStep[] = [
    linear(names.down, dim, rank, make(rank, "latent"), {
      weight: names.down,
      note: "low-rank down",
      ...extra,
    }),
  ];
  if (names.norm) steps.push(norm(names.norm, make(rank, "latent")));
  steps.push(
    linear(names.up, rank, outDim, make(outDim), {
      weight: names.up,
      ...extra,
    }),
  );
  return steps;
}

/**
 * A SwiGLU feed-forward expert — `w1`/`gate_proj` and `w3`/`up_proj` widen,
 * SiLU-gate, `w2`/`down_proj` narrows. The shape of nearly every modern FFN,
 * dense or routed; `repeat`/`active` say whether it is one or many.
 */
export function swigluExpert(
  label: string,
  weight: string,
  dim: number,
  interDim: number,
  out: ArchTensor,
  extra: Partial<ArchOp> = {},
): ArchStep {
  return {
    op: {
      kind: "expert",
      label,
      weight,
      inDim: dim,
      outDim: interDim,
      ...extra,
    },
    out,
  };
}

/** A score-then-top-k router: the usual MoE gate. */
export function topkRouter(
  label: string,
  weight: string,
  dim: number,
  experts: number,
  activated: number,
  out: ArchTensor,
  extra: Partial<ArchOp> = {},
): ArchStep {
  return {
    op: {
      kind: "route",
      label,
      weight,
      inDim: dim,
      outDim: experts,
      note: `top-${activated} of ${experts}`,
      ...extra,
    },
    out,
  };
}

/** Wraps steps into a one-chain section. */
export function sequence(
  label: string,
  steps: ArchStep[],
  note?: string,
): ArchSection {
  return { label, kind: "sequence", chains: [{ steps }], note };
}

/** Wraps several named paths over the same input into one section. */
export function parallel(
  label: string,
  chains: ArchChain[],
  note?: string,
): ArchSection {
  return { label, kind: "parallel", chains, note };
}

/* -------------------------------------------------------------------------
 * Layer typing
 * ---------------------------------------------------------------------- */

/**
 * Bucket layer indices by a key, keeping first-appearance order.
 *
 * Layers are NOT interchangeable — leading dense layers, alternating attention
 * kinds, hash-routed prefixes, MTP blocks — so every spec states what makes one
 * layer differ from another, and this turns that into the groups the diagram
 * folds. The result must be checkable against the safetensors index: if a key
 * splits layers the checkpoint cannot tell apart, or misses a split it can, the
 * spec is wrong.
 */
export function groupLayers(
  count: number,
  kindOf: (index: number) => string,
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key = kindOf(i);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  return buckets;
}

/** "0, 1", "2, 4, 6 … 42" — how a layer group is named in the UI. */
export function describeLayers(idxs: number[]): string {
  if (idxs.length <= 4) return idxs.join(", ");
  return `${idxs.slice(0, 3).join(", ")} … ${idxs[idxs.length - 1]}`;
}
