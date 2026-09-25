"use client";

// User-owned: the interactive figures of the Xtrace release post
// (content/en/blog/releasing-xtrace.mdx), registered in lib/mdx-components.tsx.
//
// The data is exported from the paper's own figures:
//   xtrace-fa3.json  tools/blog_xtrace_fa3.py, from figs/agent_case/plot.py
//   xtrace-fa4.json  tools/blog_xtrace_fa4.py, read off figs/case_fa4 (PDF)
// Charts are plain SVG in a fixed viewBox; one pointer handler per chart does
// hit testing, so the marks themselves carry no listeners.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import fa3 from "./xtrace-fa3.json";
import fa4 from "./xtrace-fa4.json";

// ------------------------------------------------------------------ shared

const INK = "#0f1113";
const INK_SOFT = "#3f464d";
const MUTED = "#6b7278";
const LINE = "#e4e6e9";
const GRID = "#f0f1f3";

/** Client coordinates to the SVG's own viewBox coordinates. */
function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

interface Tip {
  x: number;
  y: number;
  /** The chart box's size, so the tooltip can stay inside it. */
  w: number;
  h: number;
  body: ReactNode;
}

/** A tooltip pinned to the pointer, kept inside its chart's box. */
function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const left = tip.x + 222 > tip.w ? Math.max(tip.x - 214, 4) : tip.x + 14;
  // near the bottom the tooltip opens upward, so it never spills out of the box
  const top =
    tip.y + 130 > tip.h ? Math.max(tip.y - 130, 4) : Math.max(tip.y - 12, 4);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-[200px] rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs leading-relaxed text-ink-soft shadow-paper backdrop-blur"
      style={{ left, top }}
    >
      {tip.body}
    </div>
  );
}

function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <svg width="18" height="8" aria-hidden className="flex-none">
      <line
        x1="0"
        y1="4"
        x2="18"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="4 3"
      />
    </svg>
  ) : (
    <span
      aria-hidden
      className="h-2.5 w-2.5 flex-none rounded-[3px]"
      style={{ background: color }}
    />
  );
}

function fmtNs(ns: number) {
  return ns >= 1000 ? `${(ns / 1000).toFixed(2)} µs` : `${Math.round(ns)} ns`;
}

function Figure({
  children,
  caption,
}: {
  children: ReactNode;
  caption: ReactNode;
}) {
  return (
    <figure className="not-prose my-10">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-paper sm:p-6">
        {children}
      </div>
      <figcaption className="mt-3 text-center text-sm leading-relaxed text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

/** Wide SVGs scroll inside their card on phones instead of shrinking to nothing. */
function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[620px]">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------- FA-3 case

type Arm = "xtrace" | "neutrino" | "iket" | "none";

// The two existing tools stay unnamed on the site.
const ARM: Record<
  Arm,
  { label: string; short: string; color: string; dashed?: boolean }
> = {
  xtrace: { label: "Xtrace", short: "Xtrace", color: INK },
  neutrino: {
    label: "Existing tool A",
    short: "Existing tool A",
    color: "#5b8fc9",
  },
  iket: {
    label: "Existing tool B",
    short: "Existing tool B",
    color: "#c77d3a",
  },
  none: {
    label: "Counters only",
    short: "Counters only",
    color: "#9aa0a6",
    dashed: true,
  },
};
const CURVE_ORDER: Arm[] = ["xtrace", "neutrino", "iket", "none"];
// Drawn back to front, so the Xtrace curve sits on top.
const DRAW_ORDER: Arm[] = ["none", "iket", "neutrino", "xtrace"];
const PANEL_ORDER: Arm[] = ["xtrace", "neutrino", "iket"];

const REGION: Record<string, { label: string; color: string }> = {
  wait_k_empty: { label: "Wait for K tile", color: "#5a8fd0" },
  wait_v_empty: { label: "Wait for V tile", color: "#c99a2e" },
  s_rowmax: { label: "RowMax (SoftMax)", color: "#a9bccb" },
  s_scale: { label: "Scale (SoftMax)", color: "#6f8aa1" },
  s_expsum: { label: "ExpSum (SoftMax)", color: "#3d5a70" },
  f2fp: { label: "P-convert", color: "#8a4a84" },
};

interface Phase {
  region: string;
  start: number;
  end: number;
  row: number;
}
interface Panel {
  span: number;
  producer: Phase[];
  consumer: Phase[];
  consumerRows: number;
}

const F3 = fa3 as unknown as {
  sota: number;
  curves: Record<Arm, number[]>;
  reach: Record<Arm, number | null>;
  panels: Record<Exclude<Arm, "none">, Panel>;
};

export function Fa3AgentCase() {
  const [focus, setFocus] = useState<Arm | null>(null);
  const [hidden, setHidden] = useState<Set<Arm>>(new Set());

  return (
    <Figure
      caption={
        <>
          An agent optimizes FlashAttention-3 on H100. The four sessions differ
          only in the profile they read. Hover to read values. Click a legend
          entry to hide its curve.
        </>
      }
    >
      <div
        className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2"
        role="group"
        aria-label="Sessions"
      >
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Profile the agent reads
        </span>
        {CURVE_ORDER.map((arm) => {
          const off = hidden.has(arm);
          return (
            <button
              key={arm}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(arm)) next.delete(arm);
                  else next.add(arm);
                  return next;
                })
              }
              onPointerEnter={() => setFocus(arm)}
              onPointerLeave={() => setFocus(null)}
              className={`flex items-center gap-2 text-sm transition-opacity ${
                off ? "opacity-35" : ""
              } ${arm === "xtrace" ? "font-bold text-ink" : "text-ink-soft"}`}
            >
              <Swatch color={ARM[arm].color} dashed={ARM[arm].dashed} />
              {ARM[arm].label}
            </button>
          );
        })}
      </div>
      <Scroll>
        <Fa3Curves focus={focus} hidden={hidden} />
      </Scroll>
      <div className="mt-8 border-t border-line pt-6">
        <p className="mb-1 text-sm font-bold text-ink">
          What each trace shows at iteration 1
        </p>
        <p className="mb-4 text-sm text-muted">
          One wait of the producer warp, with the consumer work it waits on. All
          three rows share one time scale.
        </p>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(REGION).map(([k, r]) => (
            <span
              key={k}
              className="flex items-center gap-1.5 text-xs text-ink-soft"
            >
              <Swatch color={r.color} />
              {r.label}
            </span>
          ))}
        </div>
        <Scroll>
          <Fa3Breakdown focus={focus} onFocus={setFocus} />
        </Scroll>
      </div>
    </Figure>
  );
}

