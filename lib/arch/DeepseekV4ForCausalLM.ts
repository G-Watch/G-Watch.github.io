import {
  describeLayers,
  groupLayers,
  linear,
  lowRankPair,
  norm,
  parallel,
  pickNum,
  pickNums,
  rope,
  sequence,
  swigluExpert,
  tensor,
  topkRouter,
  unrope,
} from "./common";
import type {
  ArchChain,
  ArchInput,
  ArchLayerType,
  ArchSection,
  ArchSpec,
  ArchStep,
} from "./types";

/**
 * `DeepseekV4ForCausalLM` — every model declaring this architecture
 * (DeepSeek-V4-Flash, V4-Pro, …). Nothing below hard-codes a width: all of them
 * come from the loaded model's config, so the same spec draws a 284 B and a
 * 1.6 T model at their own sizes.
 *
 * Topology from vLLM's own implementation of it, `vllm/models/deepseek_v4`
 * (`nvidia/model.py`, `attention.py`, `compressor.py`, `nvidia/mtp.py`).
 *
 * Weight names are the CHECKPOINT's, and for this architecture that is not a
 * matter of taste: `_make_deepseek_v4_weights_mapper` (nvidia/model.py:1862)
 * is what every repo declaring the architecture has to load through, and it
 * names the stored tensors `embed.weight`, `head.weight`, `norm.weight`,
 * `layers.N.…`, `hc_head*` and `mtp.N.…`. A glyph can only be traced if it is
 * labelled the way the file on disk is — so `embed`, not `embed_tokens`, and
 * `head`, not `lm_head`, however familiar those are from elsewhere.
 *
 * Three departures from a textbook decoder, all drawn rather than smoothed:
 *
 *   1. **Hyper-Connections.** The hidden state is not [b,s,d] but
 *      [b,s,hc_mult,d] — `hc_mult` parallel copies. Each sub-layer reduces them
 *      to one (`hc_pre`, weights from a Sinkhorn normalisation) and expands
 *      back (`hc_post`, a learned hc×hc combination). There is no plain
 *      residual add anywhere in the stack.
 *
 *   2. **MLA over a single shared latent.** `wkv` maps d → head_dim once and
 *      all heads read that one latent; the output leaves through a grouped
 *      low-rank pair (`wo_a` per group, then `wo_b`).
 *
 *   3. **Layers differ.** `compress_ratios[i]` sets the KV path (1, or absent
 *      = sliding window only, 4 = Compressor + Indexer, otherwise Compressor
 *      alone), and the first `n_hash_layers` route by a token-id table
 *      instead of by score.
 *      Both differences are visible in the checkpoint.
 *
 * Verified on DeepSeek-V4-Flash: the widths this computes match the measured
 * tensor shapes (`wq_a [1024,4096]`, `wq_b [32768,1024]`, `wkv [512,4096]`,
 * `wo_a [8192,4096]`, `hc_attn_fn [24,16384]`), and the layer grouping matches
 * what the safetensors index reports (2 layers with no compressor, 21 with
 * Compressor + Indexer, 20 with a Compressor alone).
 */

/**
 * Where the topology is read from.
 *
 * vLLM's own implementation rather than the model repo's `inference/model.py`:
 * one spec serves every model that declares this architecture, and the serving
 * path is what a reader profiling the model will actually be running.
 */
const SOURCE_PATH = "vllm/models/deepseek_v4/nvidia/model.py";

/** `packed_modules_mapping` from that file, verbatim. */
const PACKED = {
  gate_up_proj: ["w1", "w3"],
  fused_wqa_wkv: ["wq_a", "wkv"],
  fused_wkv_wgate: ["wkv", "wgate"],
};

/** Config keys, root spelling first, then the reference implementation's. */
const K = {
  dim: ["hidden_size", "dim"],
  layers: ["num_hidden_layers", "n_layers"],
  heads: ["num_attention_heads", "n_heads"],
  headDim: ["head_dim"],
  ropeHeadDim: ["qk_rope_head_dim", "rope_head_dim"],
  qLoraRank: ["q_lora_rank"],
  oLoraRank: ["o_lora_rank"],
  oGroups: ["o_groups"],
  window: ["sliding_window", "window_size"],
  vocab: ["vocab_size"],
  moeInter: ["moe_intermediate_size", "moe_inter_dim"],
  experts: ["n_routed_experts", "num_experts"],
  activated: ["num_experts_per_tok", "n_activated_experts"],
  shared: ["n_shared_experts", "num_shared_experts"],
  hashLayers: ["num_hash_layers", "n_hash_layers"],
  hcMult: ["hc_mult"],
  sinkhorn: ["hc_sinkhorn_iters"],
  swiglu: ["swiglu_limit"],
  indexHeads: ["index_n_heads"],
  indexHeadDim: ["index_head_dim"],
  indexTopk: ["index_topk"],
  mtp: ["num_nextn_predict_layers"],
} as const;

