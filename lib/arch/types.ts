import type { HfConfig, ModelShape } from "../hf-model";

/**
 * The model-architecture diagram's data contract.
 *
 * USER-OWNED: this directory is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * One `ArchSpec` per architecture, keyed by the `architectures` entry in
 * config.json and named after it. Written by hand against an implementation —
 * usually vLLM's, which covers 207 of the 216 modules its registry names; the
 * remaining 9 live outside the vLLM tree and fall back to whatever reference
 * implementation the model repo ships. No heuristic infers topology, because
 * topology is in neither the config nor the tensor names.
 *
 * **Original operators, not fused ones.** vLLM runs a fused `qkv_proj` where
 * the checkpoint holds `q_proj` / `k_proj` / `v_proj`, and its
 * `packed_modules_mapping` says exactly which. A spec un-fuses back to the
 * originals, so each glyph corresponds to one stored tensor whose shape can be
 * verified; `ArchOp.fusedInto` keeps the pointer to the fused kernel a trace
 * would show. The same goes for the three computational fusions vLLM uses:
 * `SiluAndMul` is drawn as SiLU then a product, `norm(x, residual)` as an add
 * then a norm, and `rotary_emb(pos, q, k)` as one RoPE per path.
 *
 * Widths ARE derivable: every one is computed from config fields, and checked
 * against the safetensors headers before a spec is committed.
 */

/** A dimension: a number, or a symbolic axis like "b" (batch) or "s" (seq). */
export type Dim = number | string;

/** A tensor flowing between operators. */
export interface ArchTensor {
  dims: Dim[];
  /** What it is, e.g. "hidden", "q", "kv latent". */
  label?: string;
  /** Storage dtype when it differs from the model's default. */
  dtype?: string;
  /**
   * Parallel copies of the SAME state this tensor carries — what
   * hyper-connections keep. Declared, never inferred from the shape: `[b,s,8,d]`
   * is eight attention heads in one architecture and eight copies in another,
   * and only the spec knows which. Drawn as that many tracks and sheets.
   */
  copies?: number;
}

/**
 * What an operator is, which fixes both its glyph and its grey.
 *
 * "linear" draws as a trapezoid whose two parallel edges are `inDim` and
 * `outDim`, so a low-rank projection looks low-rank.
 */
export type OpKind =
  | "linear"
  | "norm"
  | "attention"
  | "route"
  | "expert"
  | "elementwise"
  | "reshape"
  | "embed"
  | "reduce"
  | "expand";

/**
 * A stored parameter an operator uses besides its main weight.
 *
 * A bias, a scale, a lookup table. Each is its own tensor in the checkpoint
 * with its own shape and dtype, so each is drawn as its own node rather than
 * folded into a sentence — an operator that reads three stored tensors and
 * shows one is an operator whose glyph cannot be traced.
 */
export interface ArchExtra {
  /** Tensor name in the checkpoint, spelled as `ArchOp.weight` is. */
  name: string;
  shape: Dim[];
  dtype?: string;
}

export interface ArchOp {
  kind: OpKind;
  label: string;
  /** Weight tensor name in the checkpoint — how a glyph is traced back. */
  weight?: string;
  /** Widths of a linear map, in and out. */
  inDim?: number;
  outDim?: number;
  /**
   * The weight tensor's own shape, drawn as a node feeding the operator.
   * Defaults to `[outDim, inDim]` for a linear map — the order PyTorch stores
   * them in — so a spec only sets this when the weight is not a plain matrix
   * (a stack of experts, a lookup table).
   */
  weightShape?: Dim[];
  /** Precision of the weight tensor, shown on that tensor. */
  dtype?: string;
  /**
   * Stored parameters besides `weight`, drawn stacked above it.
   *
   * The hyper-connection's mixing projection is stored as three tensors
   * (`hc_attn_fn`, `hc_attn_base`, `hc_attn_scale`) that go into one kernel
   * together; the router of a hash-routed layer reads both a token-id table
   * and a score matrix. Drawing one and omitting the rest loses 346 of this
   * architecture's tensors.
   */
  extras?: ArchExtra[];
  /**
   * How many identical instances of this operator exist — 256 experts, 8
   * output groups, one per hyper-connection copy. Drawn as that many boxes
   * stacked, not as one box with a number beside it.
   */
  repeat?: number;
  /** How many of those instances a single token actually goes through. */
  active?: number;
  /**
   * What ONE instance contains, for the reader who opens the stack. Inside it
   * there is a single copy of the data, so the shapes here are one instance's,
   * not the stack's.
   */
  inner?: ArchSection[];
  /**
   * The fused operator vLLM folds this one into, when it does
   * (`q_proj` → `qkv_proj`). The diagram draws the ORIGINAL operator, so every
   * glyph matches one real checkpoint tensor and its shape can be checked
   * against the safetensors header — but a kernel trace names the fused one, so
   * the link is kept here.
   */
  fusedInto?: string;
  /** Only present when tensor parallel is on; not drawn at TP = 1. */
  tpOnly?: boolean;
  /** One short line of explanation. */
  note?: string;
}

