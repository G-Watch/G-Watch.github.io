import type { Locale } from "../i18n";

/** What the architecture diagram says, per locale. USER-OWNED. */
export interface ArchCopy {
  title: string;
  loading: string;
  /** Shown when the architecture has no spec written yet. */
  unsupported: (arch: string) => string;
  /** How many architectures are covered so far. */
  coverage: (n: number) => string;
  /** Folds an opened layer back into the strip. */
  back: string;
  /** Shows the multi-token-prediction block beside the model's own head. */
  mtp: string;
  mtpHint: string;
  /** Where the topology was read from. */
  source: string;
  /** Things the spec deliberately leaves out. */
  omitted: string;
}

export const archCopy: Record<Locale, ArchCopy> = {
  en: {
    title: "Architecture",
    loading: "Reading…",
    unsupported: (arch) => `No spec for ${arch} yet.`,
    coverage: (n) => `${n} architectures covered`,
    back: "Close layer",
    mtp: "MTP",
    mtpHint: "Show the multi-token-prediction block",
    source: "Topology from",
    omitted: "Not drawn",
  },
  zh: {
    title: "模型结构",
    loading: "读取中…",
    unsupported: (arch) => `尚未编写 ${arch} 的 spec。`,
    coverage: (n) => `已覆盖 ${n} 个 architecture`,
    back: "收起该层",
    mtp: "MTP",
    mtpHint: "显示多 token 预测块",
    source: "拓扑依据",
    omitted: "未绘制",
  },
};

export function getArchCopy(lang: Locale): ArchCopy {
  return archCopy[lang];
}