/** The dimensions this architecture is drawn from. */
interface V4Dims {
  dim: number;
  layers: number;
  heads: number;
  headDim: number;
  ropeHeadDim: number;
  qLoraRank: number;
  oLoraRank: number;
  oGroups: number;
  window: number;
  vocab: number;
  moeInter: number;
  experts: number;
  activated: number;
  shared: number;
  hashLayers: number;
  hcMult: number;
  sinkhorn: number;
  swiglu: number;
  indexHeads: number;
  indexHeadDim: number;
  indexTopk: number;
  mtp: number;
  ratios: number[];
  /**
   * Whether the config stated the routed-expert counts.
   *
   * They are clamped to at least one so the drawing has something to repeat,
   * which means the drawn number cannot be quoted back as fact — a config that
   * states none would otherwise be captioned "1 of 1 routed".
   */
  expertsStated: boolean;
}

function readDims(input: ArchInput): V4Dims {
  /** A width. Zero means the config did not state it, and reads as unknown. */
  const n = (keys: readonly string[], fallback = 0) =>
    pickNum(input, ...keys) ?? fallback;
  /**
   * A count: something divided by, repeated by, or used as a tensor axis.
   *
   * Never below one. `?? fallback` only covers a key that is ABSENT — a config
   * that states `o_groups: 0` passes the zero straight through, and
   * `qkvDim / 0` put an Infinity in a tensor shape.
   */
  const count = (keys: readonly string[], fallback = 1) =>
    Math.max(1, Math.trunc(n(keys, fallback)));
  const dim = n(K.dim);
  const heads = count(K.heads);
  const experts = count(K.experts);
  return {
    dim,
    layers: n(K.layers),
    heads,
    // Derived when the config does not state it, as every decoder config's
    // own default does — and as LlamaForCausalLM reads it. Left at zero it
    // put a literal 0 in every head-shaped tensor on the picture.
    headDim: n(K.headDim, dim / heads),
    ropeHeadDim: n(K.ropeHeadDim),
    qLoraRank: n(K.qLoraRank),
    oLoraRank: n(K.oLoraRank),
    oGroups: count(K.oGroups),
    window: n(K.window),
    vocab: n(K.vocab),
    moeInter: n(K.moeInter),
    experts,
    // A token cannot be routed to more experts than exist. Real configs never
    // say otherwise, but a drawn "16 of 4" is a claim about the model, so the
    // architecture's own bound belongs on the reader.
    activated: Math.min(count(K.activated), experts),
    shared: n(K.shared),
    hashLayers: n(K.hashLayers),
    hcMult: count(K.hcMult),
    sinkhorn: n(K.sinkhorn),
    swiglu: n(K.swiglu),
    indexHeads: count(K.indexHeads),
    indexHeadDim: count(K.indexHeadDim),
    indexTopk: n(K.indexTopk),
    // A block count, so whole and never negative.
    mtp: Math.max(0, Math.trunc(n(K.mtp))),
    expertsStated: (pickNum(input, ...K.experts) ?? 0) > 0,
    /**
     * Per-layer KV path. The implementation reads
     * `max(1, compress_ratios[layer_id])` and falls back to 1 when the list
     * does not reach that layer (attention.py:225-228), so 1 — not 0 — is what
     * "no compressor" looks like, and a ratio of 1 in the file means the same
     * thing as an absent one.
     */
    ratios: pickNums(input, "compress_ratios").map((r) =>
      Number.isFinite(r) ? Math.max(1, Math.trunc(r)) : 1,
    ),
  };
}

/** The ratio the implementation would use for layer `i`. */
function ratioOf(d: V4Dims, i: number): number {
  return d.ratios[i] ?? 1;
}

/* -------------------------------------------------------------------------
 * Hyper-Connections
 * ---------------------------------------------------------------------- */

/**
 * `hc_pre` / `hc_post`, the wrapper around each sub-layer — drawn in full, no
 * stack to open.
 *
 * Logically there are `hc_mult` copies of the hidden state, and the whole of
 * the mechanism is four steps on them:
 *
 *   1. every copy projects its contribution to the mixing weights,
 *      and the contributions sum      -> `hc_{which}_fn`
 *   2. Sinkhorn normalises that into three sets: pre, post, comb
 *   3. every copy is scaled by its own `pre`
 *   4. the scaled copies sum to one   -> the sub-layer's input
 *
 * On the way out, the single result is scaled per copy by `post` and each copy
 * additionally takes a `comb` mix of the residual copies — so the residual path
 * is a learned hc x hc combination, never a plain add.
 *
 * Steps 1 and 3 happen once per copy, so they draw as stacks of `hc_mult`
 * boxes; steps 2 and 4 are single.
 */
