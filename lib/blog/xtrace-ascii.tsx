// User-owned: the agent-view twins of lib/blog/xtrace-charts.tsx. Machine
// readers get the same data as monospace text: traces as timelines where each
// phase has its own full-cell block texture (shades, checkers), bars as
// eighth-block runs, plots framed in box-drawing characters. Registered in agentMdxComponents
// (lib/mdx-components.tsx). Server components; nothing ships to the browser.
import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import fa3 from "./xtrace-fa3.json";
import fa4 from "./xtrace-fa4.json";
import { phaseList, traceTitle } from "./open-trace";

// ------------------------------------------------------------------ shared

interface Span {
  key: string;
  start: number;
  end: number;
}

/**
 * One timeline row: each character covers `step` units and shows the span
 * that overlaps it most; a `fill` span shows only where no other span does.
 */
function lane(
  spans: Span[],
  glyph: Record<string, string>,
  cols: number,
  step: number,
  fill?: string,
): string {
  let out = "";
  for (let c = 0; c < cols; c++) {
    const a = c * step;
    const b = a + step;
    let best = "";
    let most = 0;
    let under = false;
    for (const s of spans) {
      const o = Math.min(b, s.end) - Math.max(a, s.start);
      if (o <= 0) continue;
      if (s.key === fill) under = true;
      else if (o > most) {
        most = o;
        best = s.key;
      }
    }
    out += best ? glyph[best] : under && fill ? glyph[fill] : " ";
  }
  return out;
}

/**
 * A framed plot: an axis of values over a box-drawing frame, one row per line,
 * each row's label to the left of the frame and an optional note to its right.
 */
function framed(
  rows: { label: string; body: string; note?: string }[],
  axis: { cols: number; every: number; value: (c: number) => string },
  labelW: number,
  marks?: { glyph: string; at: number[]; label: string },
): string {
  const pad = " ".repeat(labelW);
  const top = Array(axis.cols + 12).fill(" ");
  const ticks = Array(axis.cols).fill("─");
  for (let c = 0; c <= axis.cols; c += axis.every) {
    const text = axis.value(c);
    for (let i = 0; i < text.length; i++) top[c + i] = text[i];
    if (c > 0 && c < axis.cols - 2) ticks[c] = "┬";
  }
  const out = [`${pad} ${top.join("").trimEnd()}`];
  if (marks) {
    const m = Array(axis.cols).fill(" ");
    for (const c of marks.at) m[c] = marks.glyph;
    out.push(`${marks.label.padEnd(labelW)} ${m.join("").trimEnd()}`);
  }
  out.push(`${pad}┌${ticks.join("")}┐`);
  for (const r of rows) {
    out.push(
      `${r.label.padEnd(labelW)}│${r.body}│${r.note ? ` ${r.note}` : ""}`,
    );
  }
  out.push(`${pad}└${"─".repeat(axis.cols)}┘`);
  return out.join("\n");
}

const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

/** A horizontal bar of `n` characters, drawn to the eighth, padded to `width`. */
function bar(n: number, width: number): string {
  // snap to the nearest eighth first, so 29.9999… draws as 30 cells
  const eighths = Math.round(Math.max(0, Math.min(width, n)) * 8);
  const full = Math.floor(eighths / 8);
  const part = full < width ? EIGHTHS[eighths % 8] : "";
  const s = "█".repeat(full) + part;
  return s + " ".repeat(Math.max(0, width - [...s].length));
}

function legend(glyph: Record<string, string>, name: Record<string, string>) {
  return Object.keys(glyph)
    .map((k) => `${glyph[k]}${glyph[k]} ${name[k]}`)
    .join("   ");
}

// Menlo / SF Mono / DejaVu carry the block and box-drawing glyphs at one cell
// wide; a tight line height lets the solid blocks of adjacent rows meet.
const MONO = {
  fontFamily:
    'ui-monospace, "SF Mono", Menlo, "DejaVu Sans Mono", Consolas, monospace',
  lineHeight: 1.18,
};

function Block({ title, children }: { title: string; children: string }) {
  return (
    <>
      <p>
        <strong>{title}</strong>
      </p>
      {/* The font goes on <code> too: the site styles code in PT Mono, which
          has no box-drawing glyphs, and their fallback runs wider than a cell. */}
      <pre style={MONO}>
        <code style={MONO}>{children}</code>
      </pre>
    </>
  );
}

