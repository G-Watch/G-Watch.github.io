/**
 * Hugging Face model lookup — the calculator's shared model source.
 *
 * USER-OWNED: this file is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * Every calculator panel starts from the same question: which model? This
 * module answers it once, from the browser, against the public Hub API — the
 * site is a static export, so there is no server of ours in the path:
 *
 *   GET /api/models/<id>                  repo facts, and the exact per-dtype
 *                                         parameter counts of its safetensors
 *   GET /<id>/resolve/<sha>/config.json   the architecture itself
 *
 * Both land in one `HfModelSnapshot`, and the field a panel actually wants
 * to compute with is `snapshot.shape` — the normalized `ModelShape` below.
 * Config keys differ per model family (`hidden_size` vs. `n_embd`,
 * `num_experts` vs. `n_routed_experts`), and that variance is resolved here,
 * once, rather than in every panel.
 */
import type { Locale } from "./i18n";

const HF_ORIGIN = "https://huggingface.co";

/* -------------------------------------------------------------------------
 * Addressing a model
 * ---------------------------------------------------------------------- */

/** A repo plus the revision to read it at ("main" unless pinned). */
export interface HfModelRef {
  /** `owner/name`, as the Hub spells it. */
  id: string;
  /** Branch, tag or commit; "main" when unpinned. */
  revision: string;
}

/**
 * Read a model reference out of whatever the reader pasted: a bare
 * `owner/name`, an `owner/name@revision`, or any huggingface.co URL
 * (`/owner/name`, `/owner/name/tree/<rev>`, `/owner/name/blob/<rev>/…`).
 * Returns null when there is no `owner/name` in it at all.
 */