function hyperConnection(
  d: V4Dims,
  which: "attn" | "ffn",
): { pre: ArchSection[]; post: ArchSection[] } {
  const mixHc = (2 + d.hcMult) * d.hcMult;
  const copies = tensor(["b", "s", d.hcMult, d.dim], "copies", d.hcMult);
  const single = tensor(["b", "s", d.dim], "hidden");
  const weights = tensor(["b", "s", mixHc], "mix weights");

  return {
    pre: [
      parallel(
        `${which} hc_pre`,
        [
          {
            label: "weights",
            steps: [
              {
                // One box per copy: the first shows what a copy does, the
                // others say it happens that many times.
                op: {
                  kind: "reduce",
                  label: `hc_${which}_fn`,
                  weight: `hc_${which}_fn`,
                  inDim: d.dim,
                  outDim: mixHc,
                  dtype: "fp32",
                  repeat: d.hcMult,
                  active: d.hcMult,
                  note: "each copy contributes to the mixing weights",
                  inner: [
                    sequence("", [
                      {
                        op: {
                          // A reduction: one factor per copy, not a
                          // shape-preserving pass over it.
                          kind: "reduce",
                          label: "normalise",
                          note: "this copy's normalising factor",
                        },
                        out: tensor(["b", "s", 1], "scale"),
                      },
                      {
                        // The projection reads the COPY, scaled by that
                        // factor. In a row it read the factor itself, which
                        // the widths gave away: a scalar into a d-wide map.
                        ...linear(
                          `hc_${which}_fn`,
                          d.dim,
                          mixHc,
                          tensor(["b", "s", mixHc], "contribution"),
                          { weight: `hc_${which}_fn`, dtype: "fp32" },
                        ),
                        detached: true,
                        // Inside the box the entry is one copy of the hidden
                        // state, and it carries that label.
                        uses: ["hidden", "scale"],
                      },
                    ]),
                  ],
                },
                out: weights,
              },
              {
                op: {
                  kind: "route",
                  label: "sinkhorn",
                  /*
                   * `base` and `scale` belong here, not on `hc_*_fn`.
                   *
                   * All three tensors go into one kernel (`mhc_pre_tilelang`,
                   * nvidia/model.py:1336-1345), but only `fn` is per-copy —
                   * it is what each copy multiplies by. `base` is one vector
                   * as wide as the summed contributions, and `scale` has one
                   * entry per output set, so both act AFTER the copies are
                   * added. Hung on the per-copy operator they would have
                   * claimed every copy holds its own.
                   */
                  extras: [
                    { name: `hc_${which}_base`, shape: [mixHc], dtype: "fp32" },
                    { name: `hc_${which}_scale`, shape: [3], dtype: "fp32" },
                  ],
                  note: d.sinkhorn
                    ? `${d.sinkhorn} iterations, giving pre, post and comb`
                    : "giving pre, post and comb",
                },
                out: tensor(["b", "s", 3, d.hcMult], "pre post comb"),
              },
            ],
          },
          {
            label: "copies",
            steps: [
              {
                op: {
                  // One operator per copy, so it draws as a pile of that
                  // operator — the same way `scale by post` does on the way
                  // out. A box would only frame a single hexagon.
                  kind: "elementwise",
                  label: "scale by pre",
                  repeat: d.hcMult,
                  active: d.hcMult,
                  note: "each copy times its own Sinkhorn weight",
                },
                // The weights come from the sibling chain, not from the thing
                // before this one.
                uses: ["pre post comb"],
                out: copies,
              },
              {
                op: {
                  kind: "reduce",
                  label: "sum copies",
                  note: `the ${d.hcMult} scaled copies added`,
                },
                out: single,
              },
            ],
          },
        ],
        `${d.hcMult} copies to 1`,
      ),
      sequence(`${which} norm`, [norm(`${which}_norm`, single)]),
    ],
    post: [
      sequence(
        `${which} hc_post`,
        [
          {
            op: {
              kind: "expand",
              label: "scale by post",
              repeat: d.hcMult,
              active: d.hcMult,
              note: "the result scaled per copy",
            },
            // Two sections back, in this sub-layer's own hc_pre.
            uses: ["pre post comb"],
            out: copies,
          },
          {
            op: {
              kind: "elementwise",
              label: "add comb residual",
              repeat: d.hcMult,
              active: d.hcMult,
              note: `plus a ${d.hcMult}x${d.hcMult} mix of the residual copies`,
            },
            /*
             * The residual copies are the ones this sub-layer STARTED from —
             * the whole point of a hyper-connection is that they come back as
             * a learned mix rather than a plain add, and until this was
             * declared the picture said it in a note while drawing nothing.
             */
            uses: ["pre post comb", "copies"],
            out: tensor(["b", "s", d.hcMult, d.dim], "hidden", d.hcMult),
          },
        ],
        `1 to ${d.hcMult} copies`,
      ),
    ],
  };
}

/* -------------------------------------------------------------------------
 * Attention
 * ---------------------------------------------------------------------- */

