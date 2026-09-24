"use client";

import { useEffect, useState } from "react";
import { archNameOf, buildArchModel, coverage } from "@/lib/arch";
import { getArchCopy } from "@/lib/arch/copy";
import type { ArchModel } from "@/lib/arch/types";
import type { HfModelSnapshot } from "@/lib/hf-model";
import type { Locale } from "@/lib/i18n";
import { ArchDiagram } from "./arch-diagram";

/**
 * Loads the architecture spec for a model and renders its diagram.
 *
 * A spec may need repo files beyond config.json, so the build is async and
 * happens here rather than in the diagram. An architecture with no spec says
 * so — the registry covers what has been written by hand, and the gap is
 * stated rather than filled with a guess.
 */
export function ArchPanel({
  snapshot,
  lang,
}: {
  snapshot: HfModelSnapshot;
  lang: Locale;
}) {
  const t = getArchCopy(lang);
  // The result carries the commit it was built for, so a build that resolves
  // after the reader moved on is simply not the current one — no ticket to
  // track, and no setState in the effect body.
  const [build, setBuild] = useState<{
    key: string;
    model: ArchModel | null;
  } | null>(null);
  const key = `${snapshot.ref.id}@${snapshot.repo.sha}`;

  useEffect(() => {
    const controller = new AbortController();
    buildArchModel(snapshot, controller.signal)
      .then((model) => setBuild({ key, model: model ?? null }))
      .catch(() => setBuild({ key, model: null }));
    return () => controller.abort();
  }, [snapshot, key]);

  const ready = build?.key === key ? build : null;
  if (ready?.model) {
    return <ArchDiagram model={ready.model} snapshot={snapshot} lang={lang} />;
  }

  const arch = archNameOf(snapshot.config);
  return (
    <p className="border-t border-line px-4 py-2.5 text-[11px] text-muted">
      {!ready
        ? t.loading
        : `${arch ? t.unsupported(arch) + " " : ""}${t.coverage(coverage().length)}`}
    </p>
  );
}