export function parseModelRef(input: string): HfModelRef | null {
  let text = input.trim();
  if (!text) return null;

  // A URL — keep the path, and pick up an explicit revision if one is in it.
  let revision = "";
  const url = text.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:huggingface\.co|hf\.co)\/(.+)$/i,
  );
  if (url) {
    text = url[1];
    const at = text.match(/^([^/]+\/[^/]+)\/(?:tree|blob|resolve)\/([^/?#]+)/);
    if (at) {
      text = at[1];
      revision = decodeURIComponent(at[2]);
    }
  }

  // Trim query, fragment, trailing slash, and the `models/` API prefix.
  text = text
    .split(/[?#]/)[0]
    .replace(/\/+$/, "")
    .replace(/^models\//, "");

  const pinned = text.match(/^(.+?)@([^@/]+)$/);
  if (pinned) {
    text = pinned[1];
    revision = pinned[2];
  }

  const segments = text.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return { id: `${segments[0]}/${segments[1]}`, revision: revision || "main" };
}

/** `owner/name` or `owner/name@rev` — what the picker shows back. */
export function formatModelRef(ref: HfModelRef): string {
  return ref.revision === "main" ? ref.id : `${ref.id}@${ref.revision}`;
}

/** The model's page on the Hub. */
export function hubUrl(ref: HfModelRef): string {
  return ref.revision === "main"
    ? `${HF_ORIGIN}/${ref.id}`
    : `${HF_ORIGIN}/${ref.id}/tree/${ref.revision}`;
}

/* -------------------------------------------------------------------------
 * What comes back
 * ---------------------------------------------------------------------- */

/** A raw config.json, before `ModelShape` reads it. */
export type HfConfig = Record<string, unknown>;

/** Repo-level facts, straight off `/api/models/<id>`. */
export interface HfRepoInfo {
  id: string;
  /** Commit the snapshot was read at — every file fetch is pinned to it. */
  sha: string;
  /** False, or the gate kind ("auto" / "manual") the Hub reports. */
  gated: string | false;
  private: boolean;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags: string[];
  library?: string;
  pipelineTag?: string;
  license?: string;
  /**
   * Parameter counts the Hub read out of the safetensors headers, per dtype
   * plus the total. This is measured, not derived from the config — when it is
   * present it is the number to size weights with.
   */
  params?: { total: number; byDtype: Record<string, number> };
  /** Every file in the repo at this commit. */
  files: string[];
}

/** Mixture-of-experts facts, when the architecture has them. */
export interface MoeShape {
  /** Routed experts per MoE layer. */
  numExperts: number;
  /** How many of them each token activates. */
  expertsPerTok: number;
  /** One routed expert's FFN width; falls back to the dense width. */
  expertIntermediateSize?: number;
  /** Always-on experts beside the routed ones. */
  numSharedExperts?: number;
  /** A shared expert's FFN width, when it differs. */
  sharedIntermediateSize?: number;
  /** Leading layers that stay dense (DeepSeek's `first_k_dense_replace`). */
  denseLayers?: number;
  /** Every Nth layer is MoE (Qwen's `decoder_sparse_step`, 1 = all of them). */
  sparseStep?: number;
}

/**
 * Multi-head latent attention (DeepSeek MLA), when present. The KV cache of
 * such a model is the latent, not K and V — `kvLoraRank + qkRopeHeadDim` per
 * token per layer — so this is what a memory panel has to branch on.
 */
export interface MlaShape {
  kvLoraRank: number;
  qLoraRank?: number;
  qkNopeHeadDim?: number;
  qkRopeHeadDim?: number;
  vHeadDim?: number;
}

/** How the checkpoint's weights are stored, when they are not plain dtype. */
export interface QuantShape {
  /** "fp8", "awq", "gptq", "compressed-tensors", … */
  method: string;
  /** Weight bits, when the config names them. */
  bits?: number;
  /** Format detail, e.g. "e4m3". */
  format?: string;
}

/**
 * The architecture, normalized — the seam every panel computes against.
 *
 * Fields are optional exactly when a config may not carry them: a panel should
 * say what it cannot size rather than quietly assume a default.
 */
export interface ModelShape {
  /** `model_type`, e.g. "qwen3_moe", "deepseek_v3". */
  modelType?: string;
  /** First entry of `architectures`, e.g. "Qwen3MoeForCausalLM". */
  architecture?: string;
  numLayers?: number;
  hiddenSize?: number;
  numAttentionHeads?: number;
  /** GQA/MQA group count; equals `numAttentionHeads` on plain MHA. */
  numKeyValueHeads?: number;
  /** Per-head width — explicit when the config gives it, else hidden/heads. */
  headDim?: number;
  /** True when `headDim` was derived rather than read. */
  headDimDerived?: boolean;
  vocabSize?: number;
  /** Dense FFN width. */
  intermediateSize?: number;
  maxPositionEmbeddings?: number;
  /** Sliding-window span, when the model uses one. */
  slidingWindow?: number;
  /** Untied embeddings mean the LM head is a second matrix of its own. */
  tieWordEmbeddings?: boolean;
  /**
   * `torch_dtype` / `dtype` as the config declares it — the dtype the model
   * loads and computes in, which on a quantized checkpoint is NOT how the
   * weights are stored (DeepSeek-V4-Flash declares bfloat16 and stores 97% of
   * its weights as I8).
   */
  torchDtype?: string;
  /**
   * How the weights are actually stored: the dtype holding the most elements
   * in the safetensors headers. Measured, so it is what a weight footprint
   * should be sized from.
   */
  weightDtype?: string;
  quantization?: QuantShape;
  moe?: MoeShape;
  mla?: MlaShape;
  /** Multi-token-prediction heads — the model's own draft, for spec decoding. */
  numNextnPredictLayers?: number;
  /** Measured parameter count from the safetensors headers, when published. */
  paramCount?: number;
  /**
   * Set when the config nests the language model (`text_config`, `llm_config`)
   * — i.e. a multimodal repo whose vision tower is NOT counted in these fields.
   */
  nestedUnder?: string;
}

/** One model, read once: repo facts, its config, and the derived shape. */
export interface HfModelSnapshot {
  ref: HfModelRef;
  repo: HfRepoInfo;
  config: HfConfig;
  shape: ModelShape;
  /** Epoch ms, so a panel can show how fresh the numbers are. */
  fetchedAt: number;
}

/* -------------------------------------------------------------------------
 * Reading the config
 * ---------------------------------------------------------------------- */

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** First key present, in the order given — how config aliases are resolved. */
function pickNum(config: HfConfig, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(config[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Same, for string-valued keys. */
function pickStr(config: HfConfig, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = str(config[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * The sub-config that holds the language model.
 *
 * A multimodal repo (Qwen-VL, Llama 4, Gemma 3) puts the decoder under
 * `text_config` / `llm_config` and keeps the vision tower beside it. The
 * decoder is what a token-level calculation is about, so it is what we read —
 * and `nestedUnder` records that the tower's weights are NOT in these numbers.
 */
function languageConfig(config: HfConfig): {
  root: HfConfig;
  nestedUnder?: string;
} {
  if (config.num_hidden_layers !== undefined || config.n_layer !== undefined) {
    return { root: config };
  }
  for (const key of ["text_config", "llm_config", "language_config"]) {
    const nested = config[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return { root: nested as HfConfig, nestedUnder: key };
    }
  }
  return { root: config };
}

function readQuantization(config: HfConfig): QuantShape | undefined {
  const raw = config.quantization_config;
  if (!raw || typeof raw !== "object") return undefined;
  const quant = raw as HfConfig;
  const method =
    str(quant.quant_method) ?? str(quant.quantization) ?? "unknown";
  return {
    method,
    bits: pickNum(quant, "bits", "w_bit", "weight_bits", "num_bits"),
    format: str(quant.fmt) ?? str(quant.activation_scheme),
  };
}

function readMoe(config: HfConfig): MoeShape | undefined {
  const numExperts = pickNum(
    config,
    "num_experts",
    "n_routed_experts",
    "num_local_experts",
    "moe_num_experts",
  );
  // No bare `top_k` here: in many configs that is the sampling default, not a
  // router width, and reading it as one would silently misprice every MoE.
  const expertsPerTok = pickNum(
    config,
    "num_experts_per_tok",
    "experts_per_token",
    "moe_topk",
    "num_selected_experts",
  );
  if (numExperts === undefined || expertsPerTok === undefined) return undefined;
  return {
    numExperts,
    expertsPerTok,
    expertIntermediateSize: pickNum(
      config,
      "moe_intermediate_size",
      "expert_intermediate_size",
      "moe_ffn_hidden_size",
    ),
    numSharedExperts: pickNum(
      config,
      "n_shared_experts",
      "num_shared_experts",
      "shared_expert_num",
    ),
    sharedIntermediateSize: pickNum(
      config,
      "shared_expert_intermediate_size",
      "shared_expert_ffn_hidden_size",
    ),
    denseLayers: pickNum(
      config,
      "first_k_dense_replace",
      "num_dense_layers",
      "moe_layer_start_index",
    ),
    sparseStep: pickNum(config, "decoder_sparse_step", "moe_layer_freq"),
  };
}

function readMla(config: HfConfig): MlaShape | undefined {
  const kvLoraRank = num(config.kv_lora_rank);
  if (kvLoraRank === undefined) return undefined;
  return {
    kvLoraRank,
    qLoraRank: num(config.q_lora_rank),
    qkNopeHeadDim: num(config.qk_nope_head_dim),
    qkRopeHeadDim: num(config.qk_rope_head_dim),
    vHeadDim: num(config.v_head_dim),
  };
}

/** The dtype holding the most elements — what the checkpoint mostly is. */
function dominantDtype(params?: HfRepoInfo["params"]): string | undefined {
  if (!params) return undefined;
  let winner: string | undefined;
  let most = 0;
  for (const [dtype, count] of Object.entries(params.byDtype)) {
    if (count > most) {
      most = count;
      winner = dtype;
    }
  }
  return winner;
}

/**
 * Normalize a config.json (plus the repo's measured parameter count) into the
 * `ModelShape` panels compute from. Pure — a saved config can be re-read
 * offline and give exactly the same shape.
 */
export function deriveModelShape(
  config: HfConfig,
  repo?: Pick<HfRepoInfo, "params">,
): ModelShape {
  const { root, nestedUnder } = languageConfig(config);
  const architectures = Array.isArray(config.architectures)
    ? config.architectures
    : Array.isArray(root.architectures)
      ? root.architectures
      : [];

  const hiddenSize = pickNum(root, "hidden_size", "n_embd", "d_model");
  const numAttentionHeads = pickNum(
    root,
    "num_attention_heads",
    "n_head",
    "num_heads",
  );
  const explicitHeadDim = pickNum(root, "head_dim", "attention_head_dim");
  const derivedHeadDim =
    hiddenSize !== undefined && numAttentionHeads
      ? hiddenSize / numAttentionHeads
      : undefined;

  return {
    modelType: str(root.model_type) ?? str(config.model_type),
    architecture: str(architectures[0]),
    numLayers: pickNum(root, "num_hidden_layers", "n_layer", "num_layers"),
    hiddenSize,
    numAttentionHeads,
    // MQA and MHA both leave this out; the config's own default is "= heads".
    numKeyValueHeads:
      pickNum(root, "num_key_value_heads", "num_kv_heads", "n_head_kv") ??
      numAttentionHeads,
    headDim: explicitHeadDim ?? derivedHeadDim,
    headDimDerived:
      explicitHeadDim === undefined && derivedHeadDim !== undefined,
    vocabSize: pickNum(root, "vocab_size"),
    intermediateSize: pickNum(
      root,
      "intermediate_size",
      "ffn_hidden_size",
      "n_inner",
      "ffn_dim",
    ),
    maxPositionEmbeddings: pickNum(
      root,
      "max_position_embeddings",
      "n_positions",
      "max_seq_len",
    ),
    slidingWindow: pickNum(root, "sliding_window", "attention_window"),
    tieWordEmbeddings:
      typeof root.tie_word_embeddings === "boolean"
        ? root.tie_word_embeddings
        : typeof config.tie_word_embeddings === "boolean"
          ? config.tie_word_embeddings
          : undefined,
    // transformers 4.x writes `torch_dtype`, 5.x writes `dtype`, and both are
    // in the wild — so are configs carrying neither.
    torchDtype:
      pickStr(root, "torch_dtype", "dtype") ??
      pickStr(config, "torch_dtype", "dtype"),
    weightDtype: dominantDtype(repo?.params),
    quantization: readQuantization(config) ?? readQuantization(root),
    moe: readMoe(root),
    mla: readMla(root),
    numNextnPredictLayers: pickNum(
      root,
      "num_nextn_predict_layers",
      "num_mtp_modules",
    ),
    paramCount: repo?.params?.total,
    nestedUnder,
  };
}

/* -------------------------------------------------------------------------
 * Fetching
 * ---------------------------------------------------------------------- */

/** Why a lookup failed, in terms the UI can put a sentence to. */
export type HfErrorCode =
  | "bad-ref"
  | "not-found"
  | "gated"
  | "unauthorized"
  | "no-config"
  | "rate-limited"
  | "network";

export class HfError extends Error {
  readonly code: HfErrorCode;
  constructor(code: HfErrorCode, message?: string) {
    super(message ?? code);
    this.name = "HfError";
    this.code = code;
  }
}

async function hfFetch(
  path: string,
  { token, signal }: { token?: string; signal?: AbortSignal } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  // Sent to huggingface.co and nowhere else; the picker never stores it.
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${HF_ORIGIN}${path}`, { headers, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new HfError("network", (error as Error)?.message);
  }
}

/** Map a Hub status onto an `HfErrorCode`, given what we know about the repo. */
function statusError(status: number, gated: string | false): HfError {
  if (status === 404) return new HfError("not-found");
  if (status === 401 || status === 403) {
    return new HfError(gated ? "gated" : "unauthorized");
  }
  if (status === 429) return new HfError("rate-limited");
  return new HfError("network", `HTTP ${status}`);
}

function readRepoInfo(raw: HfConfig): HfRepoInfo {
  const safetensors = raw.safetensors as
    { total?: number; parameters?: Record<string, number> } | undefined;
  const cardData = (raw.cardData ?? {}) as HfConfig;
  const siblings = Array.isArray(raw.siblings)
    ? (raw.siblings as { rfilename?: string }[])
    : [];
  const gated = raw.gated;

  return {
    id: str(raw.id) ?? str(raw.modelId) ?? "",
    sha: str(raw.sha) ?? "main",
    gated: typeof gated === "string" ? gated : gated === true ? "auto" : false,
    private: raw.private === true,
    downloads: num(raw.downloads),
    likes: num(raw.likes),
    lastModified: str(raw.lastModified),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    library: str(raw.library_name),
    pipelineTag: str(raw.pipeline_tag),
    license: str(cardData.license),
    params:
      safetensors && typeof safetensors.total === "number"
        ? {
            total: safetensors.total,
            byDtype: safetensors.parameters ?? {},
          }
        : undefined,
    files: siblings
      .map((file) => file.rfilename)
      .filter((name): name is string => Boolean(name)),
  };
}

interface FetchOptions {
  /** A Hub token — required for gated or private repos. */
  token?: string;
  signal?: AbortSignal;
  /** Bypass the in-memory cache and re-read the repo. */
  refresh?: boolean;
}

/**
 * Snapshots already read, keyed by `id@revision`. Module scope, like
 * lib/view-state.ts: switching panel or locale remounts the tree, and a model
 * the reader already loaded should still be loaded when it comes back. A fresh
 * page load starts empty.
 */
const SNAPSHOTS = new Map<string, HfModelSnapshot>();

const cacheKey = (ref: HfModelRef) => `${ref.id}@${ref.revision}`;

/** A snapshot already in hand, without fetching. */
export function cachedSnapshot(ref: HfModelRef): HfModelSnapshot | undefined {
  return SNAPSHOTS.get(cacheKey(ref));
}

/**
 * Read one model: repo facts, config.json, and the model card, pinned to the
 * commit the repo resolves to. Throws `HfError` — the code names what to say.
 */
export async function fetchModelSnapshot(
  ref: HfModelRef,
  options: FetchOptions = {},
): Promise<HfModelSnapshot> {
  if (!/^[^/\s]+\/[^/\s]+$/.test(ref.id)) throw new HfError("bad-ref");

  const key = cacheKey(ref);
  if (!options.refresh) {
    const hit = SNAPSHOTS.get(key);
    if (hit) return hit;
  }

  const infoResponse = await hfFetch(
    `/api/models/${ref.id}?revision=${encodeURIComponent(ref.revision)}`,
    options,
  );
  if (!infoResponse.ok) throw statusError(infoResponse.status, false);
  const repo = readRepoInfo((await infoResponse.json()) as HfConfig);

  // The config is read at the resolved commit, so it and the parameter counts
  // describe one state of the repo rather than two.
  const at = repo.sha || ref.revision;
  const configResponse = await hfFetch(
    `/${ref.id}/resolve/${encodeURIComponent(at)}/config.json`,
    options,
  );

  if (!configResponse.ok) {
    if (configResponse.status === 404) throw new HfError("no-config");
    throw statusError(configResponse.status, repo.gated);
  }
  let config: HfConfig;
  try {
    config = (await configResponse.json()) as HfConfig;
  } catch {
    throw new HfError("no-config");
  }

  const snapshot: HfModelSnapshot = {
    ref,
    repo: { ...repo, id: repo.id || ref.id },
    config,
    shape: deriveModelShape(config, repo),
    fetchedAt: Date.now(),
  };
  SNAPSHOTS.set(key, snapshot);
  return snapshot;
}

/* -------------------------------------------------------------------------
 * Presentation helpers
 * ---------------------------------------------------------------------- */

/**
 * Parameters a single token actually touches, estimated.
 *
 * The model card is where `#Activated Params` is authoritative, but it lives in
 * hand-written Markdown, so it is derived here instead: everything outside the
 * routed experts is touched by every token, and of the experts only
 * `expertsPerTok` of `numExperts` are.
 *
 *   activated = total − expertParams × (1 − expertsPerTok / numExperts)
 *   expertParams = moeLayers × numExperts × 3 × hidden × expertWidth
 *
 * The 3 is gate/up/down. Shared experts, dense-FFN layers, attention and the
 * embeddings need no special case: they sit in the remainder, which is exactly
 * where fully-activated weight belongs. MTP layers carry experts too, so they
 * count toward `moeLayers`.
 *
 * It runs high by a few percent because `total` counts stored tensors that are
 * not parameters (quantization scales). Checked against the counts the cards
 * publish: DeepSeek-V3 40.1 vs 37 B, DeepSeek-V4-Flash 14.1 vs 13 B,
 * Qwen3-30B-A3B 3.35 vs 3.3 B, Kimi-K2 32.9 vs 32 B, gpt-oss-120b 5.7 vs 5.1 B
 * — so it is reported as an estimate, never as a fact.
 */
export function estimateActivatedParams(shape: ModelShape): number | undefined {
  const { moe, paramCount, numLayers, hiddenSize } = shape;
  if (!moe || !paramCount || !numLayers || !hiddenSize) return undefined;
  const expertWidth = moe.expertIntermediateSize ?? shape.intermediateSize;
  if (!expertWidth || !moe.numExperts) return undefined;

  const step = moe.sparseStep && moe.sparseStep > 1 ? moe.sparseStep : 1;
  const moeLayers =
    Math.floor((numLayers - (moe.denseLayers ?? 0)) / step) +
    (shape.numNextnPredictLayers ?? 0);
  if (moeLayers <= 0) return undefined;

  const expertParams =
    moeLayers * moe.numExperts * 3 * hiddenSize * expertWidth;
  const idle = 1 - moe.expertsPerTok / moe.numExperts;
  const activated = paramCount - expertParams * idle;
  // A negative or above-total answer means the shape assumptions do not hold
  // for this architecture; say nothing rather than print a wrong number.
  return activated > 0 && activated <= paramCount ? activated : undefined;
}

/**
 * 30532122624 → "30.53 B". Parameter counts, as a spec sheet writes them —
 * for a panel reporting the weight count it sized against.
 */
export function formatParamCount(count: number): string {
  if (count >= 1e12) return `${(count / 1e12).toFixed(2)} T`;
  if (count >= 1e9) return `${(count / 1e9).toFixed(2)} B`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)} M`;
  return count.toLocaleString("en-US");
}

/**
 * How the model routes its FFN, as one line: "dense", or the MoE topology.
 * Read by the facts table, and by any panel that reports what it assumed.
 */
export function describeRouting(shape: ModelShape): string {
  const moe = shape.moe;
  if (!moe) return "dense";
  const shared = moe.numSharedExperts
    ? ` + ${moe.numSharedExperts} shared`
    : "";
  return `MoE ${moe.expertsPerTok}/${moe.numExperts}${shared}`;
}

/** How attention caches its keys and values: MHA, GQA, MQA or MLA. */
export function describeAttention(shape: ModelShape): string {
  if (shape.mla) return `MLA (rank ${shape.mla.kvLoraRank})`;
  const heads = shape.numAttentionHeads;
  const kv = shape.numKeyValueHeads;
  if (!heads || !kv) return "—";
  if (kv === heads) return `MHA ${heads}h`;
  if (kv === 1) return `MQA ${heads}h`;
  return `GQA ${heads}h/${kv}kv`;
}

/* -------------------------------------------------------------------------
 * Copy
 * ---------------------------------------------------------------------- */

/** Everything the model picker says, per locale. */
export interface ModelSourceCopy {
  /** Section label above the picker. */
  title: string;
  inputLabel: string;
  inputHint: string;
  search: string;
  loading: string;
  reload: string;
  clear: string;
  openOnHub: string;
  copyConfig: string;
  copied: string;
  /** The facts table's group names, one per block of rows. */
  groups: {
    size: string;
    layout: string;
    attention: string;
    ffn: string;
    precision: string;
  };
  /** Row labels of the facts table. */
  facts: {
    params: string;
    activated: string;
    layers: string;
    hidden: string;
    attention: string;
    headDim: string;
    routing: string;
    expertFfn: string;
    ffn: string;
    vocab: string;
    context: string;
    /** How the weights are stored — measured. */
    dtype: string;
    /** What the config says the model loads and computes in. */
    computeDtype: string;
    mtp: string;
    tied: string;
    sliding: string;
  };
  /** The folded remainder of the dtype bar. */
  other: string;
  /** Marks a value the config did not state, and one we worked out ourselves. */
  unknown: string;
  derived: string;
  tiedYes: string;
  tiedNo: string;
  /** Warning when the decoder was read out of a nested config. */
  nested: (key: string) => string;
  /** Sentence per `HfErrorCode`. */
  errors: Record<HfErrorCode, string>;
  /** Shown before a model is loaded. */
  empty: string;
}

export const modelSourceCopy: Record<Locale, ModelSourceCopy> = {
  en: {
    title: "Model",
    inputLabel: "Hugging Face model",
    inputHint: "huggingface.co model URL",
    search: "Search",
    loading: "Loading…",
    reload: "Reload",
    clear: "Clear",
    openOnHub: "Open on the Hub",
    copyConfig: "Copy config.json",
    copied: "Copied",
    groups: {
      size: "Size",
      layout: "Layout",
      attention: "Attention",
      ffn: "FFN",
      precision: "Precision",
    },
    facts: {
      params: "#Total Params",
      activated: "#Activated Params",
      layers: "Layers",
      hidden: "Hidden size",
      attention: "Attention",
      headDim: "Head dim",
      routing: "FFN routing",
      expertFfn: "Expert FFN",
      ffn: "FFN width",
      vocab: "Vocab",
      context: "Max context",
      dtype: "Checkpoint dtype",
      computeDtype: "Compute dtype",
      mtp: "MTP heads",
      tied: "Embeddings",
      sliding: "Sliding window",
    },
    other: "other",
    unknown: "not stated",
    derived: "derived",
    tiedYes: "tied",
    tiedNo: "untied",
    nested: (key) => `From ${key} — language model only.`,
    errors: {
      "bad-ref": "Not a model URL.",
      "not-found": "Not found.",
      gated: "Gated — config not public.",
      unauthorized: "Private repo.",
      "no-config": "No readable config.json.",
      "rate-limited": "Rate-limited by the Hub.",
      network: "Could not reach the Hub.",
    },
    empty: "No model loaded yet.",
  },
  zh: {
    title: "模型",
    inputLabel: "Hugging Face 模型",
    inputHint: "huggingface.co 模型链接",
    search: "搜索",
    loading: "加载中…",
    reload: "重新加载",
    clear: "清除",
    openOnHub: "在 Hub 上打开",
    copyConfig: "复制 config.json",
    copied: "已复制",
    groups: {
      size: "规模",
      layout: "结构",
      attention: "注意力",
      ffn: "FFN",
      precision: "精度",
    },
    facts: {
      params: "#Total Params",
      activated: "#Activated Params",
      layers: "层数",
      hidden: "隐层维度",
      attention: "注意力",
      headDim: "单头维度",
      routing: "FFN 路由",
      expertFfn: "专家 FFN",
      ffn: "FFN 宽度",
      vocab: "词表",
      context: "最大上下文",
      dtype: "权重精度",
      computeDtype: "计算精度",
      mtp: "MTP 头",
      tied: "词嵌入",
      sliding: "滑动窗口",
    },
    other: "其他",
    unknown: "未提供",
    derived: "推导",
    tiedYes: "共享",
    tiedNo: "独立",
    nested: (key) => `读自 ${key}——仅语言模型。`,
    errors: {
      "bad-ref": "不是模型链接。",
      "not-found": "未找到。",
      gated: "受限模型，config 未公开。",
      unauthorized: "私有仓库。",
      "no-config": "无可读的 config.json。",
      "rate-limited": "Hub 限流中。",
      network: "无法连接 Hub。",
    },
    empty: "尚未加载模型。",
  },
};

export function getModelSourceCopy(lang: Locale): ModelSourceCopy {
  return modelSourceCopy[lang];
}