function attentionSections(d: V4Dims, ratio: number): ArchSection[] {
  const qkvDim = d.heads * d.headDim;
  // One group's worth of heads. Whole, because it is a tensor axis: a config
  // whose groups do not divide the heads would otherwise put 10922.67 on the
  // picture, and the reshape before it a rounded 10922.
  const groupDim = Math.floor(qkvDim / d.oGroups);
  const single = (width: number, label?: string) =>
    tensor(["b", "s", width], label);

  const qPath: ArchChain = {
    label: "Q",
    steps: [
      ...lowRankPair(
        { down: "attn.wq_a", up: "attn.wq_b", norm: "attn.q_norm" },
        d.dim,
        d.qLoraRank,
        qkvDim,
        single,
        { dtype: "fp8" },
      ),
      reshapeHeads(d, qkvDim),
      rope(
        tensor(["b", "s", d.heads, d.headDim], "q"),
        d.ropeHeadDim,
        d.headDim,
      ),
    ],
  };

  const kvPath: ArchChain = {
    label: "KV latent",
    steps: [
      linear("attn.wkv", d.dim, d.headDim, single(d.headDim, "kv latent"), {
        weight: "attn.wkv",
        dtype: "fp8",
        note: `one latent shared by all ${d.heads} heads`,
      }),
      norm("attn.kv_norm", single(d.headDim, "kv latent")),
      rope(single(d.headDim, "kv latent"), d.ropeHeadDim, d.headDim),
    ],
  };

  const paths: ArchChain[] = [qPath, kvPath];

  // Compressor: a gated pool over `ratio` consecutive tokens, which is what
  // lets a layer see past its sliding window.
  // The compressor exists for `compress_ratio > 1` (attention.py:353-358);
  // at 1 or below the layer sees its sliding window only
  // (attention.py:838-841).
  if (ratio > 1) {
    // `self.overlap = compress_ratio == 4` and the projection width is
    // `coff = 1 + overlap` head_dims per stream (compressor.py:238-239, :282).
    const overlap = ratio === 4;
    const width = (overlap ? 2 : 1) * d.headDim;
    paths.push({
      label: "Compressor",
      steps: [
        linear(
          "compressor.wkv",
          d.dim,
          width,
          tensor(["b", `s/${ratio}`, d.headDim], "compressed kv"),
          {
            weight: "attn.compressor.wkv",
            note: `pools ${ratio} tokens${overlap ? ", overlapping windows" : ""}`,
          },
        ),
        {
          // `wkv` and `wgate` are two projections OF THE HIDDEN STATE — the
          // implementation even fuses them into one GEMM
          // (`fused_wkv_wgate`). Drawn in a row, the gate appeared to be a
          // projection of the kv the step before it produced.
          ...linear(
            "compressor.wgate",
            d.dim,
            width,
            tensor(["b", `s/${ratio}`, d.headDim], "gate score"),
            { weight: "attn.compressor.wgate", note: "pooling gate" },
          ),
          detached: true,
          uses: ["hidden"],
        },
        {
          // `ape` is added to the kv and the score as they are written into
          // the compression state ("with fused APE addition",
          // compressor.py:392-401). Its shape is the window it spans:
          // `(compress_ratio, coff * head_dim)` (compressor.py:261-264).
          op: {
            kind: "elementwise",
            label: "pool + ape",
            weight: "attn.compressor.ape",
            weightShape: [ratio, width],
            dtype: "fp32",
            note: "kv and score, plus the position in the window",
          },
          uses: ["compressed kv"],
          out: tensor(["b", `s/${ratio}`, d.headDim], "compressed kv"),
        },
        norm("compressor.norm", tensor(["b", `s/${ratio}`, d.headDim]), {
          weight: "attn.compressor.norm",
        }),
        // The kernel is named for the sequence it runs:
        // `compress_norm_rope_store_triton` (compressor.py:16), and the
        // forward takes `positions, rotary_emb` (:353-359).
        rope(
          tensor(["b", `s/${ratio}`, d.headDim], "compressed kv"),
          d.ropeHeadDim,
          d.headDim,
        ),
      ],
    });
  }

  // Indexer: scores the compressed positions and keeps the top `index_topk`,
  // so attention is sparse rather than full over the compressed cache. It
  // carries a Compressor of its own.
  // "Only C4A uses sparse attention and hence has indexer" — the condition is
  // the literal 4 in the implementation too (attention.py:291-292), so it is
  // not a guess about this checkpoint.
  if (ratio === 4) {
    const indexDim = d.indexHeads * d.indexHeadDim;
    // The indexer carries a Compressor of its own — the same three operators
    // at the indexer's own width. `coff` is 2 here too, because an indexer
    // only exists where the ratio is 4 and that is what turns overlap on.
    const indexWidth = 2 * d.indexHeadDim;
    paths.push({
      label: "Indexer compressor",
      steps: [
        linear(
          "indexer.compressor.wkv",
          d.dim,
          indexWidth,
          tensor(["b", `s/${ratio}`, d.indexHeadDim], "index kv"),
          { weight: "attn.indexer.compressor.wkv", dtype: "bf16" },
        ),
        {
          ...linear(
            "indexer.compressor.wgate",
            d.dim,
            indexWidth,
            tensor(["b", `s/${ratio}`, d.indexHeadDim], "index gate"),
            {
              weight: "attn.indexer.compressor.wgate",
              dtype: "bf16",
              note: "pooling gate",
            },
          ),
          detached: true,
          uses: ["hidden"],
        },
        {
          op: {
            kind: "elementwise",
            label: "pool + ape",
            weight: "attn.indexer.compressor.ape",
            weightShape: [ratio, indexWidth],
            dtype: "fp32",
          },
          uses: ["index kv"],
          out: tensor(["b", `s/${ratio}`, d.indexHeadDim], "index kv"),
        },
        norm(
          "indexer.compressor.norm",
          tensor(["b", `s/${ratio}`, d.indexHeadDim]),
          { weight: "attn.indexer.compressor.norm", dtype: "bf16" },
        ),
        // Same `Compressor` class as the one above, and the indexer hands it
        // `positions, rotary_emb` too (attention.py:1106), so it runs the same
        // norm-then-rope.
        rope(
          tensor(["b", `s/${ratio}`, d.indexHeadDim], "index kv"),
          d.ropeHeadDim,
          d.indexHeadDim,
        ),
      ],
    });
    /*
     * The indexer is three paths, not one line.
     *
     * `weights_proj` is `[index_n_heads, hidden_size]` — it reads the hidden
     * state, not the query the step before it produced. Drawn as a sequence,
     * the picture claimed the per-head weights were a projection OF the query.
     */
    paths.push({
      label: "Indexer q",
      steps: [
        {
          // "reuses the Q latent" — the note said so while the line came from
          // the hidden state, and the widths disagreed by 4096 against 1024.
          ...linear(
            "indexer.wq_b",
            d.qLoraRank,
            indexDim,
            tensor(["b", "s", d.indexHeads, d.indexHeadDim], "index q"),
            { weight: "attn.indexer.wq_b", note: "reuses the Q latent" },
          ),
          detached: true,
          uses: ["latent"],
        },
        // `fused_indexer_q_rope_quant(positions, q, cos_sin_cache, …)`
        // (attention.py:1085-1093).
        rope(
          tensor(["b", "s", d.indexHeads, d.indexHeadDim], "index q"),
          d.ropeHeadDim,
          d.indexHeadDim,
        ),
      ],
    });
    paths.push({
      label: "Indexer",
      steps: [
        linear(
          "indexer.weights",
          d.dim,
          d.indexHeads,
          tensor(["b", "s", d.indexHeads], "head weights"),
          { weight: "attn.indexer.weights_proj", dtype: "bf16" },
        ),
        {
          op: {
            kind: "route",
            label: "top-k",
            note: d.indexTopk
              ? `keeps ${d.indexTopk} compressed positions`
              : "keeps the highest-scoring compressed positions",
          },
          // It scores the query against the compressed kv its own compressor
          // made; neither of those reaches it along this chain.
          uses: ["index q", "index kv"],
          // An axis, not a width: unstated it is drawn as the name of the
          // key it would have come from, because a shape reads as a fact and
          // `[b, s, 0]` claims the layer keeps nothing.
          out: tensor(
            ["b", "s", d.indexTopk || "index_topk"],
            "kv indices",
          ),
        },
      ],
    });
  }

  return [
    parallel(
      "attention projections",
      paths,
      ratio > 1
        ? `sliding window${d.window ? ` ${d.window}` : ""} + compressed KV (ratio ${ratio})`
        : `sliding window${d.window ? ` ${d.window}` : ""} only`,
    ),
    sequence("attention out", [
      {
        op: {
          kind: "attention",
          label: "sparse_attn",
          weight: "attn.attn_sink",
          note: `${d.heads} heads over one latent, one sink logit per head`,
        },
        out: tensor(["b", "s", d.heads, d.headDim], "attn out"),
      },
      // "O projection: inverse RoPE + grouped wo_a + wo_b"
      // (nvidia/ops/o_proj.py:44), run as `fused_inv_rope_fp8_quant(o,
      // positions, cos_sin_cache, …, nope_dim, rope_dim)` (:50-58): the head
      // is split into a rotated and an unrotated half, and the rotated half
      // comes back out of that frame before the projection.
      unrope(
        tensor(["b", "s", d.heads, d.headDim], "attn out"),
        d.ropeHeadDim,
        d.headDim,
      ),
      {
        // `wo_a` is one projection per group over that group's heads, and the
        // einsum is written per group ("bhr,hdr->bhd", o_proj.py:74). Without
        // the regroup the picture fed it a head-shaped tensor.
        op: {
          kind: "reshape",
          label: `→ ${d.oGroups} × ${groupDim}`,
          note: `${d.heads} heads split across ${d.oGroups} groups`,
        },
        out: tensor(["b", "s", d.oGroups, groupDim], "attn out"),
      },
      linear(
        "attn.wo_a",
        groupDim,
        d.oLoraRank,
        tensor(["b", "s", d.oGroups * d.oLoraRank], "o latent"),
        {
          weight: "attn.wo_a",
          dtype: "fp8",
          // One projection per group: the taper and the weight above it say
          // what a group does, so the pile is the whole story.
          repeat: d.oGroups,
          active: d.oGroups,
          note: `${d.oGroups} groups, low-rank within each`,
        },
      ),
      linear(
        "attn.wo_b",
        d.oGroups * d.oLoraRank,
        d.dim,
        tensor(["b", "s", d.dim], "hidden"),
        { weight: "attn.wo_b", dtype: "fp8" },
      ),
    ]),
  ];
}

