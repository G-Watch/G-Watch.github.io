"use client";

// User-owned: where Xtrace puts its probes, for the Supported DSLs doc page.
// The GPU compilation stack drawn like the one in the Xtrace blog post
// (lib/blog/xtrace-charts.tsx), switched between the two instrumentation
// tiers, with the pages that document each tier.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { localePath, resolveLocale } from "@/lib/i18n";

type Tier = "ptx" | "sass";

const INK = "#0f1113";
const INK_SOFT = "#3f464d";
const MUTED = "#6b7278";
const PROBE = "#c0392b"; // --color-highlight in app/theme.css
const HATCH = "#b9bec4";

const TIER: Record<
  Tier,
  { label: string; arg: string; text: string[]; pages: [string, string][] }
> = {
  ptx: {
    label: "PTX tier",
    arg: 'instrumentation_tier="ptx"',
    text: [
      "You mark scopes in the kernel source.",
      "G-Watch turns each marker into a probe in the PTX.",
      "ptxas then compiles the probes with the kernel.",
    ],
    pages: [
      ["CUDA", "/docs/humanize/xtrace/supported-dsls/cuda/"],
      [
        "TileLang",
        "/docs/humanize/xtrace/supported-dsls/tilelang/",
      ],
      [
        "CuTeDSL",
        "/docs/humanize/xtrace/supported-dsls/cutedsl/",
      ],
      ["Triton", "/docs/humanize/xtrace/supported-dsls/triton/"],
    ],
  },
  sass: {
    label: "SASS tier",
    arg: 'instrumentation_tier="sass"',
    text: [
      "You name instructions in the compiled cubin.",
      "G-Watch splices probes into the SASS.",
      "The kernel needs no markers and no rebuild.",
    ],
    pages: [
      ["SASS", "/docs/humanize/xtrace/supported-dsls/sass/"],
    ],
  },
};

export function InstrumentLevels() {
  const [tier, setTier] = useState<Tier>("ptx");
  const params = useParams<{ lang?: string }>();
  const lang = resolveLocale(params?.lang);
  const t = TIER[tier];

  return (
    <figure className="not-prose my-8 rounded-2xl border border-line bg-surface p-4 shadow-paper sm:p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="mx-auto w-full max-w-[230px] flex-none sm:mx-0">
          <Levels tier={tier} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="mb-4 inline-flex rounded-full border border-line bg-paper-deep p-1"
            role="tablist"
            aria-label="Instrumentation tier"
          >
            {(["ptx", "sass"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tier === k}
                onClick={() => setTier(k)}
                className={`rounded-full px-4 py-1 text-xs transition-colors ${
                  tier === k
                    ? "bg-ink font-bold text-paper"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {TIER[k].label}
              </button>
            ))}
          </div>
          <p className="mb-3">
            <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-xs text-ink">
              {t.arg}
            </code>
          </p>
          <div className="space-y-1 text-sm leading-relaxed text-ink-soft">
            {t.text.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold text-muted">
            Guides
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.pages.map(([name, href]) => (
              <Link
                key={name}
                href={localePath(lang, href)}
                className="rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {name} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function Levels({ tier }: { tier: Tier }) {
  const X = 12;
  const W = 120;
  const boxes = {
    source: { y: 12, h: 46, label: "Source code" },
    ptx: { y: 128, h: 40, label: "PTX" },
    sass: { y: 238, h: 54, label: "SASS" },
  } as const;
  type Box = keyof typeof boxes;
  const compilers = [
    { y: 80, label: "DSL compiler" },
    { y: 190, label: "ptxas" },
  ];
  // Where probe instructions sit, and what goes in at each level.
  const probed: Record<Tier, Box[]> = {
    ptx: ["ptx", "sass"],
    sass: ["sass"],
  };
  const inputs: Record<Tier, [Box, string][]> = {
    ptx: [
      ["source", "markers"],
      ["ptx", "probes"],
    ],
    sass: [["sass", "probes"]],
  };
  const marked = tier === "ptx";

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
      viewBox="0 0 230 340"
      className="block w-full"
      role="img"
      aria-label={
        tier === "ptx"
          ? "PTX tier: markers in the source become probes in the PTX, which ptxas compiles into the SASS"
          : "SASS tier: probes are spliced into the compiled SASS"
      }
    >
      <defs>
        <pattern
          id="level-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke={HATCH} strokeWidth="1.2" />
        </pattern>
      </defs>

      {down(boxes.source.y + boxes.source.h, compilers[0].y)}
      {down(compilers[0].y + 28, boxes.ptx.y)}
      {down(boxes.ptx.y + boxes.ptx.h, compilers[1].y)}
      {down(compilers[1].y + 28, boxes.sass.y)}
      {down(boxes.sass.y + boxes.sass.h, 318)}
      <text
        x={X + W / 2}
        y="334"
        textAnchor="middle"
        fontSize="12"
        fontStyle="italic"
        fill={MUTED}
      >
        execution
      </text>

      {(Object.keys(boxes) as Box[]).map((k) => {
        const b = boxes[k];
        const on = probed[tier].includes(k);
        const hasMarks = k === "source" && marked;
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
              fill="url(#level-hatch)"
            />
            {[0.2, 0.8].map((f) => (
              <g key={f}>
                {/* probes: solid bars */}
                <rect
                  x={X + 2}
                  y={b.y + b.h * f - 3}
                  width={W - 4}
                  height="6"
                  fill={PROBE}
                  opacity={on ? 1 : 0}
                  className="transition-opacity duration-300"
                />
                {/* scope markers: dashed rules in the source */}
                <line
                  x1={X + 4}
                  x2={X + W - 4}
                  y1={b.y + b.h * f}
                  y2={b.y + b.h * f}
                  stroke={PROBE}
                  strokeWidth="2"
                  strokeDasharray="5 3"
                  opacity={hasMarks ? 1 : 0}
                  className="transition-opacity duration-300"
                />
              </g>
            ))}
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

      {compilers.map((c, i) => {
        // ptxas is the compiler that sees the probes on the PTX tier
        const sees = tier === "ptx" && i === 1;
        return (
          <g key={c.label}>
            <rect x={X - 6} y={c.y} width={W + 12} height="28" fill={INK} />
            <text
              x={X + W / 2}
              y={c.y + 14}
              dy="0.34em"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill="#fff"
            >
              {c.label}
            </text>
            {i === 1 && (
              <text
                x={X + W + 14}
                y={c.y + 14}
                dy="0.34em"
                fontSize="10.5"
                fill={INK_SOFT}
              >
                {sees ? "compiles probes" : "untouched"}
              </text>
            )}
          </g>
        );
      })}

      {inputs[tier].map(([k, label]) => {
        const b = boxes[k];
        const cy = b.y + b.h / 2;
        return (
          <g key={`${tier}-${k}`} className="animate-[fadeIn_.3s_ease]">
            <line
              x1="226"
              x2={X + W + 12}
              y1={cy}
              y2={cy}
              stroke={INK}
              strokeWidth="3.5"
            />
            <path d={`M${X + W + 4},${cy}l11,-7v14z`} fill={INK} />
            <text
              x="226"
              y={cy - 9}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fill={INK}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
