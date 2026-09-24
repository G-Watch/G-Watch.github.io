"use client";

import { getCalculatorCopy } from "@/lib/calculator";
import type { HfModelSnapshot } from "@/lib/hf-model";
import type { Locale } from "@/lib/i18n";
import { Ghost } from "./calculator-workbench";

/**
 * Memory — the first calculator panel: what a model's weights, KV cache,
 * activations and framework overhead add up to under a given parallel layout,
 * precision, speculative-decoding and KV-compression scheme.
 *
 * The body is not written yet. The model above is the panel's whole input so
 * far, and `model.shape` is what the arithmetic will read: layers, hidden size,
 * KV head count (or the MLA latent rank), expert topology, checkpoint dtype.
 */
export function MemoryPanel({
  lang,
  model,
}: {
  lang: Locale;
  model: HfModelSnapshot | null;
}) {
  const t = getCalculatorCopy(lang);

  return (
    <section className="rounded border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        {model ? t.underConstruction : t.needsModel}
      </p>
      <div className="mt-3 space-y-2">
        {["w-full", "w-4/5", "w-2/3"].map((width) => (
          <Ghost key={width} className={width} />
        ))}
      </div>
    </section>
  );
}