function reshapeHeads(d: V4Dims, qkvDim: number): ArchStep {
  return {
    op: {
      kind: "reshape",
      label: `→ ${d.heads} × ${d.headDim}`,
      note: `${qkvDim} split across heads`,
    },
    out: tensor(["b", "s", d.heads, d.headDim], "q"),
  };
}

/* -------------------------------------------------------------------------
 * MoE
 * ---------------------------------------------------------------------- */

/** One expert's inside: the two widening maps, the gate, the narrowing map. */
function expertInner(d: V4Dims, prefix: string, dtype: string): ArchSection[] {
  const wide = (label: string) => tensor(["b", "s", d.moeInter], label);
  return [
    parallel("gate and up", [
      {
        label: "w1",
        steps: [
          linear("w1", d.dim, d.moeInter, wide("gate"), {
            weight: `${prefix}.w1`,
            dtype,
          }),
          {
            op: {
              kind: "elementwise",
              label: "SiLU",
              note: d.swiglu ? `clamped at ${d.swiglu}` : undefined,
            },
            out: wide("gate"),
          },
        ],
      },
      {
        label: "w3",
        steps: [
          linear("w3", d.dim, d.moeInter, wide("up"), {
            weight: `${prefix}.w3`,
            dtype,
          }),
        ],
      },
    ]),
    sequence("down", [
      {
        op: { kind: "elementwise", label: "gate times up" },
        out: wide("gated"),
      },
      linear("w2", d.moeInter, d.dim, tensor(["b", "s", d.dim], "hidden"), {
        weight: `${prefix}.w2`,
        dtype,
      }),
    ]),
  ];
}