function Fig({
  caption,
  children,
}: {
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure>
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// ------------------------------------------------------------- FA-3 case

type Arm = "xtrace" | "neutrino" | "iket" | "none";
const ARM_NAME: Record<Arm, string> = {
  xtrace: "Xtrace",
  neutrino: "Existing tool A",
  iket: "Existing tool B",
  none: "Counters only",
};
const ARMS: Arm[] = ["xtrace", "neutrino", "iket", "none"];

type Phase3 = { region: string; start: number; end: number; row: number };
const F3 = fa3 as unknown as {
  sota: number;
  curves: Record<Arm, number[]>;
  reach: Record<Arm, number | null>;
  panels: Record<
    Exclude<Arm, "none">,
    {
      span: number;
      producer: Phase3[];
      consumer: Phase3[];
      consumerRows: number;
    }
  >;
};

// Every glyph fills its whole cell, so a run reads as a texture: the
// producer's two waits in two shades, the SoftMax steps from light to solid,
// P-convert in the checker.
const REGION_GLYPH: Record<string, string> = {
  wait_k_empty: "▓",
  wait_v_empty: "▒",
  s_rowmax: "░",
  s_scale: "▚",
  s_expsum: "█",
  f2fp: "▞",
};
const REGION_NAME: Record<string, string> = {
  wait_k_empty: "Wait K tile",
  wait_v_empty: "Wait V tile",
  s_rowmax: "RowMax",
  s_scale: "Scale",
  s_expsum: "ExpSum",
  f2fp: "P-convert",
};

function fa3Reach(): string {
  const W = 60;
  const MAX = 90;
  const rows = ARMS.map((a) => {
    const i = F3.reach[a];
    return {
      label: ARM_NAME[a],
      body: bar(((i ?? MAX) / MAX) * W, W),
      note: i == null ? "never" : `${i}`,
    };
  });
  return [
    `Iterations until TFLOPS first reaches ${Math.round(F3.sota)}. Lower is better.`,
    "",
    framed(
      rows,
      { cols: W, every: 10, value: (c) => String((c / W) * MAX) },
      17,
    ),
  ].join("\n");
}

function fa3Samples(): string {
  const at = Array.from({ length: 11 }, (_, k) => k * 10);
  const head = `${"iteration".padEnd(17)}${at.map((i) => String(i).padStart(7)).join("")}`;
  const rule = `${"─".repeat(17)}${"─".repeat(7 * at.length)}`;
  const rows = ARMS.map(
    (a) =>
      `${ARM_NAME[a].padEnd(17)}${at.map((i) => F3.curves[a][i].toFixed(1).padStart(7)).join("")}`,
  );
  return [head, rule, ...rows].join("\n");
}

function fa3Breakdown(): string {
  const NS = 25; // per character
  const COLS = 100; // 2,500 ns
  const out: string[] = [
    legend(REGION_GLYPH, REGION_NAME),
    "1 char = 25 ns. All three tools share this scale.",
    "",
  ];
  const rows: { label: string; body: string; note?: string }[] = [];
  const toSpans = (list: Phase3[]) =>
    list.map((iv) => ({ key: iv.region, start: iv.start, end: iv.end }));
  const dur = (list: Phase3[], keys: string[]) =>
    list
      .filter((iv) => keys.includes(iv.region))
      .map(
        (iv) => `${REGION_NAME[iv.region]} ${Math.round(iv.end - iv.start)} ns`,
      )
      .join(", ");
  (["xtrace", "neutrino", "iket"] as const).forEach((arm, k) => {
    const p = F3.panels[arm];
    if (k > 0) rows.push({ label: "", body: " ".repeat(COLS) });
    rows.push({
      label: `${ARM_NAME[arm]}`,
      body: " ".repeat(COLS),
    });
    rows.push({
      label: "  Producer",
      body: lane(toSpans(p.producer), REGION_GLYPH, COLS, NS),
      note: dur(p.producer, ["wait_k_empty", "wait_v_empty"]),
    });
    for (let r = 0; r < p.consumerRows; r++) {
      rows.push({
        label: "  Consumer",
        body: lane(
          toSpans(p.consumer.filter((iv) => iv.row === r)),
          REGION_GLYPH,
          COLS,
          NS,
        ),
      });
    }
  });
  out.push(
    framed(
      rows,
      {
        cols: COLS,
        every: 20,
        value: (c) => (c === COLS ? `${c * NS} ns` : String(c * NS)),
      },
      17,
    ),
  );
  return out.join("\n");
}

export function Fa3AgentCaseAscii() {
  return (
    <Fig caption="An agent optimizes FlashAttention-3 on H100. The four sessions differ only in the profile they read.">
      <Block title="Iterations until each session reaches the plateau">
        {fa3Reach()}
      </Block>
      <Block title="TFLOPS every 10 iterations">{fa3Samples()}</Block>
      <Block title="What each trace shows at iteration 1 (one producer wait window)">
        {fa3Breakdown()}
      </Block>
    </Fig>
  );
}

// ------------------------------------------------------------- FA-4 case

type Kernel = "cudnn" | "fa4" | "opt";
type Bar = [phase: string, row: number, start: number, end: number];

const F4 = fa4 as unknown as {
  xmaxUs: number;
  nbSm: number;
  roles: [string, number, number][];
  cols: Record<
    Kernel,
    {
      bars: Bar[];
      waves: number[];
      mapRuns: [number, number][][];
      mapRows: number;
      zoomRow: number;
      smid: number;
      lastTile: { start: number; storeNs: number; drainNs: number | null };
    }
  >;
  perf: Record<string, Record<Kernel, number>>;
};

const KERNEL_NAME: Record<Kernel, string> = {
  cudnn: "cuDNN SDPA",
  fa4: "FA-4",
  opt: "Optimized FA-4",
};
const KERNELS: Kernel[] = ["cudnn", "fa4", "opt"];

// The work tile is the light shade every phase sits on; each role's phase has
// its own denser shade or full-cell block pattern.
const PHASE_GLYPH: Record<string, string> = {
  load: "▓",
  mma: "▚",
  softmax: "█",
  rescale: "▒",
  store: "▞",
  drain: "▙",
  tile: "░",
};
const PHASE_NAME: Record<string, string> = {
  load: "Load K,V",
  mma: "MMA issue",
  softmax: "SoftMax",
  rescale: "Rescale",
  store: "Write out tile",
  drain: "Wait and release",
  tile: "Rest of work tile",
};

const US = 0.5; // per character
const TCOLS = Math.ceil(F4.xmaxUs / US);
const TAXIS = {
  cols: TCOLS,
  every: 10,
  value: (c: number) => (c === 100 ? "50 us" : String(c * US)),
};
const LABEL_W = 14;

function fa4Map(k: Kernel): string {
  const col = F4.cols[k];
  const BAND = 5; // bitmap rows per text row
  const zoomBand = Math.floor(((col.zoomRow / F4.nbSm) * col.mapRows) / BAND);
  const rows: { label: string; body: string; note?: string }[] = [];
  for (let r0 = 0, band = 0; r0 < col.mapRows; r0 += BAND, band++) {
    let body = "";
    for (let c = 0; c < TCOLS; c++) {
      const a = c * US;
      const b = a + US;
      let covered = 0;
      let n = 0;
      for (let r = r0; r < Math.min(r0 + BAND, col.mapRows); r++) {
        n++;
        for (const [s, e] of col.mapRuns[r])
          covered += Math.max(0, Math.min(b, e) - Math.max(a, s));
      }
      const f = covered / (n * US);
      body +=
        f >= 0.8 ? "█" : f >= 0.5 ? "▓" : f >= 0.2 ? "▒" : f > 0 ? "░" : " ";
    }
    rows.push({
      label: `${Math.round((r0 / col.mapRows) * F4.nbSm)}`.padStart(4),
      body,
      note: band === zoomBand ? `◀ traced SM (smid=${col.smid})` : undefined,
    });
  }
  return framed(rows, TAXIS, LABEL_W);
}

function fa4Trace(k: Kernel): string {
  const col = F4.cols[k];
  const rows: { label: string; body: string }[] = [];
  for (const [name, lo, hi] of F4.roles) {
    for (let r = lo; r < hi; r++) {
      const spans = col.bars
        .filter((b) => b[1] === r)
        .map(([key, , start, end]) => ({ key, start, end }));
      rows.push({
        label: r === lo ? name : "",
        body: lane(spans, PHASE_GLYPH, TCOLS, US, "tile"),
      });
    }
  }
  return framed(
    rows,
    TAXIS,
    LABEL_W,
    col.waves.length
      ? {
          glyph: "▼",
          at: col.waves.map((w) => Math.round(w / US)),
          label: "new CTA",
        }
      : undefined,
  );
}

function fa4LastTile(): string {
  const NS = 20; // per character
  return [
    `${PHASE_GLYPH.store}${PHASE_GLYPH.store} ${PHASE_NAME.store}   ${PHASE_GLYPH.drain}${PHASE_GLYPH.drain} ${PHASE_NAME.drain}   1 char = 20 ns`,
    "",
    ...KERNELS.map((k) => {
      const t = F4.cols[k].lastTile;
      const w = PHASE_GLYPH.store.repeat(Math.round(t.storeNs / NS));
      const d = t.drainNs
        ? PHASE_GLYPH.drain.repeat(Math.round(t.drainNs / NS))
        : "";
      const note = t.drainNs
        ? `${t.storeNs} ns + ${t.drainNs} ns`
        : `${t.storeNs} ns, no wait`;
      return `${KERNEL_NAME[k].padEnd(16)}${(w + d).padEnd(60)} ${note}`;
    }),
  ].join("\n");
}

function fa4Throughput(): string {
  const LO = 0.85;
  const HI = 1.1;
  const W = 50;
  const one = Math.round(((1 - LO) / (HI - LO)) * W);
  const out = [
    `Normalized to cuDNN. The axis starts at ${LO}. ┊ marks cuDNN = 1.000.`,
    "",
  ];
  for (const [shape, p] of Object.entries(F4.perf)) {
    out.push(shape);
    const line = (name: string, v: number, tflops: number, extra = "") => {
      const cells = [...bar(((v - LO) / (HI - LO)) * W, W)];
      if (cells[one] === " ") cells[one] = "┊";
      return `  ${name.padEnd(16)}${cells.join("")} ${v.toFixed(3)}  ${String(tflops).padStart(4)} TFLOPS${extra}`;
    };
    out.push(line("cuDNN", 1, p.cudnn));
    out.push(line("FA-4", p.fa4 / p.cudnn, p.fa4));
    out.push(
      line(
        "Optimized FA-4",
        p.opt / p.cudnn,
        p.opt,
        `  +${((p.opt / p.fa4 - 1) * 100).toFixed(1)}% over FA-4`,
      ),
    );
    out.push("");
  }
  return out.join("\n").trimEnd();
}

export function Fa4CudnnCaseAscii() {
  const key =
    legend(PHASE_GLYPH, PHASE_NAME) +
    "\n1 char = 0.5 us. One row per warp of the traced SM. ▼ = a new CTA starts.\n\n";
  return (
    <Fig caption="Traces of FlashAttention-4 and the closed-source cuDNN SDPA kernel on B300 (b8 h16 s1024). Recovered from the paper figure's vector data.">
      {KERNELS.map((k) => (
        <div key={k}>
          <Block
            title={`${KERNEL_NAME[k]}: whole kernel. One row per ~10 SMs, sorted by finish time. Darker = more CTA residency.`}
          >
            {fa4Map(k)}
          </Block>
          <Block
            title={`${KERNEL_NAME[k]}: per-SM trace of smid=${F4.cols[k].smid}`}
          >
            {key + fa4Trace(k)}
          </Block>
        </div>
      ))}
      <Block title="Epilogue of the last tile">{fa4LastTile()}</Block>
      <Block title="Throughput against cuDNN">{fa4Throughput()}</Block>
    </Fig>
  );
}

// ------------------------------------------------- where probes go in

const STACK = `GPU stack                where probes go in
┌─────────────┐
│ Source code │ ◀── Existing tools (source level)
└──────┬──────┘
       ▼
█ FE compiler █     sees the probes when they came from above
       ▼
┌─────────────┐
│     IR      │ ◀── Existing tools (IR level)
└──────┬──────┘
       ▼
█ BE compiler █     sees the probes when they came from above
       ▼
┌─────────────┐
│   Binary    │ ◀── Xtrace (after both compilers)
└──────┬──────┘
       ▼
   execution`;

/** Agent twin of InstrumentStack: the stack as text, then the sections. */
export function InstrumentStackAscii({ children }: { children: ReactNode }) {
  return (
    <>
      <Block title="Where each tracer inserts its probes">{STACK}</Block>
      {children}
    </>
  );
}

// ------------------------------------------------- an Open Traces trace

const INNER = ["█", "▓", "▒", "▚", "▞", "▙"];
/** Scopes that frame a stretch of work rather than name a phase of it. */
const FRAME = /\.(prologue|tile)$/;

type RawTrace = {
  span: number;
  scopes: { id: number; label: string; role?: string }[];
  lanes: { block: number }[];
  intervals: [number, number, number, number][];
};

/**
 * Agent twin of OpenTrace: the trace file read at build time, CTA 0 drawn as
 * one text timeline per warp role (the busiest warp of each role).
 */
export function OpenTraceAscii({
  trace,
  caption,
  phases,
}: {
  trace: string;
  caption: string;
  blocks?: number;
  phases?: string;
}) {
  const d = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public", trace), "utf8"),
  ) as RawTrace;
  const scope = new Map(d.scopes.map((sc) => [sc.id, sc]));
  // the same phases the web embed shows, or every scope when none are named
  const wanted = phaseList(phases);
  const shown = new Set(
    d.scopes
      .filter((sc) => !wanted || wanted.includes(sc.label))
      .map((sc) => sc.id),
  );
  const ivs = d.intervals.filter(
    ([lane, sid]) => d.lanes[lane]?.block === 0 && shown.has(sid),
  );
  const t0 = Math.min(...ivs.map((iv) => iv[2]));
  const t1 = Math.max(...ivs.map((iv) => iv[2] + iv[3]));
  const COLS = 100;
  const step = (t1 - t0) / COLS;

  // roles in the order the kernel's work flows through them
  const ORDER = [
    "Producer",
    "MMA",
    "Softmax-A",
    "Softmax-B",
    "Correction",
    "Epilogue",
  ];
  const rank = (role: string) => {
    const k = ORDER.findIndex((o) => role.startsWith(o));
    return k < 0 ? ORDER.length : k;
  };
  const roles = [...new Set(d.scopes.map((sc) => sc.role ?? "Warp"))].sort(
    (a, b) => rank(a) - rank(b),
  );

  const rows: { label: string; body: string; note?: string }[] = [];
  for (const role of roles) {
    const mine = ivs.filter(
      ([, sid]) => (scope.get(sid)?.role ?? "Warp") === role,
    );
    if (!mine.length) continue;
    const perLane = new Map<number, number>();
    for (const [lane] of mine) perLane.set(lane, (perLane.get(lane) ?? 0) + 1);
    const busiest = [...perLane.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const own = mine.filter(([l]) => l === busiest);
    const framing = (sid: number) =>
      !wanted && FRAME.test(scope.get(sid)!.label);
    const inner = [...new Set(own.map(([, sid]) => sid))]
      .filter((sid) => !framing(sid))
      .sort((a, b) => a - b);
    const glyph: Record<string, string> = { frame: "░" };
    inner.forEach((sid, i) => (glyph[String(sid)] = INNER[i] ?? "█"));
    const spans = own.map(([, sid, start, dur]) => ({
      key: framing(sid) ? "frame" : String(sid),
      start: start - t0,
      end: start - t0 + dur,
    }));
    rows.push({
      label: role.replace(/ Warp$/, ""),
      body: lane(spans, glyph, COLS, step),
      note: inner
        .map((sid) => `${glyph[String(sid)]} ${scope.get(sid)!.label}`)
        .join("  "),
    });
  }

  const { title, subtitle } = traceTitle(trace);
  const us = (t1 - t0) / 1000;
  const text = [
    `${title}. ${subtitle}`,
    `CTA 0, the busiest warp of each role. 1 char = ${Math.round(step)} ns.${wanted ? ` Phases shown: ${wanted.length} of ${d.scopes.length}.` : " ░ = rest of the work tile."}`,
    "",
    framed(
      rows,
      {
        cols: COLS,
        every: 20,
        value: (c) =>
          c === COLS ? `${us.toFixed(1)} us` : ((c / COLS) * us).toFixed(1),
      },
      12,
    ),
  ].join("\n");
  return (
    <Fig caption={caption}>
      <Block title="What a timeline looks like">{text}</Block>
    </Fig>
  );
}
