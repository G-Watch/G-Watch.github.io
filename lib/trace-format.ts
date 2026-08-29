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
 * How lanes are ordered down the axis.
 *
 * "role" buckets them by the warp role that lane executes (the roles in the
 * order the legend lists them, threads ascending inside each), so a
 * warp-specialized kernel reads as its producer / math / scheduler bands.
 * "tid" is the plain hardware order, thread id ascending.
 */
export const LANE_ORDERS = ["role", "tid"] as const;
export type LaneOrder = (typeof LANE_ORDERS)[number];

/**
 * Row index per lane at one level, plus the row count. A row index is a dense
 * renumbering of the group key, assigned in the order the lanes are displayed
 * (see LaneOrder) — not in the order they happen to be stored.
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

/**
 * Each lane's warp role, read off the scopes it actually executes.
 *
 * A role is a property of the scope, not of the lane, so it is derived here:
 * every scope a lane enters names the same role in a warp-specialized kernel,
 * and the first one wins if a lane ever straddles two. Lanes that recorded
 * nothing have no role and sort last.
 */
function laneRoles(data: TraceData): (string | undefined)[] {
  const roleOfScope = new Map(data.scopes.map((s) => [s.id, s.role]));
  const roles: (string | undefined)[] = new Array(data.lanes.length);
  const assigned = new Uint8Array(data.lanes.length);
  for (const [lane, scope] of data.intervals) {
    if (assigned[lane]) continue;
    assigned[lane] = 1;
    roles[lane] = roleOfScope.get(scope);
  }
  return roles;
}

/** Roles in the order the legend lists them: first appearance in scope order. */
function roleRanks(data: TraceData): Map<string | undefined, number> {
  const rank = new Map<string | undefined, number>();
  for (const scope of data.scopes) {
    if (!rank.has(scope.role)) rank.set(scope.role, rank.size);
  }
  return rank;
}

/**
 * True when the lanes carry more than one warp role, i.e. when ordering by role
 * and ordering by thread id are actually different views. A single-role kernel
 * gets no say in the matter, so callers can hide the choice.
 */
export function hasWarpRoles(data: TraceData): boolean {
  const seen = new Set<string>();
  for (const scope of data.scopes) if (scope.role) seen.add(scope.role);
  return seen.size > 1;
}

/** Lane indices in display order. */
function laneSequence(data: TraceData, order: LaneOrder): Int32Array {
  const seq = new Int32Array(data.lanes.length);
  for (let i = 0; i < seq.length; i++) seq[i] = i;
  if (order === "tid") {
    return seq.sort((a, b) => data.lanes[a].tid - data.lanes[b].tid);
  }
  const rank = roleRanks(data);
  const roles = laneRoles(data);
  const rankOf = (lane: number) => {
    const at = rank.get(roles[lane]);
    return at === undefined ? rank.size : at;
  };
  return seq.sort(
    (a, b) => rankOf(a) - rankOf(b) || data.lanes[a].tid - data.lanes[b].tid,
  );
}

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

export function buildLaneRows(
  data: TraceData,
  level: LaneLevel,
  order: LaneOrder = "role",
): LaneRows {
  const repeat = Math.max(1, data.laneRepeat);
  const seq = laneSequence(data, order);
  // On the thread axis a lane owns the whole run of threads it stands for, so
  // its intervals are drawn once across that band instead of copied per row.
  if (level === "thread" && repeat > 1) {
    const rowOf = new Int32Array(data.lanes.length);
    seq.forEach((lane, at) => {
      rowOf[lane] = at * repeat;
    });
    return {
      level,
      rowOf,
      span: repeat,
      count: seq.length * repeat,
      label: (row) => {
        const lane = data.lanes[seq[Math.floor(row / repeat)]];
        return lane ? `T${lane.tid + (row % repeat)}` : "";
      },
    };
  }

  const rowOf = new Int32Array(data.lanes.length);
  const seen = new Map<number, number>();
  const keys: number[] = [];
  // Walking in display order is what puts the rows in that order; a key first
  // seen late (a block whose lanes span two roles) keeps the row it already got.
  seq.forEach((lane) => {
    const key = keyOf(data.lanes[lane], level);
    let row = seen.get(key);
    if (row === undefined) {
      row = seen.size;
      seen.set(key, row);
      keys.push(key);
    }
    rowOf[lane] = row;
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
 * Where a set of lanes sits in display order, as a fraction of the axis. The
 * lane window is normalised [0,1], so this is what an outside caller (the SM
 * dispatching grid picking a block) needs to zoom to those lanes.
 *
 * `whole` says the band holds nothing but the matched lanes. A block is one
 * contiguous run of threads, so it is whole under "tid" order and split across
 * the role bands under "role" — and a band that is not whole cannot be zoomed
 * to without dragging every other block's lanes along with it.
 */
export function laneBand(
  data: TraceData,
  order: LaneOrder,
  match: (lane: TraceLane) => boolean,
): { v0: number; v1: number; whole: boolean } | null {
  const seq = laneSequence(data, order);
  let lo = seq.length;
  let hi = 0;
  let hits = 0;
  seq.forEach((lane, at) => {
    if (!match(data.lanes[lane])) return;
    hits++;
    if (at < lo) lo = at;
    if (at + 1 > hi) hi = at + 1;
  });
  if (hi <= lo) return null;
  return { v0: lo / seq.length, v1: hi / seq.length, whole: hi - lo === hits };
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