function moeSection(d: V4Dims, hashRouting: boolean): ArchSection[] {
  const out = tensor(["b", "s", d.dim], "hidden");
  /**
   * The router, which reads more than one stored tensor.
   *
   * A hash-routed layer does NOT skip scoring. `router_logits, _ =
   * self.gate(hidden_states)` runs with no condition on it
   * (nvidia/model.py:1057), and the logits go into the same routing kernel as
   * the table (`fused_topk_bias(gating_output=…, hash_indices_table=…)`,
   * :1060-1072; with `scoring_func: sqrtsoftplus` that is
   * `vllm_topk_softplus_sqrt`, which takes both). The table decides WHICH
   * experts; the score still decides with what weight. The checkpoint agrees:
   * layers 0-2 hold `ffn.gate.tid2eid` AND `ffn.gate.weight`.
   *
   * What a hash layer does lack is the bias: "hash MoE doesn't use
   * e_score_correction_bias" (:867), and indeed only the other 40 layers
   * store `ffn.gate.bias`.
   */
  const gate: ArchStep = hashRouting
    ? {
        op: {
          kind: "route",
          label: "gate hash",
          weight: "ffn.gate.tid2eid",
          weightShape: [d.vocab, d.activated],
          dtype: "i64",
          extras: [
            {
              name: "ffn.gate",
              shape: [d.experts, d.dim],
              dtype: "bf16",
            },
          ],
          note: "ids from a token-id table, weights from the score",
        },
        out: tensor(["b*s", d.activated], "expert ids + weights"),
      }
    : topkRouter(
        "gate score",
        "ffn.gate",
        d.dim,
        d.experts,
        d.activated,
        tensor(["b*s", d.activated], "expert ids + weights"),
        {
          dtype: "bf16",
          // `e_score_correction_bias` — the bias `noaux_tc` adds to the scores
          // before the top-k, so it changes WHICH experts a token gets.
          extras: [
            { name: "ffn.gate.bias", shape: [d.experts], dtype: "fp32" },
          ],
        },
      );

  const routed: ArchStep[] = [
    gate,
    {
      // An expert reads the HIDDEN STATE. The router only says which experts
      // and with what weight — drawn in a row, the picture had the experts
      // consuming a list of ids.
      ...swigluExpert(
        "routed expert",
        "ffn.experts.N.w1 / w3 / w2",
        d.dim,
        d.moeInter,
        tensor(["b", "s", d.dim], "expert out"),
        {
          dtype: "fp4",
          repeat: d.experts,
          active: d.activated,
          note: d.swiglu ? `SwiGLU, clamped at ${d.swiglu}` : "SwiGLU",
          inner: expertInner(d, "ffn.experts.N", "fp4"),
        },
      ),
      detached: true,
      uses: ["hidden", "expert ids + weights"],
    },
  ];

  const note = `${
    d.expertsStated ? `${d.activated} of ${d.experts} routed` : "routed experts"
  }${d.shared ? ` + ${d.shared} shared` : ""}`;

  if (!d.shared) return [sequence("MoE", routed, note)];

  /*
   * The shared expert runs BESIDE the routed ones, not after them.
   *
   *     shared_output = self.shared_experts(hidden_states)
   *     final_hidden_states += shared_output        (nvidia/model.py:1123-1124)
   *
   * It reads the same hidden state the router reads, and its result is added.
   * Drawn in a row, the picture said it consumed the routed experts' output.
   */
  return [
    parallel(
      "MoE",
      [
        { label: "routed", steps: routed },
        {
          label: "shared",
          steps: [
            swigluExpert(
              "shared expert",
              "ffn.shared_experts.w1 / w3 / w2",
              d.dim,
              d.moeInter,
              tensor(["b", "s", d.dim], "shared out"),
              {
                dtype: "fp8",
                repeat: d.shared,
                active: d.shared,
                note: "every token",
                inner: expertInner(d, "ffn.shared_experts", "fp8"),
              },
            ),
          ],
        },
      ],
      note,
    ),
    sequence("MoE out", [
      {
        op: {
          kind: "elementwise",
          label: "+ shared",
          note: "the routed result plus the shared expert's",
        },
        out,
      },
    ]),
  ];
}


