"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CALCULATOR_PANELS,
  getCalculatorCopy,
  getPanel,
  type PanelId,
} from "@/lib/calculator";
import type { HfModelSnapshot } from "@/lib/hf-model";
import type { Locale } from "@/lib/i18n";
import { useKeptState } from "@/lib/view-state";
import { ModelPicker } from "./model-picker";
import { MemoryPanel } from "./calculator-memory-panel";

/**
 * The calculator's frame: panels on the left, the active one on the right.
 *
 * The model lives here rather than in a panel, because it is the one input
 * every panel shares — switching panels keeps it loaded, and a panel receives
 * it as a prop instead of fetching for itself.
 */

/** A dashed stand-in for something the panel does not have yet. */
export function Ghost({ className = "w-20" }: { className?: string }) {
  return (
    <span
      className={`block h-[1.4em] rounded border border-dashed border-line bg-line-soft/40 ${className}`}
      aria-hidden="true"
    />
  );
}

export function CalculatorWorkbench({
  lang,
  doc,
}: {
  lang: Locale;
  /** The methodology document, rendered at build time; "" while unwritten. */
  doc: string;
}) {
  const search = useSearchParams();
  const t = getCalculatorCopy(lang);

  // The panel lives in the query string so a view can be pasted to someone
  // else; the model the reader loaded is kept across a remount instead, so a
  // locale switch does not throw the lookup away.
  const [active, setActive] = useState<PanelId>(
    () => getPanel(search.get("panel")).id,
  );
  const [model, setModel] = useKeptState<HfModelSnapshot | null>(
    "calculator:model",
    null,
  );

  useEffect(() => {
    const query = new URLSearchParams({ panel: active });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${query}`,
    );
  }, [active]);

  const panel = getPanel(active);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-x-6 gap-y-6 lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-x-hidden overflow-y-auto border-muted/30 pr-6 lg:border-r">
        <ul className="space-y-px lg:w-[212px]">
          {CALCULATOR_PANELS.map((entry) => {
            const copy = t.panels[entry.id];
            const selected = entry.id === panel.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setActive(entry.id)}
                  title={copy.blurb}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs transition-colors ${
                    selected
                      ? "bg-paper-deep font-bold text-accent-strong"
                      : "text-ink-soft hover:bg-paper-deep/60 hover:text-ink"
                  }`}
                >
                  {copy.label}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pb-2">
        {panel.needsModel && (
          <ModelPicker
            lang={lang}
            value={model}
            onChange={setModel}
            doc={doc}
          />
        )}
        {panel.id === "memory" && <MemoryPanel lang={lang} model={model} />}
      </div>
    </div>
  );
}
