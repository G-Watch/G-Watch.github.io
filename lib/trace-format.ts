/**
 * The trace panel's data contract — one captured kernel, rendered as intervals
 * on a time axis. USER-OWNED: `npm run upgrade` never touches this file.
 *
 * A raw G-Watch intra-kernel report holds one record per scope boundary per
 * thread (millions of them). This format is what a browser can hold: START/END
 * already paired into intervals, time rebased to 0, threads optionally sampled.
 */

/**
 * A named phase inside the kernel; each gets its own ink. `role` names the warp
 * role that executes the phase (math warpgroup, producer, scheduler, ...) — the
 * roles are per-kernel data, and the legend groups scopes under them.
 */
export interface TraceScope {
  id: number;
  label: string;
  role?: string;
}

/** One traced thread, and the hardware groupings it rolls up into. */
export interface TraceLane {
  /** Global thread id, as reported by the trace. */
  tid: number;
  /** Warp this thread belongs to (tid / 32). */
  warp: number;
  /** Warpgroup (4 warps). */
  wg: number;
  /** Thread block. */
  block: number;
}

/** `[lane index, scope id, start ns, duration ns]` — compact on purpose. */
export type TraceInterval = [number, number, number, number];

export interface TraceData {
  kernel: string;
  grid: number[];
  block: number[];
  blockSize: number;
  /** Kernel duration in ns; the time axis spans [0, span]. */
  span: number;
  clock: string;
  /** Every Nth thread was kept; 1 means the trace is complete. */
  sampledEvery: number;
  /**
   * How many consecutive threads each stored lane stands for. The converter
   * only sets this above 1 after checking that those threads carry an identical
   * timeline, which lockstep execution inside a warp gives you — so a full
   * per-thread axis can be drawn without storing the same intervals N times.
   */
  laneRepeat: number;
  totalThreads: number;
  scopes: TraceScope[];
  lanes: TraceLane[];
  intervals: TraceInterval[];
  /** Block (CTA) id -> the SM it ran on; empty when the capture had no SM ids. */
  smDispatch: Record<string, number>;
}

/** Vertical granularities, finest first. */
export const LANE_LEVELS = ["thread", "warp", "warpgroup", "block"] as const;
export type LaneLevel = (typeof LANE_LEVELS)[number];

/**
 * Row index per lane at one level, plus the row count. Lanes arrive ordered by
 * thread id, so every grouping is contiguous and a row index is just a dense
 * renumbering of the group key.
 */
export interface LaneRows {
  level: LaneLevel;
  /** rowOf[laneIndex] = first row this lane draws on. */
  rowOf: Int32Array;
  /** How many consecutive rows one lane covers (>1 only on an expanded thread axis). */
  span: number;
  count: number;
  /** Human label for a row, e.g. "W12". */
  label: (row: number) => string;
}

const LEVEL_PREFIX: Record<LaneLevel, string> = {
  thread: "T",
  warp: "W",
  warpgroup: "WG",
  block: "B",
};

function keyOf(lane: TraceLane, level: LaneLevel): number {
  switch (level) {
    case "thread":
      return lane.tid;
    case "warp":
      return lane.warp;
    case "warpgroup":
      return lane.wg;
    case "block":
      return lane.block;
  }
}