/** One operator and the tensor it produces. */
export interface ArchStep {
  op: ArchOp;
  out: ArchTensor;
  /**
   * Tensors this step ALSO reads, named by their `label`, produced somewhere
   * else in the same block.
   *
   * A step's ordinary input is whatever the thing before it produced. That
   * covers a straight line and nothing else, and this architecture is full of
   * dependencies that are not straight: `scale by pre` reads the Sinkhorn
   * weights from the sibling chain, `add comb residual` reads the copies the
   * sub-layer started from, the indexer's top-k reads the compressed kv its
   * own compressor made.
   *
   * Undeclared, those dependencies were invisible AND the picture drew false
   * ones in their place: a chain that feeds a sibling was wired into the next
   * section instead, so `pre post comb` appeared to feed `attn_norm`. A tensor
   * named here is NOT auto-wired onwards, which is what removes them.
   *
   * The label must be produced earlier in the block; the most recent producer
   * wins, so a label reused per sub-layer resolves to that sub-layer's own.
   */
  uses?: string[];
  /**
   * This step does NOT read what the step before it produced — `uses` is the
   * whole of its input.
   *
   * The compressor's gate projection reads the hidden state, not the kv the
   * projection beside it just made; the indexer's `wq_b` reads the Q latent,
   * not the hidden state. A chain is a line, and these two are not on it.
   */
  detached?: boolean;
}

/** A run of operators along one path (the Q path, the KV path, …). */
export interface ArchChain {
  label?: string;
  steps: ArchStep[];
}

/**
 * A block of the layer diagram. `parallel` chains happen to the same input;
 * `sequence` chains follow one another.
 */
export interface ArchSection {
  label: string;
  kind: "sequence" | "parallel";
  chains: ArchChain[];
  note?: string;
}

/** One kind of layer, and which layer indices are of that kind. */
export interface ArchLayerType {
  id: string;
  label: string;
  /** Layer indices, ascending. */
  layers: number[];
  /** What makes this kind different from the others. */
  note?: string;
  /** The tensor the layer takes in and hands on. */
  io: ArchTensor;
  /**
   * Everything it is given, when that is more than `io` alone — input `i` feeds
   * chain `i` of the first section. The MTP block is the case: it takes the
   * stack's hidden state and, separately, the next token.
   */
  inputs?: ArchTensor[];
  sections: ArchSection[];
}

/** The whole model: what surrounds the stack, and the stack itself. */
export interface ArchModel {
  /** `architectures[0]`, as the config spells it. */
  arch: string;
  /**
   * What the model is given: the token ids, before anything has touched them.
   *
   * The overview strip used to start at the embedding — an operator with
   * nothing arriving at it, the only glyph in either picture with a bare edge.
   */
  input: ArchTensor;
  /** Before the layers (embedding) and after them (final norm, LM head). */
  prologue: ArchChain;
  epilogue: ArchChain;
  layerTypes: ArchLayerType[];
  /**
   * The multi-token-prediction block, when the model has one.
   *
   * Not a member of `layerTypes`, because it is not in the stack: it hangs off
   * the stack's output and produces logits of its own, beside the model's. It
   * is drawn only in MTP mode.
   */
  mtp?: ArchLayerType;
  /** Layers in the stack. The MTP block is not one of them. */
  layerCount: number;
  /**
   * Where the topology came from — shown in the UI, because a diagram that
   * cannot be traced to an implementation is a guess.
   *
   * `path` is relative to the model repo, not an absolute URL: one spec serves
   * every model that declares the architecture, so the link is resolved against
   * whichever repo is loaded. `upstream` is for a topology read somewhere else
   * entirely (the transformers or vLLM source).
   */
  source: {
    label: string;
    path?: string;
    upstream?: string;
    /**
     * The implementation's `packed_modules_mapping`, carried verbatim: fused
     * name → the original operators it packs. Shown so a reader can tell which
     * glyphs will appear as one kernel in a profile.
     */
    packedModules?: Record<string, string[]>;
  };
  /** Anything the spec chose not to draw, named so the omission is visible. */
  omitted?: string[];
}

/** What a spec gets to build from. */
export interface ArchInput {
  config: HfConfig;
  shape: ModelShape;
  /** Extra repo files the spec asked for, parsed — keyed by path. */
  extra: Record<string, HfConfig | undefined>;
}

export interface ArchSpec {
  /** `architectures` entries this spec answers for. */
  arch: string[];
  /**
   * Repo files to fetch beside config.json, relative to the repo root. Kept
   * per-spec because what a model publishes is the model's business:
   * DeepSeek-V4-Flash keeps its per-layer `compress_ratios` in
   * `inference/config.json`, and nothing in the root config implies them.
   */
  extraFiles?: string[];
  build(input: ArchInput): ArchModel;
}
