import type { Locale } from "./i18n";

/**
 * Open Traces — the third top-level section alongside Docs and Blog.
 *
 * USER-OWNED: this file is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * A published trace is addressed by a fixed six-level taxonomy:
 *
 *   vendor → software → version → arch   → kernel → params      → Trace
 *   NVIDIA → cuDNN    → v9.0    → sm90a  → …      → [b=…, s=…]
 *
 * Traces are authored as a FLAT list; the tree the sidebar renders is derived
 * at render time by grouping on those levels in order. Adding a trace is one
 * flat object, and no level can be misfiled by nesting it wrongly.
 */

/** The taxonomy levels, outermost first. Sidebar and breadcrumb follow this order. */
export const TRACE_LEVELS = [
  "vendor",
  "software",
  "version",
  "arch",
  "kernel",
  "params",
] as const;

export type TraceLevel = (typeof TRACE_LEVELS)[number];

/**
 * Levels the sidebar tree navigates. Kernel and params are not sidebar nodes —
 * they are columns of the trace table, so one kernel can be compared across
 * its parameter sets rather than being buried one branch deeper.
 */
export const NAV_LEVELS = TRACE_LEVELS.slice(0, 4);

/** Levels whose value is a plain string (every level except params). */
const STRING_LEVELS = TRACE_LEVELS.slice(0, -1);

/** One published trace — a leaf of the taxonomy. */
export interface TraceRecord {
  /** Level 1 — the hardware vendor, e.g. "NVIDIA", "AMD". */
  vendor: string;
  /** Level 2 — the software that produced the kernel, e.g. "cuDNN", "Triton". */
  software: string;
  /** Level 3 — that software's release, e.g. "v9.0". */
  version: string;
  /** Level 4 — the GPU target the trace was captured on, e.g. "sm90a". */
  arch: string;
  /** Level 5 — the traced kernel's name. */
  kernel: string;
  /**
   * Level 6 — everything that pins one invocation: the launch shape plus the
   * qualifiers that vary independently of it, e.g.
   * `{ b: 2, s: 1024, precision: "fp16", layout: "BSHD" }`.
   */
  params: Record<string, string | number>;
  /**
   * Where the trace itself lives: a locale-relative internal route, or an
   * absolute "https://…" (opens in a new tab).
   */
  href?: string;
  /** Capture facts, one table column each, e.g. `{ GPU: "H100 PCIe" }`. */
  meta?: Record<string, string>;
  /** The G-Watch release that captured the trace, e.g. "0.0.31". */
  gwatchVersion?: string;
  /**
   * URL of this trace's panel JSON (see lib/trace-format.ts), fetched only when
   * the row is opened. Site-rooted paths get the deploy base path applied.
   */
  trace?: string;
}

/**
 * MOCK DATA — a cuDNN catalog used to exercise the browser until the real
 * records arrive. `href` is deliberately unset everywhere: the trace itself is
 * not rendered yet, so every row shows an empty trace cell.
 */