/* -------------------------------------------------------------------------
 * Multi-token prediction
 * ---------------------------------------------------------------------- */

/**
 * The MTP block — `nvidia/mtp.py`, `DeepSeekV4MultiTokenPredictorLayer`.
 *
 * Not a layer. It hangs off the stack's output and produces logits of its own,
 * beside the model's, so that a draft of the NEXT token can be checked in the
 * same pass. It takes two things that do not come from one another: the state
 * the stack ends on, and the next token.
 *
 *   - `enorm` / `hnorm` are two RMSNorms (mtp.py:100-101). One kernel runs both
 *     and masks position 0 on the way through; drawn as the two norms they are.
 *   - `e_proj` and `h_proj` are SEPARATE here. The implementation says so:
 *     "V4 keeps e_ and h_ proj separate ... rather than fusing them the way V3
 *     does with eh_proj" (mtp.py:103-104).
 *   - the add broadcasts the embedding branch across the `hc_mult` copies
 *     (`.unsqueeze(-2)`, mtp.py:186).
 *   - `mtp_block` is a whole decoder layer (mtp.py:141). Its layer index is
 *     `num_hidden_layers`, which makes its `compress_ratio` 1 — sliding window
 *     only (attention.py:225-228) — and puts it past `num_hash_layers`, so it
 *     routes by score. It is the layer this spec already draws, unchanged.
 *   - the block's own `hc_head` is deferred to `compute_logits` (mtp.py:213,
 *     :276-297): what it returns is the state BEFORE it, so that state can be
 *     fed back in as the next speculative step's input.
 *   - the embedding is NOT its own: `shared_weight_names = ["embed_tokens"]`
 *     (mtp.py:555) rewrites it to the top-level table, so the block embeds the
 *     next token with the model's `embed`.
 *   - the tail is vLLM's `SharedHead` — an RMSNorm and a `[vocab, d]`
 *     projection (deepseek_mtp.py:51-65). The norm is the block's own, stored
 *     as `mtp.N.norm.weight` (mtp.py:347). The projection is the block's own
 *     only when the repo publishes an `mtp.N.head.weight`; DeepSeek-V4-Flash
 *     publishes a single `head.weight`, so there it is the model's head.
 */
function mtpType(d: V4Dims): ArchLayerType {
  const copies = tensor(["b", "s", d.hcMult, d.dim], "hidden", d.hcMult);
  const hcAttn = hyperConnection(d, "attn");
  const hcFfn = hyperConnection(d, "ffn");
  return {
    id: "mtp",
    label: d.mtp > 1 ? `MTP x${d.mtp}` : "MTP",
    // Where the implementation keeps them: straight after the stack.
    layers: Array.from({ length: d.mtp }, (_, i) => d.layers + i),
    note:
      `drafts the next token from the state the stack ends on` +
      (d.mtp > 1
        ? `, one block per speculative step, each re-fed the state before hc_head`
        : ""),
    io: copies,
    inputs: [copies, { dims: ["b", "s"], label: "next token", dtype: "i64" }],
    sections: [
      parallel(
        "MTP input",
        [
          {
            label: "state",
            steps: [
              norm("hnorm", copies, { weight: "hnorm" }),
              linear("h_proj", d.dim, d.dim, copies, { weight: "h_proj" }),
            ],
          },
          {
            label: "next token",
            steps: [
              {
                op: {
                  kind: "embed",
                  label: "embed",
                  weight: "embed",
                  inDim: d.vocab,
                  outDim: d.dim,
                  note: "the model's table, not one of its own",
                },
                out: tensor(["b", "s", d.dim], "embedded"),
              },
              norm("enorm", tensor(["b", "s", d.dim], "embedded"), {
                weight: "enorm",
                note: "position 0 is masked out in the same kernel",
              }),
              linear("e_proj", d.dim, d.dim, tensor(["b", "s", d.dim]), {
                weight: "e_proj",
              }),
            ],
          },
        ],
        "the state the stack ends on, and the token after it",
      ),
      sequence("MTP mix", [
        {
          op: {
            kind: "elementwise",
            label: "add",
            note: `the embedding added to each of the ${d.hcMult} copies`,
          },
          out: copies,
        },
      ]),
      ...hcAttn.pre,
      ...attentionSections(d, 1),
      ...hcAttn.post,
      ...hcFfn.pre,
      ...moeSection(d, false),
      ...hcFfn.post,
      sequence(
        "MTP head",
        [
          {
            op: {
              kind: "reduce",
              label: "hc_head",
              weight: "hc_head_fn",
              weightShape: [d.hcMult, d.hcMult * d.dim],
              dtype: "fp32",
              extras: [
                { name: "hc_head_base", shape: [d.hcMult], dtype: "fp32" },
                { name: "hc_head_scale", shape: [1], dtype: "fp32" },
              ],
              note: "run at logits time, so the block hands back the state before it",
            },
            out: tensor(["b", "s", d.dim], "hidden"),
          },
          // vLLM's `shared_head`, under the names the checkpoint stores it
          // by: the norm is the block's own, the projection is the model's
          // unless the repo published one for the block.
          norm("norm", tensor(["b", "s", d.dim], "hidden"), {
            weight: "norm",
          }),
          linear(
            "head",
            d.dim,
            d.vocab,
            tensor(["b", 1, d.vocab], "draft logits"),
            {
              weight: "head",
              note: "the model's head, unless the repo gives the block one",
            },
          ),
        ],
        "its own head",
      ),
    ],
  };
}

