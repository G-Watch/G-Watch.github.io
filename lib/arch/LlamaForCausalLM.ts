import {
  describeLayers,
  groupLayers,
  linear,
  norm,
  parallel,
  pickNum,
  pickStrs,
  reshape,
  rope,
  sequence,
  tensor,
} from "./common";
import type {
  ArchChain,
  ArchInput,
  Dim,
  ArchLayerType,
  ArchSection,
  ArchSpec,
  ArchStep,
} from "./types";

/**
 * `LlamaForCausalLM` and the causal-LM architectures vLLM serves from the same
 * module — `LLaMAForCausalLM`, `InternLM3ForCausalLM`, `TeleChat3ForCausalLM`,
 * `CwmForCausalLM`, `IQuestCoderForCausalLM`.
 *
 * NOT the four pooling and classification names the `llama` module also serves
 * (`LlamaModel`, `MistralModel`, `LlamaBidirectionalModel`,
 * `LlamaBidirectionalForSequenceClassification`). Those are the same backbone
 * with a different tail: no LM head, a pooler instead, and for the last one a
 * `score` projection (`as_embedding_model` / `as_seq_cls_model`,
 * `model_executor/models/adapters.py`). The pooling itself comes from vLLM's
 * runtime `pooler_config`, not from anything the repo publishes — so it cannot
 * be drawn from a checkpoint, and claiming those names would have drawn an
 * `lm_head` and a row of logits that the model does not produce.
 *
 * Topology from `vllm/model_executor/models/llama.py`
 * (`LlamaDecoderLayer.forward`, `LlamaAttention.forward`, `LlamaMLP.forward`).
 *
 * Drawn as the ORIGINAL operators, not vLLM's fused ones. vLLM declares
 *
 *     packed_modules_mapping = {
 *       "qkv_proj":     ["q_proj", "k_proj", "v_proj"],
 *       "gate_up_proj": ["gate_proj", "up_proj"],
 *     }
 *
 * so the three Q/K/V projections and the two FFN projections are each one GEMM
 * at run time; here they are separate, because that is what the checkpoint
 * holds and what a shape can be checked against. `fusedInto` on each keeps the
 * link to the kernel a trace would name. Likewise `SiluAndMul` is drawn as
 * SiLU + product, and vLLM's `input_layernorm(hidden, residual)` — a fused
 * add-then-norm — as the add and the norm it is.
 *
 * This is the plain pre-norm decoder, so it also serves as the base every
 * spec that is "Llama plus something" can read.
 */

const SOURCE_PATH = "vllm/model_executor/models/llama.py";

const PACKED = {
  qkv_proj: ["q_proj", "k_proj", "v_proj"],
  gate_up_proj: ["gate_proj", "up_proj"],
};

const K = {
  dim: ["hidden_size"],
  layers: ["num_hidden_layers"],
  heads: ["num_attention_heads"],
  kvHeads: ["num_key_value_heads"],
  headDim: ["head_dim"],
  inter: ["intermediate_size"],
  vocab: ["vocab_size"],
  window: ["sliding_window"],
} as const;

interface LlamaDims {
  dim: number;
  layers: number;
  heads: number;
  kvHeads: number;
  headDim: number;
  inter: number;
  vocab: number;
  window: number;
  /** Per-layer attention kind, when the config states one. */
  layerTypes: string[];
  tied: boolean;
}

function readDims(input: ArchInput): LlamaDims {
  /** A width. Zero means the config did not state it, and reads as unknown. */
  const n = (keys: readonly string[], fallback = 0) =>
    pickNum(input, ...keys) ?? fallback;
  /**
   * A count: something divided by, or used as a tensor axis. Never below one.
   * `?? fallback` only covers an ABSENT key — a stated `num_key_value_heads: 0`
   * passed the zero through and put an Infinity in the GQA ratio.
   */
  const count = (keys: readonly string[], fallback = 1) =>
    Math.max(1, Math.trunc(n(keys, fallback)));
  const dim = n(K.dim);
  const heads = count(K.heads);
  return {
    dim,
    layers: n(K.layers),
    heads,
    // The config's own default when absent is "same as heads", i.e. plain MHA.
    kvHeads: count(K.kvHeads, heads),
    headDim: n(K.headDim, dim / heads),
    inter: n(K.inter),
    vocab: n(K.vocab),
    window: n(K.window),
    layerTypes: pickStrs(input, "layer_types"),
    tied: input.config.tie_word_embeddings === true,
  };
}