const C = { w: 880, h: 300, l: 50, r: 18, t: 34, b: 34 };
const ITER = 100;
const Y_LO = 530;
const Y_HI = 580;

function Fa3Curves({ focus, hidden }: { focus: Arm | null; hidden: Set<Arm> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const pw = C.w - C.l - C.r;
  const ph = C.h - C.t - C.b;
  const x = (i: number) => C.l + (i / ITER) * pw;
  const y = (v: number) => C.t + (1 - (v - Y_LO) / (Y_HI - Y_LO)) * ph;

  const paths = useMemo(() => {
    const out = {} as Record<Arm, string>;
    for (const arm of CURVE_ORDER) {
      out[arm] = F3.curves[arm]
        .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join("");
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const p = svgPoint(svg, e);
    const i = Math.round(((p.x - C.l) / pw) * ITER);
    if (i < 0 || i > ITER) {
      setHover(null);
      setTip(null);
      return;
    }
    setHover(i);
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      w: box.width,
      h: box.height,
      body: (
        <>
          <p className="mb-1 font-bold text-ink">Iteration {i}</p>
          {CURVE_ORDER.filter((a) => !hidden.has(a)).map((a) => (
            <p key={a} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <Swatch color={ARM[a].color} dashed={ARM[a].dashed} />
                {ARM[a].short}
              </span>
              <span className="tabular-nums text-ink">
                {F3.curves[a][i].toFixed(1)}
              </span>
            </p>
          ))}
        </>
      ),
    });
  };

  const dim = (arm: Arm) => (focus && focus !== arm ? 0.18 : 1);

  return (
    <div ref={boxRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${C.w} ${C.h}`}
        className="block w-full touch-none select-none"
        role="img"
        aria-label="TFLOPS over 100 agent iterations for four sessions"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        {/* grid and axes */}
        {[540, 550, 560, 570, 580].map((v) => (
          <g key={v}>
            <line x1={C.l} x2={C.w - C.r} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text
              x={C.l - 8}
              y={y(v)}
              dy="0.32em"
              textAnchor="end"
              fontSize="11"
              fill={MUTED}
            >
              {v}
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80, 100].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={C.h - C.b + 18}
            textAnchor="middle"
            fontSize="11"
            fill={MUTED}
          >
            {i}
          </text>
        ))}
        <text
          x={C.l - 8}
          y={C.t - 14}
          textAnchor="end"
          fontSize="11"
          fill={MUTED}
        >
          TFLOPS
        </text>
        <text
          x={C.w - C.r}
          y={C.h - 2}
          textAnchor="end"
          fontSize="11"
          fill={MUTED}
        >
          Iteration
        </text>
        <line
          x1={C.l}
          x2={C.w - C.r}
          y1={C.h - C.b}
          y2={C.h - C.b}
          stroke={LINE}
        />

        {/* the plateau every session ends on */}
        <line
          x1={C.l}
          x2={C.w - C.r}
          y1={y(F3.sota)}
          y2={y(F3.sota)}
          stroke={INK_SOFT}
          strokeDasharray="6 4"
          strokeWidth="1"
        />
        <text x={C.l + 6} y={y(F3.sota) - 6} fontSize="11" fill={INK_SOFT}>
          Target: {Math.round(F3.sota)} TFLOPS
        </text>

        {/* when each session first reaches it */}
        {CURVE_ORDER.map((arm) => {
          const i = F3.reach[arm];
          if (i == null || hidden.has(arm)) return null;
          return (
            <g
              key={arm}
              opacity={dim(arm)}
              className="transition-opacity duration-200"
            >
              <line
                x1={x(i)}
                x2={x(i)}
                y1={C.t - 4}
                y2={C.h - C.b}
                stroke={ARM[arm].color}
                strokeDasharray="3 3"
                strokeWidth="1.25"
                opacity="0.8"
              />
              <circle cx={x(i)} cy={C.t - 12} r="3.5" fill={ARM[arm].color} />
              <text
                x={x(i) + 7}
                y={C.t - 12}
                dy="0.32em"
                fontSize="11"
                fontWeight={arm === "xtrace" ? 700 : 400}
                fill={INK}
              >
                {i}
              </text>
            </g>
          );
        })}

        {DRAW_ORDER.map((arm) =>
          hidden.has(arm) ? null : (
            <path
              key={arm}
              d={paths[arm]}
              fill="none"
              stroke={ARM[arm].color}
              strokeWidth={arm === "xtrace" ? 2.25 : 1.5}
              strokeDasharray={ARM[arm].dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              opacity={dim(arm)}
              className="transition-opacity duration-200"
            />
          ),
        )}

        {hover != null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={C.t}
              y2={C.h - C.b}
              stroke={INK}
              strokeOpacity="0.25"
            />
            {DRAW_ORDER.filter((a) => !hidden.has(a)).map((a) => (
              <circle
                key={a}
                cx={x(hover)}
                cy={y(F3.curves[a][hover])}
                r="4"
                fill={ARM[a].color}
                stroke="#fff"
                strokeWidth="2"
              />
            ))}
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

const B = { w: 880, gutter: 150, lane: 22, gap: 6, panel: 96, r: 18 };
const B_NS = 2500;

function Fa3Breakdown({
  focus,
  onFocus,
}: {
  focus: Arm | null;
  onFocus: (a: Arm | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  const pw = B.w - B.gutter - B.r;
  const x = (ns: number) => B.gutter + (ns / B_NS) * pw;
  const h = PANEL_ORDER.length * B.panel + 26;
  // lane tops inside one panel: durations above the producer, below the consumer
  const PY = 20;
  const CY = PY + B.lane + B.gap + 8;

  const rects = PANEL_ORDER.flatMap((arm, pi) => {
    const p = F3.panels[arm as Exclude<Arm, "none">];
    const top = pi * B.panel;
    const lane = (list: Phase[], y0: number, nrow: number, kind: string) =>
      list.map((iv, k) => {
        const rh = (B.lane - (nrow - 1) * 2) / nrow;
        return {
          id: `${arm}-${kind}-${k}`,
          arm,
          iv,
          kind,
          x0: x(iv.start),
          x1: x(iv.end),
          y0: top + y0 + iv.row * (rh + 2),
          rh,
        };
      });
    return [
      ...lane(p.producer, PY, 1, "Producer"),
      ...lane(p.consumer, CY, p.consumerRows, "Consumer"),
    ];
  });

  const onMove = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const p = svgPoint(svg, e);
    const pi = Math.floor(p.y / B.panel);
    const arm = PANEL_ORDER[pi];
    onFocus(arm ?? null);
    const hit = rects.find(
      (r) =>
        p.x >= r.x0 - 1 &&
        p.x <= r.x1 + 1 &&
        p.y >= r.y0 - 2 &&
        p.y <= r.y0 + r.rh + 2,
    );
    setHot(hit?.id ?? null);
    setTip(
      hit
        ? {
            x: e.clientX - box.left,
            y: e.clientY - box.top,
            w: box.width,
            h: box.height,
            body: (
              <>
                <p className="mb-1 flex items-center gap-1.5 font-bold text-ink">
                  <Swatch color={REGION[hit.iv.region].color} />
                  {REGION[hit.iv.region].label}
                </p>
                <p>
                  {ARM[hit.arm].short}, {hit.kind.toLowerCase()} warp
                </p>
                <p>
                  Duration{" "}
                  <span className="font-bold tabular-nums text-ink">
                    {fmtNs(hit.iv.end - hit.iv.start)}
                  </span>
                </p>
                <p className="tabular-nums">
                  {Math.round(hit.iv.start)}–{Math.round(hit.iv.end)} ns into
                  the window
                </p>
              </>
            ),
          }
        : null,
    );
  };

  return (
    <div ref={boxRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${B.w} ${h}`}
        className="block w-full touch-none select-none"
        role="img"
        aria-label="Producer and consumer phases reported by each trace"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setTip(null);
          setHot(null);
          onFocus(null);
        }}
      >
        {PANEL_ORDER.map((arm, pi) => {
          const top = pi * B.panel;
          const faded = focus && focus !== arm && focus !== "none";
          return (
            <g
              key={arm}
              opacity={faded ? 0.35 : 1}
              className="transition-opacity duration-200"
            >
              {pi > 0 && (
                <line x1="0" x2={B.w} y1={top} y2={top} stroke={LINE} />
              )}
              <text
                x="0"
                y={top + B.panel / 2}
                dy="0.32em"
                fontSize="13"
                fontWeight={arm === "xtrace" ? 700 : 400}
                fill={INK}
              >
                {ARM[arm].short}
              </text>
              <text
                x={B.gutter - 10}
                y={top + PY + B.lane / 2}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill={MUTED}
              >
                Producer
              </text>
              <text
                x={B.gutter - 10}
                y={top + CY + B.lane / 2}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill={MUTED}
              >
                Consumer
              </text>
              {[PY, CY].map((ly) => (
                <line
                  key={ly}
                  x1={B.gutter}
                  x2={B.w - B.r}
                  y1={top + ly + B.lane / 2}
                  y2={top + ly + B.lane / 2}
                  stroke={GRID}
                  strokeWidth="1"
                />
              ))}
            </g>
          );
        })}
        {rects.map((r) => {
          const faded = focus && focus !== r.arm && focus !== "none";
          const wide = r.kind === "Producer" && r.iv.end - r.iv.start >= 240;
          const producer = r.kind === "Producer";
          return (
            <g
              key={r.id}
              opacity={faded ? 0.35 : 1}
              className="transition-opacity duration-200"
            >
              <rect
                x={r.x0}
                y={r.y0}
                width={Math.max(r.x1 - r.x0, 1.5)}
                height={r.rh}
                rx="3"
                fill={REGION[r.iv.region].color}
                stroke={hot === r.id ? INK : "#fff"}
                strokeWidth={hot === r.id ? 1.5 : 1}
              />
              {wide && (
                <text
                  x={(r.x0 + r.x1) / 2}
                  y={producer ? r.y0 - 6 : r.y0 + r.rh + 12}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={INK_SOFT}
                  className="tabular-nums"
                >
                  {Math.round(r.iv.end - r.iv.start)} ns
                </text>
              )}
            </g>
          );
        })}
        {[0, 500, 1000, 1500, 2000, 2500].map((ns) => (
          <text
            key={ns}
            x={x(ns)}
            y={h - 4}
            textAnchor={ns === 0 ? "start" : ns === B_NS ? "end" : "middle"}
            fontSize="11"
            fill={MUTED}
          >
            {ns === B_NS ? "2500 ns" : ns}
          </text>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ------------------------------------------------------------- FA-4 case

type Kernel = "cudnn" | "fa4" | "opt";
type Bar = [phase: string, row: number, start: number, end: number];

interface Column {
  bars: Bar[];
  waves: number[];
  mapRuns: [number, number][][];
  mapRows: number;
  zoomRow: number;
  smid: number;
  lastTile: { start: number; storeNs: number; drainNs: number | null };
}

const F4 = fa4 as unknown as {
  xmaxUs: number;
  nbSm: number;
  roles: [string, number, number][];
  cols: Record<Kernel, Column>;
  perf: Record<string, Record<Kernel, number>>;
};

const KERNEL: Record<Kernel, { label: string; note: string }> = {
  cudnn: {
    label: "cuDNN SDPA",
    note: "Closed source. One CTA stays on each SM for the whole kernel.",
  },
  fa4: {
    label: "FA-4",
    note: "One CTA per work tile. This SM runs four CTAs in four waves.",
  },
  opt: {
    label: "Optimized FA-4",
    note: "After the agent's changes. One persistent CTA per SM, like cuDNN.",
  },
};
const KERNELS: Kernel[] = ["cudnn", "fa4", "opt"];

const PHASE: Record<string, { label: string; color: string }> = {
  load: { label: "Load K, V", color: "#5a8fd0" },
  mma: { label: "MMA issue", color: "#8a4a84" },
  softmax: { label: "SoftMax", color: "#1f8a6f" },
  rescale: { label: "Rescale", color: "#c99a2e" },
  store: { label: "Write out tile", color: "#d9789a" },
  drain: { label: "Wait and release", color: "#9c3a2c" },
  tile: { label: "Rest of the work tile", color: "#e6e8eb" },
};
const PHASE_KEYS = [
  "load",
  "mma",
  "softmax",
  "rescale",
  "store",
  "drain",
  "tile",
];
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];

const T = {
  w: 880,
  gutter: 92,
  r: 14,
  mapTop: 22,
  mapH: 96,
  gapH: 44,
  row: 15,
  rowGap: 3,
  axis: 26,
};
const NROW = 15;

export function Fa4CudnnCase() {
  const [kernel, setKernel] = useState<Kernel>("fa4");
  const [phase, setPhase] = useState<string | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  return (
    <Figure
      caption={
        <>
          Traces of FlashAttention-4 and the closed-source cuDNN SDPA kernel on
          B300 (b8 h16 s1024). Switch kernels on top. Drag across the per-SM
          trace to zoom in.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-full border border-line bg-paper-deep p-1"
          role="tablist"
        >
          {KERNELS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kernel === k}
              onClick={() => setKernel(k)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                kernel === k
                  ? "bg-ink font-bold text-paper shadow-paper"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {KERNEL[k].label}
            </button>
          ))}
        </div>
        {zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:border-ink hover:text-ink"
          >
            Reset zoom
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-soft">{KERNEL[kernel].note}</p>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {PHASE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onPointerEnter={() => setPhase(k)}
            onPointerLeave={() => setPhase(null)}
            onFocus={() => setPhase(k)}
            onBlur={() => setPhase(null)}
            className="flex items-center gap-1.5 text-xs text-ink-soft"
          >
            <Swatch color={PHASE[k].color} />
            {PHASE[k].label}
          </button>
        ))}
      </div>
      <Scroll>
        <Fa4Trace kernel={kernel} phase={phase} zoom={zoom} onZoom={setZoom} />
      </Scroll>
      <div className="mt-6 grid gap-6 border-t border-line pt-6 lg:grid-cols-2">
        <LastTile kernel={kernel} />
        <Throughput />
      </div>
    </Figure>
  );
}