const MOCK_TRACE_RECORDS: TraceRecord[] = [
  // cuDNN v9.0 · sm90a · fused multi-head attention
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp16", layout: "BSHD" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
    trace: "/traces/cudnn-fused-mha-fprop-b2h8s1024d64.json",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 4, h: 16, s: 2048, d: 64, precision: "fp16", layout: "BSHD" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 1, h: 32, s: 4096, d: 128, precision: "bf16", layout: "BSHD" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "cudnn_fused_mha_bprop",
    params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp16", layout: "BSHD" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
  },
  // cuDNN v9.0 · sm90a · implicit-GEMM convolution
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "sm90_xmma_fprop_implicit_gemm_f16f16_f16f32_nhwc",
    params: {
      n: 32,
      c: 256,
      h: 56,
      w: 56,
      k: 256,
      r: 3,
      s: 3,
      precision: "fp16",
      layout: "NHWC",
    },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "sm90_xmma_fprop_implicit_gemm_f16f16_f16f32_nhwc",
    params: {
      n: 64,
      c: 512,
      h: 28,
      w: 28,
      k: 512,
      r: 1,
      s: 1,
      precision: "fp16",
      layout: "NHWC",
    },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.29",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "sm90_xmma_dgrad_implicit_gemm_f16f16_f16f32_nhwc",
    params: {
      n: 32,
      c: 256,
      h: 56,
      w: 56,
      k: 256,
      r: 3,
      s: 3,
      precision: "fp16",
      layout: "NHWC",
    },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.30",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm90a",
    kernel: "cudnn_batchnorm_fwd_training_nhwc",
    params: { n: 64, c: 256, h: 56, w: 56, precision: "fp16", layout: "NHWC" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.30",
  },
  // cuDNN v9.0 · sm89 (Ada)
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm89",
    kernel: "sm89_xmma_fprop_implicit_gemm_f16f16_f16f32_nhwc",
    params: {
      n: 32,
      c: 256,
      h: 56,
      w: 56,
      k: 256,
      r: 3,
      s: 3,
      precision: "fp16",
      layout: "NHWC",
    },
    meta: { GPU: "L40S" },
    gwatchVersion: "0.0.30",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.0",
    arch: "sm89",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp16", layout: "BSHD" },
    meta: { GPU: "L40S" },
    gwatchVersion: "0.0.30",
  },
  // cuDNN v9.2 · sm100a (Blackwell)
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.2",
    arch: "sm100a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp8", layout: "BSHD" },
    meta: { GPU: "B200" },
    gwatchVersion: "0.0.31",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.2",
    arch: "sm100a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 4, h: 16, s: 2048, d: 128, precision: "fp8", layout: "BSHD" },
    meta: { GPU: "B200" },
    gwatchVersion: "0.0.31",
  },
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.2",
    arch: "sm100a",
    kernel: "sm100_xmma_fprop_implicit_gemm_f16f16_f16f32_nhwc",
    params: {
      n: 32,
      c: 256,
      h: 56,
      w: 56,
      k: 256,
      r: 3,
      s: 3,
      precision: "fp16",
      layout: "NHWC",
    },
    meta: { GPU: "B200" },
    gwatchVersion: "0.0.31",
  },
  // cuDNN v9.2 · sm90a
  {
    vendor: "NVIDIA",
    software: "cuDNN",
    version: "v9.2",
    arch: "sm90a",
    kernel: "cudnn_fused_mha_fprop",
    params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp16", layout: "BSHD" },
    meta: { GPU: "H100 SXM" },
    gwatchVersion: "0.0.33",
  },
];

/**
 * The published traces. Language-neutral: one list shared by every locale.
 *
 * Example of one entry:
 *
 *   {
 *     vendor: "NVIDIA",
 *     software: "cuDNN",
 *     version: "v9.0",
 *     arch: "sm90a",
 *     kernel: "cudnn_flash_attn_fwd",
 *     params: { b: 2, h: 8, s: 1024, d: 64, precision: "fp16" },
 *     meta: { GPU: "H100 PCIe" },
 *     href: "https://…/trace.json",
 *     gwatchVersion: "0.0.31",
 *   }
 *
 * Mock catalog — replace with the real records. `getTraceCatalog()` below is
 * the single seam the renderer reads through, so swapping this for a fetched
 * or build-time-loaded JSON touches nothing else.
 */
export const openTraceRecords: TraceRecord[] = MOCK_TRACE_RECORDS;

/**
 * The catalog the page renders. THE ONE PLACE the data source is chosen.
 *
 * To move the catalog into JSON, replace the body with either:
 *   - build time — read/import the JSON in the server component and hand the
 *     parsed records to `<OpenTracesBrowser records={…} />`; or
 *   - runtime — fetch the JSON from `public/` in the browser and feed the
 *     result through `normalizeRecords()`.
 * Both keep the tree, the sidebar and the table exactly as they are.
 */