export function buildLaneRows(data: TraceData, level: LaneLevel): LaneRows {
  const repeat = Math.max(1, data.laneRepeat);
  // On the thread axis a lane owns the whole run of threads it stands for, so
  // its intervals are drawn once across that band instead of copied per row.
  if (level === "thread" && repeat > 1) {
    const rowOf = new Int32Array(data.lanes.length);
    data.lanes.forEach((_, i) => {
      rowOf[i] = i * repeat;
    });
    return {
      level,
      rowOf,
      span: repeat,
      count: data.lanes.length * repeat,
      label: (row) => {
        const lane = data.lanes[Math.floor(row / repeat)];
        return lane ? `T${lane.tid + (row % repeat)}` : "";
      },
    };
  }

  const rowOf = new Int32Array(data.lanes.length);
  const seen = new Map<number, number>();
  const keys: number[] = [];
  data.lanes.forEach((lane, i) => {
    const key = keyOf(lane, level);
    let row = seen.get(key);
    if (row === undefined) {
      row = seen.size;
      seen.set(key, row);
      keys.push(key);
    }
    rowOf[i] = row;
  });
  return {
    level,
    rowOf,
    span: 1,
    count: seen.size,
    label: (row) => `${LEVEL_PREFIX[level]}${keys[row] ?? ""}`,
  };
}

/**
 * Levels this trace can actually be drawn at, finest first.
 *
 * Two levels get dropped. A thread axis is dropped unless the stored lanes
 * account for every thread that ran (either nothing was sampled, or each lane
 * verifiably stands for its whole run) — otherwise the rows would be a subset
 * of threads pretending to be all of them. And of two levels that split the
 * lanes identically — 4 warps is exactly one block when blocks are 128 threads
 * — only the finer-named one is kept, since the coarser would just relabel the
 * same rows.
 */
export function usableLevels(data: TraceData): LaneLevel[] {
  const threadRows = data.lanes.length * Math.max(1, data.laneRepeat);
  const counted = LANE_LEVELS.filter(
    (level) => level !== "thread" || threadRows >= data.totalThreads,
  )
    .map((level) => ({
      level,
      count:
        level === "thread"
          ? threadRows
          : new Set(data.lanes.map((lane) => keyOf(lane, level))).size,
    }))
    .filter((entry) => entry.count > 1);

  const kept: LaneLevel[] = [];
  let lastCount = Infinity;
  for (const entry of counted) {
    if (entry.count < lastCount) {
      kept.push(entry.level);
      lastCount = entry.count;
    }
  }
  return kept.length > 0 ? kept : ["warp"];
}

/** Gate for trace JSON fetched at runtime; returns null if it is not one. */
export function normalizeTrace(raw: unknown): TraceData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Partial<TraceData>;
  if (
    typeof data.span !== "number" ||
    !Array.isArray(data.scopes) ||
    !Array.isArray(data.lanes) ||
    !Array.isArray(data.intervals)
  ) {
    return null;
  }
  return {
    kernel: typeof data.kernel === "string" ? data.kernel : "",
    grid: Array.isArray(data.grid) ? data.grid : [],
    block: Array.isArray(data.block) ? data.block : [],
    blockSize: typeof data.blockSize === "number" ? data.blockSize : 0,
    span: data.span,
    clock: typeof data.clock === "string" ? data.clock : "gpu",
    sampledEvery: typeof data.sampledEvery === "number" ? data.sampledEvery : 1,
    laneRepeat: typeof data.laneRepeat === "number" ? data.laneRepeat : 1,
    totalThreads:
      typeof data.totalThreads === "number"
        ? data.totalThreads
        : data.lanes.length,
    scopes: data.scopes,
    lanes: data.lanes,
    intervals: data.intervals,
    smDispatch:
      typeof data.smDispatch === "object" && data.smDispatch !== null
        ? data.smDispatch
        : {},
  };
}

/** Time formatted for axis ticks and readouts, in the unit the span calls for. */
export function formatTime(ns: number, span: number): string {
  const abs = Math.abs(ns);
  if (span >= 1e6) return `${(ns / 1e6).toFixed(abs >= 1e5 ? 2 : 3)} ms`;
  if (span >= 1e3) return `${(ns / 1e3).toFixed(abs >= 1e2 ? 1 : 2)} µs`;
  return `${Math.round(ns)} ns`;
}

/** A tick step that lands on 1/2/5 × 10ⁿ, so labels stay readable. */
export function niceStep(rough: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const scaled = rough / power;
  const step = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1;
  return step * power;
}