/* -------------------------------------------------------------------------
 * Attention
 * ---------------------------------------------------------------------- */

function attentionSections(d: LlamaDims, sliding: boolean): ArchSection[] {
  const qDim = d.heads * d.headDim;
  const kvDim = d.kvHeads * d.headDim;

  /** One of the three projections vLLM packs into `qkv_proj`. */
  const projection = (
    name: "q_proj" | "k_proj" | "v_proj",
    width: number,
    heads: number,
    label: string,
    withRope: boolean,
  ): ArchChain => {
    const headed = tensor(["b", "s", heads, d.headDim], label);
    const steps: ArchStep[] = [
      linear(name, d.dim, width, tensor(["b", "s", width], label), {
        weight: `self_attn.${name}`,
        fusedInto: "qkv_proj",
      }),
      reshape(`→ ${heads} × ${d.headDim}`, headed),
    ];
    if (withRope) steps.push(rope(headed, d.headDim));
    return { label, steps };
  };

  return [
    parallel(
      "attention projections",
      [
        projection("q_proj", qDim, d.heads, "q", true),
        projection("k_proj", kvDim, d.kvHeads, "k", true),
        // V takes no rotary embedding — only Q and K carry position.
        projection("v_proj", kvDim, d.kvHeads, "v", false),
      ],
      `${d.heads} heads, ${d.kvHeads} kv${
        d.kvHeads === d.heads
          ? " (MHA)"
          : d.kvHeads === 1
            ? " (MQA)"
            : // Only claim a ratio when there is a whole one to claim.
              d.heads % d.kvHeads === 0
              ? ` (GQA, ${d.heads / d.kvHeads}:1)`
              : " (GQA)"
      }`,
    ),
    sequence("attention out", [
      {
        op: {
          kind: "attention",
          label: "attn",
          note: sliding ? `sliding window ${d.window}` : "causal, full context",
        },
        out: tensor(["b", "s", d.heads, d.headDim], "attn out"),
      },
      reshape(`→ ${qDim}`, tensor(["b", "s", qDim], "attn out")),
      linear("o_proj", qDim, d.dim, tensor(["b", "s", d.dim], "hidden"), {
        weight: "self_attn.o_proj",
      }),
    ]),
  ];
}

/* -------------------------------------------------------------------------
 * MLP
 * ---------------------------------------------------------------------- */

/**
 * SwiGLU, un-fused. vLLM runs `gate_up_proj` then `SiluAndMul`; the original
 * form is two projections, SiLU on the gate, and an elementwise product.
 */
function mlpSection(d: LlamaDims): ArchSection[] {
  // An axis, not a width: a config that does not state `intermediate_size`
  // leaves it unknown, and `[b, s, 0]` reads as a claim that the FFN has no
  // width at all. Drawn as the name of the key it would have come from.
  const inter: Dim = d.inter || "intermediate_size";
  const wide = (label: string) => tensor(["b", "s", inter], label);
  return [
    parallel(
      "mlp projections",
      [
        {
          label: "gate",
          steps: [
            linear("gate_proj", d.dim, d.inter, wide("gate"), {
              weight: "mlp.gate_proj",
              fusedInto: "gate_up_proj",
            }),
            {
              op: { kind: "elementwise", label: "SiLU" },
              out: wide("gate"),
            },
          ],
        },
        {
          label: "up",
          steps: [
            linear("up_proj", d.dim, d.inter, wide("up"), {
              weight: "mlp.up_proj",
              fusedInto: "gate_up_proj",
            }),
          ],
        },
      ],
      "gate and up, then their product",
    ),
    sequence(
      "mlp out",
      [
        {
          op: {
            kind: "elementwise",
            label: "gate times up",
            note: "SiLU(gate) × up",
          },
          out: wide("gated"),
        },
        linear(
          "down_proj",
          d.inter,
          d.dim,
          tensor(["b", "s", d.dim], "hidden"),
          {
            weight: "mlp.down_proj",
          },
        ),
      ],
      "SiLU gate times up",
    ),
  ];
}