export function getTraceCatalog(): TraceRecord[] {
  return openTraceRecords;
}

/**
 * Gate for catalog data that did not come from TypeScript: keeps only entries
 * carrying every taxonomy level, so one malformed record cannot break the tree.
 */
export function normalizeRecords(raw: unknown): TraceRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is TraceRecord => {
    if (typeof entry !== "object" || entry === null) return false;
    const record = entry as Record<string, unknown>;
    const levelsPresent = STRING_LEVELS.every(
      (level) => typeof record[level] === "string" && record[level] !== "",
    );
    return (
      levelsPresent &&
      typeof record.params === "object" &&
      record.params !== null &&
      !Array.isArray(record.params)
    );
  });
}

/** The params level rendered as "b=2, h=8, s=1024, d=64, precision=fp16". */
export function formatParams(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

/** The value that places `record` at `level`. */
export function segmentOf(record: TraceRecord, level: TraceLevel): string {
  return level === "params" ? formatParams(record.params) : record[level];
}

/** The taxonomy path of `record`, from level `from` up to (excluding) `to`. */
export function pathOf(
  record: TraceRecord,
  from = 0,
  to = TRACE_LEVELS.length,
): string[] {
  return TRACE_LEVELS.slice(from, to).map((level) => segmentOf(record, level));
}

/** One node of the derived tree; `leaf` is set only at the deepest level built. */
export interface TraceTreeNode {
  /** The segment value, unique among its siblings. */
  key: string;
  /** The path from the root down to this node. */
  path: string[];
  /** Every record filed under this node. */
  records: TraceRecord[];
  /** Nodes one level deeper; empty at the deepest level built. */
  children: TraceTreeNode[];
  /** The trace itself, present only on params-level nodes. */
  leaf?: TraceRecord;
}

/** Versions read newest-first; every other level reads in natural order. */
function sortSegments(level: TraceLevel, keys: string[]): string[] {
  const natural = (a: string, b: string) =>
    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
  return level === "version"
    ? [...keys].sort((a, b) => natural(b, a))
    : [...keys].sort(natural);
}

/** Group `records` into the taxonomy tree, starting at level `depth`. */
export function buildTraceTree(
  records: TraceRecord[],
  maxDepth: number = TRACE_LEVELS.length,
  depth = 0,
  prefix: string[] = [],
): TraceTreeNode[] {
  const level = TRACE_LEVELS[depth];
  const groups = new Map<string, TraceRecord[]>();
  for (const record of records) {
    const key = segmentOf(record, level);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      groups.set(key, [record]);
    }
  }
  const isDeepest = depth === maxDepth - 1;
  return sortSegments(level, [...groups.keys()]).map((key) => {
    const bucket = groups.get(key) as TraceRecord[];
    const path = [...prefix, key];
    return {
      key,
      path,
      records: bucket,
      children: isDeepest
        ? []
        : buildTraceTree(bucket, maxDepth, depth + 1, path),
      leaf: isDeepest ? bucket[0] : undefined,
    };
  });
}

/** Every record filed under `path` (an empty path selects everything). */
export function filterRecords(
  records: TraceRecord[],
  path: string[],
): TraceRecord[] {
  return records.filter((record) =>
    path.every((segment, i) => segmentOf(record, TRACE_LEVELS[i]) === segment),
  );
}

