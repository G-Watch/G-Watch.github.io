import type { Locale } from "./i18n";

/**
 * Calculator — the fourth top-level section, alongside Open Traces, Docs and
 * Blog. It sizes LLM training and serving: what fits, what it costs, how fast
 * it can go.
 *
 * USER-OWNED: this file is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * The page is one workbench: a sidebar of panels on the left, the active panel
 * on the right. A panel is a self-contained calculation; the model it computes
 * against is picked once, above them all (components/model-picker.tsx), so
 * moving between panels never means re-entering the architecture.
 *
 * Adding a panel is one entry here plus a branch in the renderer.
 */

/** A panel's id — the value carried in `?panel=` and in the copy tables. */
export type PanelId = "memory";

export interface CalculatorPanel {
  id: PanelId;
  /** Whether the panel computes against a loaded model. */
  needsModel: boolean;
}

export const CALCULATOR_PANELS: CalculatorPanel[] = [
  { id: "memory", needsModel: true },
];

export const DEFAULT_PANEL: PanelId = "memory";

/** The panel `?panel=` asks for, falling back to the default. */
export function getPanel(id: string | null | undefined): CalculatorPanel {
  return (
    CALCULATOR_PANELS.find((panel) => panel.id === id) ??
    (CALCULATOR_PANELS.find(
      (panel) => panel.id === DEFAULT_PANEL,
    ) as CalculatorPanel)
  );
}

/** Sidebar and chrome copy for one locale. */
export interface CalculatorCopy {
  title: string;
  /** One line above the workbench: what this section is for. */
  intro: string;
  /**
   * Name and one-line purpose per panel. The purpose is the sidebar row's
   * tooltip — the page itself carries no headings.
   */
  panels: Record<PanelId, { label: string; blurb: string }>;
  /** Stand-in shown where a live panel's body is not written yet. */
  underConstruction: string;
  /** Shown by a model-driven panel before a model is loaded. */
  needsModel: string;
  /** The methodology document behind the button beside the Model heading. */
  methodology: {
    button: string;
    title: string;
    /** Shown while lib/calculator-doc.ts is still empty. */
    empty: string;
    close: string;
  };
}

export const calculatorCopy: Record<Locale, CalculatorCopy> = {
  en: {
    title: "Calculator",
    intro:
      "Size LLM training and serving from a model's own architecture: what fits in memory, what it costs, and how fast it can run.",
    panels: {
      memory: {
        label: "Memory",
        blurb: "Weights, KV cache, activations, overhead.",
      },
    },
    underConstruction: "Inputs being built.",
    needsModel: "Load a model above.",
    methodology: {
      button: "How we calculate these numbers?",
      title: "Methodology",
      empty: "Not written yet.",
      close: "Close",
    },
  },
  zh: {
    title: "计算器",
    intro:
      "从模型自身的架构参数出发，估算 LLM 训练与推理的规模：显存放不放得下、成本多少、能跑多快。",
    panels: {
      memory: {
        label: "显存",
        blurb: "权重、KV cache、激活、框架开销。",
      },
    },
    underConstruction: "输入项搭建中。",
    needsModel: "先在上方加载一个模型。",
    methodology: {
      button: "计算方式",
      title: "计算方式",
      empty: "尚未撰写。",
      close: "关闭",
    },
  },
};

export function getCalculatorCopy(lang: Locale): CalculatorCopy {
  return calculatorCopy[lang];
}