function Fa4Trace({
  kernel,
  phase,
  zoom,
  onZoom,
}: {
  kernel: Kernel;
  phase: string | null;
  zoom: [number, number] | null;
  onZoom: (z: [number, number] | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  // the drag lives in a ref too, so a move that lands before the next render
  // still sees where the drag began
  const dragRef = useRef<[number, number] | null>(null);
  const setDragBoth = (d: [number, number] | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const col = F4.cols[kernel];
  const [d0, d1] = zoom ?? [0, F4.xmaxUs];
  const pw = T.w - T.gutter - T.r;
  const x = (us: number) => T.gutter + ((us - d0) / (d1 - d0)) * pw;
  const xFull = (us: number) => T.gutter + (us / F4.xmaxUs) * pw;
  const t = (px: number) => d0 + ((px - T.gutter) / pw) * (d1 - d0);

  const traceTop = T.mapTop + T.mapH + T.gapH;
  const rowY = (r: number) => traceTop + r * (T.row + T.rowGap);
  const traceH = NROW * (T.row + T.rowGap) - T.rowGap;
  const h = traceTop + traceH + T.axis;
  const mapRowH = T.mapH / col.mapRows;

  // underlays first, so the phases they enclose draw on top of them
  const bars = useMemo(
    () =>
      col.bars
        .map((b, i) => ({ b, i }))
        .sort(
          (a, c) => (a.b[0] === "tile" ? 0 : 1) - (c.b[0] === "tile" ? 0 : 1),
        ),
    [col],
  );

  const ticks = useMemo(() => {
    const span = d1 - d0;
    const step = [0.25, 0.5, 1, 2, 5, 10].find((s) => span / s <= 8) ?? 10;
    const out: number[] = [];
    for (let v = Math.ceil(d0 / step) * step; v <= d1 + 1e-9; v += step)
      out.push(+v.toFixed(3));
    return out.filter((v) => v < d1 - span * 0.04);
  }, [d0, d1]);

  const onDown = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const p = svgPoint(svg, e);
    if (p.y < traceTop - 4 || p.x < T.gutter) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // no active pointer to capture (synthetic events); the drag still works
    }
    setDragBoth([p.x, p.x]);
  };

  const onMove = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const p = svgPoint(svg, e);
    const d = dragRef.current;
    if (d) {
      setDragBoth([d[0], Math.min(Math.max(p.x, T.gutter), T.w - T.r)]);
      setTip(null);
      return;
    }
    const row = Math.floor((p.y - traceTop) / (T.row + T.rowGap));
    if (row < 0 || row >= NROW || p.x < T.gutter) {
      setTip(null);
      setHot(null);
      return;
    }
    const at = t(p.x);
    const tol = (2 / pw) * (d1 - d0);
    const hits = col.bars
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b[1] === row && b[2] - tol <= at && at <= b[3] + tol);
    const hit = hits.find(({ b }) => b[0] !== "tile") ?? hits[0];
    setHot(hit?.i ?? null);
    const role =
      F4.roles.find(([, lo, hi]) => row >= lo && row < hi)?.[0] ?? "";
    setTip(
      hit
        ? {
            x: e.clientX - box.left,
            y: e.clientY - box.top,
            w: box.width,
            h: box.height,
            body: (
              <>
                <p className="mb-1 flex items-center gap-1.5 font-bold text-ink">
                  <Swatch color={PHASE[hit.b[0]].color} />
                  {PHASE[hit.b[0]].label}
                </p>
                <p>
                  {KERNEL[kernel].label}, {role} warp
                </p>
                <p>
                  Duration{" "}
                  <span className="font-bold tabular-nums text-ink">
                    ≈ {fmtNs((hit.b[3] - hit.b[2]) * 1000)}
                  </span>
                </p>
                <p className="tabular-nums">
                  {hit.b[2].toFixed(2)}–{hit.b[3].toFixed(2)} µs
                </p>
              </>
            ),
          }
        : null,
    );
  };

  const onUp = () => {
    const d = dragRef.current;
    if (d) {
      const [a, b] = [Math.min(...d), Math.max(...d)];
      if (b - a > 8) onZoom([Math.max(t(a), 0), Math.min(t(b), F4.xmaxUs)]);
      setDragBoth(null);
    }
  };

  const edges = [0, ...col.waves, Math.max(...col.bars.map((b) => b[3]))];
  const last = col.lastTile;
  const lastEnd = last.start + (last.storeNs + (last.drainNs ?? 0)) / 1000;

  return (
    <div ref={boxRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${T.w} ${h}`}
        className="block w-full cursor-crosshair touch-none select-none"
        role="img"
        aria-label={`Whole-kernel placement and one SM's warp trace for ${KERNEL[kernel].label}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => {
          setTip(null);
          setHot(null);
        }}
        onDoubleClick={() => onZoom(null)}
      >
        <defs>
          <clipPath id="fa4-plot">
            <rect x={T.gutter} y="0" width={pw} height={h} />
          </clipPath>
        </defs>

        {/* whole kernel: every CTA on the SM it ran on */}
        <text x="0" y="12" fontSize="12" fontWeight="700" fill={INK}>
          Whole kernel
        </text>
        <text x={T.gutter} y="12" fontSize="11" fill={MUTED}>
          Each row is an SM. A shaded run is a CTA resident on it.
        </text>
        <rect
          x={T.gutter}
          y={T.mapTop}
          width={pw}
          height={T.mapH}
          fill="#fbfbfc"
          stroke={LINE}
        />
        <g key={`map-${kernel}`} className="animate-[fadeIn_.35s_ease]">
          {col.mapRuns.map((runs, r) =>
            runs.map(([a, b], k) => (
              <rect
                key={`${r}-${k}`}
                x={xFull(a)}
                y={T.mapTop + r * mapRowH}
                width={Math.max(xFull(b) - xFull(a), 0.5)}
                height={mapRowH + 0.3}
                fill="#c3cfdb"
              />
            )),
          )}
          <rect
            x={T.gutter}
            y={T.mapTop + (col.zoomRow / F4.nbSm) * T.mapH - 1}
            width={pw}
            height="2.5"
            fill={INK}
          />
          <text
            x={T.gutter + 4}
            y={T.mapTop + (col.zoomRow / F4.nbSm) * T.mapH - 5}
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill={INK}
          >
            smid={col.smid}
          </text>
        </g>
        {zoom && (
          <rect
            x={xFull(d0)}
            y={T.mapTop}
            width={xFull(d1) - xFull(d0)}
            height={T.mapH}
            fill={INK}
            fillOpacity="0.08"
            stroke={INK}
            strokeWidth="1"
          />
        )}
        {[0, 40, 80, 120].map((sm) => (
          <text
            key={sm}
            x={T.gutter - 8}
            y={T.mapTop + ((sm + 0.5) / F4.nbSm) * T.mapH}
            dy="0.32em"
            textAnchor="end"
            fontSize="10.5"
            fill={MUTED}
          >
            {sm}
          </text>
        ))}
        <text
          x="0"
          y={T.mapTop + T.mapH / 2}
          dy="0.32em"
          fontSize="11"
          fill={MUTED}
        >
          SM
        </text>

        {/* per-SM trace of the marked SM */}
        <text x="0" y={traceTop - 24} fontSize="12" fontWeight="700" fill={INK}>
          Per-SM trace
        </text>
        <text x={T.gutter} y={traceTop - 24} fontSize="11" fill={MUTED}>
          Every warp of smid={col.smid}. Dashed rules mark where a new CTA
          starts.
        </text>
        {col.waves.length > 0 && (
          <g clipPath="url(#fa4-plot)">
            {edges.slice(0, -1).map((e0, k) => (
              <text
                key={k}
                x={(x(e0) + x(edges[k + 1])) / 2}
                y={traceTop - 7}
                textAnchor="middle"
                fontSize="10.5"
                fill={INK_SOFT}
              >
                {ORDINAL[k]} wave
              </text>
            ))}
          </g>
        )}
        {F4.roles.map(([name, lo, hi], k) => (
          <g key={name}>
            <text
              x={T.gutter - 8}
              y={(rowY(lo) + rowY(hi) - T.rowGap) / 2}
              dy="0.32em"
              textAnchor="end"
              fontSize="11"
              fill={INK_SOFT}
            >
              {name}
            </text>
            {k > 0 && (
              <line
                x1="0"
                x2={T.w - T.r}
                y1={rowY(lo) - T.rowGap / 2}
                y2={rowY(lo) - T.rowGap / 2}
                stroke={LINE}
              />
            )}
          </g>
        ))}
        <g
          key={`trace-${kernel}`}
          clipPath="url(#fa4-plot)"
          className="animate-[fadeIn_.35s_ease]"
        >
          {bars.map(({ b, i }) => {
            const [ph, row, s, e] = b;
            const faded = phase && ph !== phase;
            return (
              <rect
                key={i}
                x={x(s)}
                y={rowY(row) + (ph === "tile" ? 0 : 1)}
                width={Math.max(x(e) - x(s), ph === "tile" ? 0.5 : 1.2)}
                height={ph === "tile" ? T.row : T.row - 2}
                rx={ph === "tile" ? 2 : 1.5}
                fill={PHASE[ph].color}
                stroke={hot === i ? INK : "none"}
                strokeWidth="1.5"
                opacity={faded ? (ph === "tile" ? 0.5 : 0.15) : 1}
                className="transition-opacity duration-200"
              />
            );
          })}
          {col.waves.map((w) => (
            <line
              key={w}
              x1={x(w)}
              x2={x(w)}
              y1={traceTop - 18}
              y2={traceTop + traceH}
              stroke={INK}
              strokeDasharray="4 3"
            />
          ))}
          {/* the last tile's epilogue, the subject of the fourth change */}
          <rect
            x={x(last.start) - 2}
            y={rowY(NROW - 1) - 2}
            width={x(lastEnd) - x(last.start) + 4}
            height={T.row + 4}
            rx="3"
            fill="none"
            stroke={INK}
            strokeWidth="1.25"
          />
        </g>
        {drag && (
          <rect
            x={Math.min(...drag)}
            y={traceTop}
            width={Math.abs(drag[1] - drag[0])}
            height={traceH}
            fill={INK}
            fillOpacity="0.08"
            stroke={INK}
            strokeDasharray="3 2"
          />
        )}
        {ticks.map((v) => (
          <text
            key={v}
            x={x(v)}
            y={h - 6}
            textAnchor="middle"
            fontSize="10.5"
            fill={MUTED}
          >
            {v}
          </text>
        ))}
        <text
          x={T.w - T.r}
          y={h - 6}
          textAnchor="end"
          fontSize="10.5"
          fill={MUTED}
        >
          µs
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** The last tile's epilogue on the traced SM, one bar per kernel on one scale. */
function LastTile({ kernel }: { kernel: Kernel }) {
  const max = Math.max(
    ...KERNELS.map(
      (k) => F4.cols[k].lastTile.storeNs + (F4.cols[k].lastTile.drainNs ?? 0),
    ),
  );
  const pct = (ns: number) => `${(ns / (max * 1.08)) * 100}%`;
  return (
    <div>
      <p className="text-sm font-bold text-ink">Epilogue of the last tile</p>
      <p className="mb-4 text-sm text-muted">
        After writing out a tile, the epilogue waits and then releases the
        buffer. No tile follows the last one, so its wait buys nothing.
      </p>
      <div className="space-y-3">
        {KERNELS.map((k) => {
          const lt = F4.cols[k].lastTile;
          const on = k === kernel;
          return (
            <div
              key={k}
              className={`transition-opacity ${on ? "" : "opacity-55"}`}
            >
              <p
                className={`mb-1 text-xs ${on ? "font-bold text-ink" : "text-ink-soft"}`}
              >
                {KERNEL[k].label}
              </p>
              <div className="flex h-6 items-stretch gap-[2px]">
                <div
                  className="flex items-center justify-center rounded-l-[4px] text-[11px] font-bold tabular-nums text-ink"
                  style={{
                    width: pct(lt.storeNs),
                    background: PHASE.store.color,
                  }}
                  title="Write out tile"
                >
                  {lt.storeNs} ns
                </div>
                {lt.drainNs != null ? (
                  <div
                    className="flex items-center justify-center rounded-r-[4px] text-[11px] font-bold tabular-nums text-white"
                    style={{
                      width: pct(lt.drainNs),
                      background: PHASE.drain.color,
                    }}
                    title="Wait and release"
                  >
                    {lt.drainNs} ns
                  </div>
                ) : (
                  <span className="flex items-center pl-2 text-[11px] text-muted">
                    no wait
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Throughput of FA-4 before and after, normalized to cuDNN at each shape. */
function Throughput() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const shapes = Object.keys(F4.perf);
  const W = 420;
  const H = 230;
  const l = 40;
  const r = 8;
  const top = 24;
  const bot = 40;
  const lo = 0.85;
  const hi = 1.1;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot);
  const band = (W - l - r) / shapes.length;
  const bw = 26;

  return (
    <div>
      <p className="text-sm font-bold text-ink">Throughput against cuDNN</p>
      <p className="mb-2 text-sm text-muted">
        Each shape is normalized to cuDNN. Labels show the gain over FA-4.
      </p>
      <div className="mb-1 flex gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <Swatch color="#b9bec4" />
          FA-4
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={INK} />
          Optimized FA-4
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={INK_SOFT} dashed />
          cuDNN
        </span>
      </div>
      <div ref={boxRef} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Throughput of FA-4 and optimized FA-4, normalized to cuDNN"
          onPointerLeave={() => {
            setTip(null);
            setHot(null);
          }}
        >
          {[0.9, 1.0].map((v) => (
            <g key={v}>
              <line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke={GRID} />
              <text
                x={l - 6}
                y={y(v)}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill={MUTED}
              >
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {shapes.map((s, i) => {
            const p = F4.perf[s];
            const cx = l + band * (i + 0.5);
            const gain = (p.opt / p.fa4 - 1) * 100;
            const [bh, sq] = s.split(" s");
            return (
              <g
                key={s}
                onPointerMove={(e) => {
                  const box = boxRef.current?.getBoundingClientRect();
                  if (!box) return;
                  setHot(s);
                  setTip({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    w: box.width,
                    h: box.height,
                    body: (
                      <>
                        <p className="mb-1 font-bold text-ink">{s}</p>
                        <p className="flex justify-between">
                          <span>cuDNN</span>
                          <span className="tabular-nums text-ink">
                            {p.cudnn} TFLOPS
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span>FA-4</span>
                          <span className="tabular-nums text-ink">
                            {p.fa4} TFLOPS
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span>Optimized</span>
                          <span className="tabular-nums font-bold text-ink">
                            {p.opt} TFLOPS
                          </span>
                        </p>
                      </>
                    ),
                  });
                }}
              >
                <rect
                  x={cx - band / 2}
                  y={top}
                  width={band}
                  height={H - top - bot}
                  fill={hot === s ? GRID : "transparent"}
                />
                {(["fa4", "opt"] as const).map((k, j) => {
                  const v = p[k] / p.cudnn;
                  const bx = cx + (j === 0 ? -bw - 1 : 1);
                  return (
                    <path
                      key={k}
                      d={`M${bx},${y(lo)}V${y(v) + 4}q0,-4 4,-4h${bw - 8}q4,0 4,4V${y(lo)}Z`}
                      fill={k === "opt" ? INK : "#b9bec4"}
                    />
                  );
                })}
                <text
                  x={cx + 1 + bw / 2}
                  y={y(p.opt / p.cudnn) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={INK}
                >
                  +{gain.toFixed(1)}%
                </text>
                <text
                  x={cx}
                  y={H - bot + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill={INK_SOFT}
                >
                  {bh.replace(" ", "")}
                </text>
                <text
                  x={cx}
                  y={H - bot + 30}
                  textAnchor="middle"
                  fontSize="11"
                  fill={MUTED}
                >
                  s{sq}
                </text>
              </g>
            );
          })}
          <line
            x1={l}
            x2={W - r}
            y1={y(1)}
            y2={y(1)}
            stroke={INK_SOFT}
            strokeDasharray="5 3"
          />
          <line x1={l} x2={W - r} y1={y(lo)} y2={y(lo)} stroke={LINE} />
        </svg>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

// ------------------------------------------------- where probes go in

type Tracer = "existing" | "xtrace";

// same red as --color-highlight in app/theme.css
const PROBE = "#c0392b";
const HATCH = "#b9bec4";

const STACK_NOTE: Record<Tracer, string> = {
  existing:
    "Existing tools add probes to the source or the IR. Both compilers then build the probes into the kernel, so the binary changes.",
  xtrace:
    "Xtrace adds probes to the compiled binary. Both compilers see only the original kernel, so their output stays as it is.",
};

/**
 * The GPU compilation stack, drawn beside the two sections that contrast where
 * existing tools and Xtrace insert their probes. It follows the reader: the
 * section whose heading was scrolled past last picks what it shows, and the
 * buttons override it until the next section change.
 */
export function InstrumentStack({ children }: { children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Tracer>("existing");

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const heads = [...body.querySelectorAll("h2")];
    let last = -1;
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let at = 0;
      heads.forEach((h, i) => {
        if (h.getBoundingClientRect().top < line) at = i;
      });
      if (at !== last) {
        last = at;
        setMode(at === 0 ? "existing" : "xtrace");
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
      <aside className="not-prose mx-auto mt-10 w-full max-w-[260px] lg:mx-0 lg:mt-0">
        <div className="lg:sticky lg:top-24 lg:pt-[3.2em]">
          <div
            className="mb-3 inline-flex w-full rounded-full border border-line bg-paper-deep p-1"
            role="tablist"
            aria-label="Where probes go in"
          >
            {(["existing", "xtrace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-2 py-1 text-xs transition-colors ${
                  mode === m
                    ? "bg-ink font-bold text-paper"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {m === "existing" ? "Existing tools" : "Xtrace"}
              </button>
            ))}
          </div>
          <StackDiagram mode={mode} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {STACK_NOTE[mode]}
          </p>
        </div>
      </aside>
      <div ref={bodyRef} className="min-w-0">
        {children}
      </div>
    </div>
  );
}

function StackDiagram({ mode }: { mode: Tracer }) {
  const X = 12;
  const W = 124;
  const boxes = {
    source: { y: 36, h: 48, label: "Source code" },
    ir: { y: 154, h: 40, label: "IR" },
    binary: { y: 264, h: 56, label: "Binary" },
  };
  const compilers = [
    { y: 106, label: "FE compiler" },
    { y: 216, label: "BE compiler" },
  ];
  const probed = (k: keyof typeof boxes) =>
    mode === "existing" ? true : k === "binary";
  const into = mode === "existing" ? ["source", "ir"] : ["binary"];

  const down = (y0: number, y1: number) => (
    <g key={y0}>
      <line
        x1={X + W / 2}
        x2={X + W / 2}
        y1={y0}
        y2={y1 - 6}
        stroke="#8b9096"
        strokeWidth="3"
      />
      <path d={`M${X + W / 2 - 6},${y1 - 8}l6,8l6,-8z`} fill="#8b9096" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 240 372"
      className="block w-full"
      role="img"
      aria-label={
        mode === "existing"
          ? "Existing tools insert probes into the source or IR, before compilation"
          : "Xtrace inserts probes into the compiled binary, after compilation"
      }
    >
      <defs>
        <pattern
          id="kernel-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke={HATCH} strokeWidth="1.2" />
        </pattern>
      </defs>
      <text
        x={X + W / 2}
        y="18"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={INK}
      >
        GPU stack
      </text>

      {down(boxes.source.y + boxes.source.h, compilers[0].y)}
      {down(compilers[0].y + 30, boxes.ir.y)}
      {down(boxes.ir.y + boxes.ir.h, compilers[1].y)}
      {down(compilers[1].y + 30, boxes.binary.y)}
      {down(boxes.binary.y + boxes.binary.h, 346)}
      <text
        x={X + W / 2}
        y="364"
        textAnchor="middle"
        fontSize="12"
        fontStyle="italic"
        fill={MUTED}
      >
        execution
      </text>

      {(Object.keys(boxes) as (keyof typeof boxes)[]).map((k) => {
        const b = boxes[k];
        const on = probed(k);
        return (
          <g key={k}>
            <rect
              x={X}
              y={b.y}
              width={W}
              height={b.h}
              fill="#fff"
              stroke={INK}
              strokeWidth="2"
            />
            <rect
              x={X + 2}
              y={b.y + 2}
              width={W - 4}
              height={b.h - 4}
              fill="url(#kernel-hatch)"
            />
            {[0.2, 0.8].map((f) => (
              <rect
                key={f}
                x={X + 2}
                y={b.y + b.h * f - 3}
                width={W - 4}
                height="6"
                fill={PROBE}
                opacity={on ? 1 : 0}
                className="transition-opacity duration-300"
              />
            ))}
            {/* a thin halo keeps the label legible over the hatch without
                blanking out the hatch and probes behind it */}
            <text
              x={X + W / 2}
              y={b.y + b.h / 2}
              dy="0.34em"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill={INK}
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {b.label}
            </text>
          </g>
        );
      })}

      {compilers.map((c) => (
        <g key={c.label}>
          <rect x={X - 6} y={c.y} width={W + 12} height="30" fill={INK} />
          <text
            x={X + W / 2}
            y={c.y + 15}
            dy="0.34em"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily="var(--font-mono)"
            fill="#fff"
          >
            {c.label}
          </text>
          {/* does this compiler see the probes? */}
          <g transform={`translate(${X + W + 22},${c.y + 15})`}>
            <circle
              r="9"
              fill={mode === "existing" ? PROBE : INK}
              className="transition-colors duration-300"
            />
            <path
              d={
                mode === "existing"
                  ? "M-3.5,-3.5L3.5,3.5M3.5,-3.5L-3.5,3.5"
                  : "M-4,0L-1,3L4,-3"
              }
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
          <text
            x={X + W + 36}
            y={c.y + 15}
            dy="0.34em"
            fontSize="10.5"
            fill={INK_SOFT}
          >
            {mode === "existing" ? "sees probes" : "untouched"}
          </text>
        </g>
      ))}

      {/* who inserts where */}
      {(Object.keys(boxes) as (keyof typeof boxes)[]).map((k) => {
        const b = boxes[k];
        const active = into.includes(k);
        const cy = b.y + b.h / 2;
        const who = k === "binary" ? "Xtrace" : "Existing tools";
        const mine = (k === "binary") === (mode === "xtrace");
        return (
          <g
            key={k}
            opacity={active ? 1 : 0.22}
            className="transition-opacity duration-300"
          >
            <line
              x1="232"
              x2={X + W + 12}
              y1={cy}
              y2={cy}
              stroke={mine ? INK : MUTED}
              strokeWidth="3.5"
            />
            <path
              d={`M${X + W + 4},${cy}l11,-7v14z`}
              fill={mine ? INK : MUTED}
            />
            <text
              x="232"
              y={cy - 9}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fill={INK}
            >
              {who}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