/** Header, sidebar and trace-row copy for one locale. */
export interface OpenTracesCopy {
  eyebrow: string;
  title: string;
  intro: string;
  /** Shown while `openTraceRecords` is empty. */
  empty: string;
  /** Sits above the taxonomy diagram in the empty state. */
  emptyHint: string;
  /** Sidebar heading, and the breadcrumb root meaning "nothing selected". */
  all: string;
  /** Label for each taxonomy level, used in the sidebar and breadcrumbs. */
  levels: Record<TraceLevel, string>;
  /** The trace itself, as the last link of the chain. */
  trace: string;
  /** Call to action on a trace row. */
  viewTrace: string;
  /** How many traces sit under a node. */
  countLabel: (n: number) => string;
  /** Column headers the table adds beside params. */
  columns: { meta: string; gwatch: string };
  /** Caption under the placeholder rows of the skeleton. */
  skeletonNote: string;
  /** Leaves the trace view and returns to the table of traces. */
  backToTable: string;
  /**
   * One line above the browser: what captured these traces, and where to learn
   * it. Split around `product` so the tool's name can carry its own weight.
   */
  source: {
    lead: string;
    product: string;
    tail: string;
    link: { label: string; href: string };
  };
  /** Accessible names of the sidebar collapse / expand toggles. */
  collapse: string;
  expand: string;
  /** Placeholder of every column's filter box. */
  filterHint: string;
  /** Placeholder of the kernel search box above the kernel column. */
  kernelSearchHint: string;
  /** Resets every column filter at once. */
  clearFilters: string;
}

export const openTracesCopy: Record<Locale, OpenTracesCopy> = {
  en: {
    eyebrow: "Open Traces",
    title: "Open Traces",
    intro:
      "A public collection of GPU kernel traces captured with G-Watch. Walk the tree from a hardware vendor down to a GPU architecture, then compare the kernels traced on it.",
    empty: "No traces published yet.",
    emptyHint: "Traces are filed under this taxonomy:",
    all: "All traces",
    levels: {
      vendor: "Vendor",
      software: "Software",
      version: "Version",
      arch: "Architecture",
      kernel: "Kernel",
      params: "Parameters",
    },
    trace: "Trace",
    viewTrace: "View trace →",
    countLabel: (n) => (n === 1 ? "1 trace" : `${n} traces`),
    columns: { meta: "GPU", gwatch: "G-Watch version" },
    skeletonNote: "Published traces will be listed here.",
    backToTable: "← Back",
    source: {
      lead: "Traces are produced by ",
      product: "G-Watch Xtrace",
      tail: ".",
      link: {
        label: "Trace your own kernels",
        href: "/docs/humanize/intra-kernel-tracing/index/",
      },
    },
    collapse: "Collapse",
    expand: "Expand",
    filterHint: "filter…",
    kernelSearchHint: "search kernels…",
    clearFilters: "Clear filters",
  },
  zh: {
    eyebrow: "Open Traces",
    title: "开放 Trace",
    intro:
      "用 G-Watch 采集的 GPU kernel trace 公开合集。从硬件厂商沿树下钻到具体架构，再横向比较该架构上采集的 kernel。",
    empty: "还没有公开的 trace。",
    emptyHint: "Trace 按以下层级归档：",
    all: "全部 trace",
    levels: {
      vendor: "厂商",
      software: "软件",
      version: "版本",
      arch: "硬件架构",
      kernel: "Kernel",
      params: "参数",
    },
    trace: "Trace",
    viewTrace: "查看 trace →",
    countLabel: (n) => `${n} 条 trace`,
    columns: { meta: "GPU", gwatch: "G-Watch version" },
    skeletonNote: "发布的 trace 会列在这里。",
    backToTable: "← 返回",
    source: {
      lead: "Trace 结果由 ",
      product: "G-Watch Xtrace",
      tail: " 产生。",
      link: {
        label: "追踪你自己的 kernel",
        href: "/docs/humanize/intra-kernel-tracing/index/",
      },
    },
    collapse: "收起",
    expand: "展开",
    filterHint: "过滤…",
    kernelSearchHint: "搜索 kernel…",
    clearFilters: "清除过滤",
  },
};

/** Example values for each level, shown in the empty-state taxonomy diagram. */
export const TAXONOMY_EXAMPLE: Record<TraceLevel, string> = {
  vendor: "NVIDIA",
  software: "cuDNN",
  version: "v9.0",
  arch: "sm90a",
  kernel: "…",
  params: "b=…, s=…",
};

export function getOpenTracesCopy(lang: Locale): OpenTracesCopy {
  return openTracesCopy[lang];
}