/* -------------------------------------------------------------------------
 * Spec
 * ---------------------------------------------------------------------- */

export const spec: ArchSpec = {
  arch: ["DeepseekV4ForCausalLM"],
  // `compress_ratios` decides the per-layer KV path and appears in no root
  // config; the repo publishes it with its reference implementation.
  extraFiles: ["inference/config.json"],

  build(input) {
    const d = readDims(input);
    const io = tensor(["b", "s", d.hcMult, d.dim], "hidden", d.hcMult);

    const kindOf = (i: number) => {
      // Layers with the same ratio and the same routing are the same layer.
      // `i < num_hash_layers` is how the implementation decides the routing
      // too (nvidia/model.py:864).
      return `r${ratioOf(d, i)}${i < d.hashLayers ? "-hash" : ""}`;
    };

    const layerTypes: ArchLayerType[] = [
      ...groupLayers(d.layers, kindOf).entries(),
    ].map(([id, idxs]) => {
      const ratio = ratioOf(d, idxs[0]);
      const hash = idxs[0] < d.hashLayers;
      const hcAttn = hyperConnection(d, "attn");
      const hcFfn = hyperConnection(d, "ffn");
      return {
        id,
        label:
          (ratio <= 1
            ? d.window
              ? `window ${d.window}`
              : "sliding window"
            : ratio === 4
              ? `compress ${ratio} + indexer`
              : `compress ${ratio}`) + (hash ? " hash route" : ""),
        layers: idxs,
        note: `layers ${describeLayers(idxs)}${
          hash
            ? " — expert ids come from a token-id table, not from the scores"
            : ""
        }`,
        io,
        sections: [
          ...hcAttn.pre,
          ...attentionSections(d, ratio),
          ...hcAttn.post,
          ...hcFfn.pre,
          ...moeSection(d, hash),
          ...hcFfn.post,
        ],
      };
    });

    const prologue: ArchChain = {
      steps: [
        {
          op: {
            kind: "embed",
            // `embed.weight` is what the checkpoint holds; vLLM renames it to
            // `embed_tokens` on the way in (nvidia/model.py:1872).
            label: "embed",
            weight: "embed",
            inDim: d.vocab,
            outDim: d.dim,
            dtype: "bf16",
          },
          out: tensor(["b", "s", d.dim], "hidden"),
        },
        {
          op: {
            kind: "expand",
            label: "broadcast to copies",
            note: `broadcast to ${d.hcMult} copies`,
          },
          out: io,
        },
      ],
    };

    const epilogue: ArchChain = {
      steps: [
        {
          op: {
            kind: "reduce",
            label: "hc_head",
            weight: "hc_head_fn",
            // One stored tensor over all the copies at once, which is why the
            // shape is stated rather than derived from a width pair.
            weightShape: [d.hcMult, d.hcMult * d.dim],
            dtype: "fp32",
            // The head reduces to one set, so its scale is a single number.
            extras: [
              { name: "hc_head_base", shape: [d.hcMult], dtype: "fp32" },
              { name: "hc_head_scale", shape: [1], dtype: "fp32" },
            ],
            note: "the same Sinkhorn reduction hc_pre uses",
          },
          out: tensor(["b", "s", d.dim], "hidden"),
        },
        norm("norm", tensor(["b", "s", d.dim], "hidden")),
        // `head.weight`, which vLLM loads as `lm_head` (nvidia/model.py:1871).
        linear("head", d.dim, d.vocab, tensor(["b", 1, d.vocab], "logits"), {
          weight: "head",
          dtype: "bf16",
          note: "last position only",
        }),
      ],
    };

    return {
      arch: "DeepseekV4ForCausalLM",
      // The token ids the model is handed, integers in [0, vocab).
      input: { dims: ["b", "s"], label: "token ids", dtype: "i64" },
      prologue,
      epilogue,
      layerTypes,
      mtp: d.mtp > 0 ? mtpType(d) : undefined,
      layerCount: d.layers,
      source: {
        label: SOURCE_PATH,
        upstream: `https://github.com/vllm-project/vllm/blob/main/${SOURCE_PATH}`,
        packedModules: PACKED,
      },
      // Every weight the checkpoint holds and the picture does not draw, so
      // the omission is a statement rather than a gap. `.filter(Boolean)` used
      // to sit here from when an entry was conditional; all of these are.
      omitted: [
        "KV cache buffers and the decode-phase incremental compression state",
        "tensor-parallel splits — drawn as a single rank",
        "sequence-parallel gathers and scatters around the attention",
        "the lines from the model's positions input to the five RoPEs that read it — said in each RoPE's note instead of drawn across the whole picture",
        "the MTP block feeding itself, when a config asks for more than one speculative step",
        "what is inside sparse_attn — the implementation has only opaque kernels there",
        "where activations are quantised and dequantised — the scheme is dynamic per-token fp8, but the boundaries are the kernel's",
        "the router's renormalisation and routed_scaling_factor, inside the gate",
      ],
    };
  },
};
