"use client";

import { useMemo } from "react";
import { type TraceData } from "@/lib/trace-format";

/**
 * Where the launch's blocks landed on the chip: one cell per SM, listing the
 * blocks the scheduler assigned to it. Clicking a block hands it back to the
 * trace view, which zooms its lane axis to that block.
 */

interface SmCell {
  sm: number;
  blocks: number[];
}

/** One cell per SM from 0 to the highest observed id, dispatched blocks sorted. */
function buildCells(data: TraceData): SmCell[] {
  const bySm = new Map<number, number[]>();
  let maxSm = -1;
  for (const [blockKey, sm] of Object.entries(data.smDispatch)) {
    const block = Number(blockKey);
    if (!Number.isFinite(block) || !Number.isFinite(sm)) continue;
    if (!bySm.has(sm)) bySm.set(sm, []);
    bySm.get(sm)!.push(block);
    if (sm > maxSm) maxSm = sm;
  }
  const cells: SmCell[] = [];
  for (let sm = 0; sm <= maxSm; sm++) {
    cells.push({ sm, blocks: (bySm.get(sm) ?? []).sort((a, b) => a - b) });
  }
  return cells;
}

export function TraceSmDispatch({
  data,
  onSelectBlock,
}: {
  data: TraceData;
  onSelectBlock: (block: number) => void;
}) {
  const cells = useMemo(() => buildCells(data), [data]);
  const nBlocks = Object.keys(data.smDispatch).length;

  if (!cells.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        This trace carries no SM dispatch data.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="text-xs text-muted">
        {nBlocks} block{nBlocks === 1 ? "" : "s"} over {cells.length} SMs — each
        cell is one SM; click a block to zoom the trace to its lanes.
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}
        >
          {cells.map((cell) => (
            <div
              key={cell.sm}
              className={`rounded-md border p-1.5 ${
                cell.blocks.length
                  ? "border-line bg-surface"
                  : "border-dashed border-line/60"
              }`}
            >
              <div className="mb-1 text-[0.6rem] font-medium uppercase tracking-wide text-muted">
                SM {cell.sm}
              </div>
              <div className="flex flex-wrap gap-1">
                {cell.blocks.length ? (
                  cell.blocks.map((block) => (
                    <button
                      key={block}
                      type="button"
                      onClick={() => onSelectBlock(block)}
                      className="rounded bg-accent-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-accent-strong transition-colors hover:bg-accent-strong hover:text-surface"
                      title={`zoom the trace to block ${block}`}
                    >
                      B{block}
                    </button>
                  ))
                ) : (
                  <span className="text-[0.65rem] text-muted">idle</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