/* -------------------------------------------------------------------------
 * Spec
 * ---------------------------------------------------------------------- */

/** The add-then-norm vLLM fuses into one call, drawn as the two steps it is. */
function residualNorm(
  d: LlamaDims,
  which: string,
  first: boolean,
): ArchSection {
  const out = tensor(["b", "s", d.dim], "hidden");
  const steps: ArchStep[] = [];
  if (!first) {
    steps.push({
      op: {
        kind: "elementwise",
        label: "+ residual",
      },
      out,
    });
  }
  // Short label for the box, full tensor name for the tooltip.
  steps.push(
    norm(which.replace("post_attention", "post_attn"), out, { weight: which }),
  );
  return sequence(which, steps);
}

export const spec: ArchSpec = {
  arch: [
    "LlamaForCausalLM",
    "LLaMAForCausalLM",
    "InternLM3ForCausalLM",
    "TeleChat3ForCausalLM",
    "CwmForCausalLM",
    "IQuestCoderForCausalLM",
  ],

  build(input) {
    const d = readDims(input);
    const io = tensor(["b", "s", d.dim], "hidden");

    /**
     * Layers differ only when the config says so. `layer_types` (Llama 4,
     * gpt-oss-style interleaving) is the only per-layer signal here, and it is
     * NOT visible in the checkpoint — the tensors of a sliding layer and a full
     * layer are identical — so it can come from nowhere else.
     */
    const kindOf = (i: number) => d.layerTypes[i] ?? "attention";

    const layerTypes: ArchLayerType[] = [
      ...groupLayers(d.layers, kindOf).entries(),
    ].map(([id, idxs]) => {
      const sliding = id.includes("sliding") && d.window > 0;
      return {
        id,
        // A value the spec has no reading for is shown as it was written
        // rather than called "full attention", which it may not be — HF also
        // spells `chunked_attention` here, and other modules spell more.
        label: sliding
          ? `sliding window ${d.window}`
          : id === "attention" || id.includes("full")
            ? "full attention"
            : id.replace(/_/g, " "),
        layers: idxs,
        note: `layers ${describeLayers(idxs)}${
          d.layerTypes.length > 0
            ? " — from config.layer_types, which the checkpoint cannot show"
            : ""
        }`,
        io,
        sections: [
          residualNorm(d, "input_layernorm", true),
          ...attentionSections(d, sliding),
          residualNorm(d, "post_attention_layernorm", false),
          ...mlpSection(d),
        ],
      };
    });

    const prologue: ArchChain = {
      steps: [
        {
          op: {
            kind: "embed",
            label: "embed_tokens",
            weight: "model.embed_tokens",
            inDim: d.vocab,
            outDim: d.dim,
          },
          out: io,
        },
      ],
    };

    const epilogue: ArchChain = {
      steps: [
        {
          op: {
            kind: "elementwise",
            label: "+ residual",
          },
          out: io,
        },
        norm("norm", io, { weight: "model.norm" }),
        linear("lm_head", d.dim, d.vocab, tensor(["b", 1, d.vocab], "logits"), {
          weight: d.tied ? "model.embed_tokens (tied)" : "lm_head",
          note: d.tied ? "tied to the embedding" : undefined,
        }),
      ],
    };

    return {
      arch: "LlamaForCausalLM",
      // The token ids the model is handed, integers in [0, vocab).
      input: { dims: ["b", "s"], label: "token ids", dtype: "i64" },
      prologue,
      epilogue,
      layerTypes,
      layerCount: d.layers,
      source: {
        label: "vllm llama.py",
        upstream: `https://github.com/vllm-project/vllm/blob/main/${SOURCE_PATH}`,
        packedModules: PACKED,
      },
      omitted: [
        "tensor-parallel splits and their collectives — drawn as a single rank",
        "KV cache",
      ],
    };
  },
};
