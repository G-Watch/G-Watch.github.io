"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  HfError,
  cachedSnapshot,
  describeAttention,
  describeRouting,
  estimateActivatedParams,
  fetchModelSnapshot,
  formatModelRef,
  formatParamCount,
  getModelSourceCopy,
  hubUrl,
  parseModelRef,
  type HfErrorCode,
  type HfModelSnapshot,
  type HfRepoInfo,
} from "@/lib/hf-model";
import { getCalculatorCopy } from "@/lib/calculator";
import type { Locale } from "@/lib/i18n";
import { ArchPanel } from "./arch-panel";
import { DocDialog } from "./doc-dialog";

/**
 * The calculator's model source — shared by every panel.
 *
 * One job: turn a pasted Hugging Face URL into a loaded `HfModelSnapshot` and
 * hand it up, then read back the architecture it found so the reader can see
 * what the panels below are computing against. It owns no arithmetic.
 *
 * Mount it once, above the panels, and pass `value` / `onChange` from state
 * that survives switching panels.
 */

/** Matches the field styling used across the Open Traces browser. */
const FIELD =
  "w-full min-w-0 rounded border border-line bg-surface px-2 py-1.5 text-xs text-ink transition-colors placeholder:text-muted/50 hover:border-muted/40 focus:border-accent focus:outline-none";

const BUTTON =
  "shrink-0 rounded border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-muted/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

/** How many label/value pairs share one row of the facts table. */
const PAIRS_PER_ROW = 3;

/**
 * One label/value pair — two cells of a row, not a row of its own.
 *
 * Rules run between the two cells and between the pairs: the pair boundary in
 * `line`, the label/value one in the lighter `line-soft`, so a row reads as
 * three pairs before it reads as six cells.
 */
function Fact({
  label,
  value,
  note,
  render,
  span,
  divide,
}: {
  label: string;
  value: string;
  note?: string;
  /** Drawn in the value cell instead of the text. */
  render?: ReactNode;
  /** Extra columns the value cell takes, for a value wider than a number. */
  span?: number;
  /** Whether a pair boundary sits to the left of this pair. */
  divide: boolean;
}) {
  return (
    <>
      <th
        scope="row"
        className={`px-2.5 py-1.5 text-left align-top text-xs font-normal text-muted ${
          divide ? "border-l border-line" : ""
        }`}
      >
        {label}
      </th>
      <td
        colSpan={1 + (span ?? 0)}
        className={`border-l border-line-soft px-2.5 py-1.5 text-xs text-ink ${
          render ? "align-middle" : "truncate"
        }`}
        title={render ? undefined : value}
      >
        {render ?? value}
        {!render && note && (
          <span className="ml-1 text-[10px] text-muted">
            ({note})
          </span>
        )}
      </td>
    </>
  );
}

/**
 * Categorical slots for the dtype bar, in fixed order — assigned in sequence,
 * never cycled (a 6th dtype folds into "other" below rather than reusing a
 * hue, which would put two identities in one colour).
 *
 * Muted on purpose: this theme carries no hue of its own, so these sit at the
 * chroma floor where a colour still does identity work (OKLCH C >= 0.10) and no
 * higher. Validated as a set on a white surface — lightness band, chroma floor,
 * adjacent CVD separation (worst pair ΔE 8.3 protan, target >= 8), normal-vision
 * separation (worst 16.3, floor >= 15) and >= 3:1 contrast all pass. Do not nudge
 * one by eye: re-run the validator on the whole set.
 */
const DTYPE_INKS = [
  "#356fa8", // blue
  "#c96a2e", // orange
  "#0f8f70", // green
  "#a8850f", // gold
  "#94528f", // violet
];

/** Neutral for the folded remainder — not a categorical slot. */
const OTHER_INK = "#6b7278";

/** 0.0062 → "<0.1%"; 0.9942 → "99.4%". */
function formatShare(share: number): string {
  if (share > 0 && share < 0.001) return "<0.1%";
  return `${(share * 100).toFixed(1)}%`;
}

/** One segment of the bar: a dtype (or the folded remainder) and its count. */
interface DtypeSlice {
  label: string;
  count: number;
  ink: string;
  /** The dtypes folded into this slice, when it is the remainder. */
  folded?: string[];
}

/**
 * Where the parameters sit, by dtype — a stacked bar in the Checkpoint dtype
 * cell, which is the fact it IS: the cell used to name the dominant dtype and
 * say nothing about the rest, and on a quantized checkpoint the rest is most of
 * the model.
 *
 * Measured, not declared: read from the safetensors headers (see
 * `HfRepoInfo.params`), where config.json carries no parameter count at all.
 *
 * Segments are sized by flex-grow so the 2px gaps between them come out of the
 * width rather than overflowing it, and a segment never falls below 2px, so a
 * 0.006% dtype stays visible. Exact counts belong in the tooltip; the row under
 * the bar carries the names and shares, which is what a cell has room for.
 */
function DtypeBar({
  params,
  lang,
}: {
  params: NonNullable<HfRepoInfo["params"]>;
  lang: Locale;
}) {
  const t = getModelSourceCopy(lang);
  const present = Object.entries(params.byDtype)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (present.length === 0 || params.total <= 0) return null;

  const slices: DtypeSlice[] = present
    .slice(0, DTYPE_INKS.length)
    .map(([label, count], at) => ({ label, count, ink: DTYPE_INKS[at] }));
  const rest = present.slice(DTYPE_INKS.length);
  if (rest.length > 0) {
    slices.push({
      label: t.other,
      count: rest.reduce((sum, [, count]) => sum + count, 0),
      ink: OTHER_INK,
      folded: rest.map(([label]) => label),
    });
  }

  const read = (slice: DtypeSlice) =>
    `${slice.folded ? slice.folded.join(", ") : slice.label} ${formatParamCount(slice.count)} (${formatShare(slice.count / params.total)})`;

  return (
    <div className="flex flex-col gap-1.5 py-0.5">
      <div
        role="img"
        aria-label={slices.map(read).join(", ")}
        className="flex h-2.5 w-full gap-[2px]"
      >
        {slices.map((slice) => (
          <div
            key={slice.label}
            title={read(slice)}
            style={{
              flexGrow: slice.count,
              flexBasis: 0,
              minWidth: 2,
              background: slice.ink,
            }}
            className="rounded-[1px] first:rounded-l last:rounded-r"
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {slices.map((slice) => (
          <li
            key={slice.label}
            title={read(slice)}
            className="flex items-center gap-1 text-[10px] leading-none"
          >
            {/* The swatch carries identity; the text stays in ink tokens. */}
            <span
              aria-hidden="true"
              style={{ background: slice.ink }}
              className="h-2 w-2 shrink-0 rounded-[1px]"
            />
            <span className="text-ink">{slice.label}</span>
            <span className="text-muted">
              {formatShare(slice.count / params.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One label/value pair of the facts table. */
interface FactEntry {
  label: string;
  value: string;
  note?: string;
  /** Drawn in the value cell instead of the text. */
  render?: ReactNode;
  /** Extra columns the value cell takes. */
  span?: number;
}

/**
 * The architecture as a plain table, grouped by what each number is about —
 * size, layout, attention, FFN, precision. A group starts its own row, so a row
 * never mixes two subjects, and the pairs fill the width they are given.
 *
 * Every entry the config did not state says so rather than showing a plausible
 * default — a panel that cannot size something has to be able to tell the
 * reader which input is missing.
 */
function FactsView({
  snapshot,
  lang,
  lead,
}: {
  snapshot: HfModelSnapshot;
  lang: Locale;
  /** Shown above the table — what explains where these numbers come from. */
  lead?: ReactNode;
}) {
  const t = getModelSourceCopy(lang);
  const { shape, repo } = snapshot;
  const n = (value: number | undefined) =>
    value === undefined ? t.unknown : value.toLocaleString("en-US");
  const activated = estimateActivatedParams(shape);

  const groups: { label: string; facts: FactEntry[] }[] = [
    {
      label: t.groups.size,
      facts: [
        {
          label: t.facts.params,
          value: shape.paramCount
            ? formatParamCount(shape.paramCount)
            : t.unknown,
        },
        // Only an MoE has an activated count worth stating — a dense model
        // activates all of itself, and the row would repeat the one beside it.
        ...(activated !== undefined
          ? [
              {
                label: t.facts.activated,
                value: formatParamCount(activated),
              },
            ]
          : []),
      ],
    },
    {
      label: t.groups.layout,
      facts: [
        { label: t.facts.layers, value: n(shape.numLayers) },
        ...(shape.numNextnPredictLayers
          ? [{ label: t.facts.mtp, value: n(shape.numNextnPredictLayers) }]
          : []),
        { label: t.facts.hidden, value: n(shape.hiddenSize) },
        { label: t.facts.vocab, value: n(shape.vocabSize) },
        {
          label: t.facts.tied,
          value:
            shape.tieWordEmbeddings === undefined
              ? t.unknown
              : shape.tieWordEmbeddings
                ? t.tiedYes
                : t.tiedNo,
        },
        { label: t.facts.context, value: n(shape.maxPositionEmbeddings) },
      ],
    },
    {
      label: t.groups.attention,
      facts: [
        { label: t.facts.attention, value: describeAttention(shape) },
        {
          label: t.facts.headDim,
          value: n(shape.headDim),
          note: shape.headDimDerived ? t.derived : undefined,
        },
        ...(shape.slidingWindow
          ? [{ label: t.facts.sliding, value: n(shape.slidingWindow) }]
          : []),
      ],
    },
    {
      label: t.groups.ffn,
      facts: [
        { label: t.facts.routing, value: describeRouting(shape) },
        shape.moe
          ? {
              label: t.facts.expertFfn,
              value: n(
                shape.moe.expertIntermediateSize ?? shape.intermediateSize,
              ),
            }
          : { label: t.facts.ffn, value: n(shape.intermediateSize) },
      ],
    },
    {
      label: t.groups.precision,
      facts: [
        // How the weights are stored, measured off the safetensors headers —
        // and, separately, what the config says the model loads in. On a
        // quantized checkpoint these differ, and only the first sizes a
        // footprint. The stored side is the whole split, not just its mode, so
        // it takes the rest of the row.
        {
          label: t.facts.dtype,
          value: shape.weightDtype ?? t.unknown,
          render: repo.params ? (
            <DtypeBar params={repo.params} lang={lang} />
          ) : undefined,
          span: repo.params ? 2 : 0,
        },
        { label: t.facts.computeDtype, value: shape.torchDtype ?? t.unknown },
      ],
    },
  ];

  return (
    <div className="border-t border-line px-4 py-2">
      {lead && <div className="mb-1.5 mt-1 flex items-center">{lead}</div>}
      {shape.nestedUnder && (
        <p className="my-2 rounded border border-line bg-paper-deep/50 px-2.5 py-1.5 text-xs text-ink-soft">
          {t.nested(shape.nestedUnder)}
        </p>
      )}
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {/* The group name only has to fit one short word. */}
          <col className="w-[10%]" />
          {[0, 1, 2].map((pair) => (
            <Fragment key={pair}>
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </Fragment>
          ))}
        </colgroup>
        {groups.map((group) => {
          const rows: FactEntry[][] = [];
          for (let at = 0; at < group.facts.length; at += PAIRS_PER_ROW) {
            rows.push(group.facts.slice(at, at + PAIRS_PER_ROW));
          }
          return (
            <tbody
              key={group.label}
              className="border-t border-line first:border-0"
            >
              {rows.map((row, depth) => (
                <tr key={row[0].label}>
                  {/* The group name spans its rows, so the table reads as
                      blocks rather than one long list. */}
                  {depth === 0 && (
                    <th
                      scope="rowgroup"
                      rowSpan={rows.length}
                      className="whitespace-nowrap border-r border-line py-1.5 pr-2.5 text-left align-top text-xs font-bold text-ink-soft"
                    >
                      {group.label}
                    </th>
                  )}
                  {row.map((fact, at) => (
                    <Fact key={fact.label} {...fact} divide={at > 0} />
                  ))}
                  {/* Keeps the fixed columns aligned when a row is short — a
                      pair that spans extra columns has already taken them. */}
                  {used(row) < PAIRS_PER_ROW * 2 && (
                    <td
                      colSpan={PAIRS_PER_ROW * 2 - used(row)}
                      className="border-l border-line"
                    />
                  )}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/** Columns a row of pairs occupies, spans included. */
function used(row: FactEntry[]): number {
  return row.reduce((sum, fact) => sum + 2 + (fact.span ?? 0), 0);
}

/** Puts the loaded model's config.json on the clipboard. */
function CopyConfigButton({
  snapshot,
  lang,
}: {
  snapshot: HfModelSnapshot;
  lang: Locale;
}) {
  const t = getModelSourceCopy(lang);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        const text = JSON.stringify(snapshot.config, null, 2);
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      className={BUTTON}
    >
      {copied ? t.copied : t.copyConfig}
    </button>
  );
}

export function ModelPicker({
  lang,
  value,
  onChange,
  doc,
}: {
  lang: Locale;
  /** The loaded model, or null. Owned by the caller so panels share it. */
  value: HfModelSnapshot | null;
  onChange: (snapshot: HfModelSnapshot | null) => void;
  /** The methodology document, rendered at build time; "" while unwritten. */
  doc: string;
}) {
  const t = getModelSourceCopy(lang);
  const c = getCalculatorCopy(lang);
  const [query, setQuery] = useState(() =>
    value ? formatModelRef(value.ref) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HfErrorCode | null>(null);
  // Only the newest load may write state: a slow lookup must not land on top
  // of a faster one the reader started afterwards.
  const loadId = useRef(0);

  /**
   * Load whatever was pasted. The reference carries its own revision — a
   * `/tree/<rev>` or `/blob/<rev>/…` URL, or an `owner/name@rev` — and is read
   * at the repo's default branch when it names none.
   */
  async function load(input: string, options: { refresh?: boolean } = {}) {
    const target = parseModelRef(input);
    if (!target) {
      setError("bad-ref");
      return;
    }

    const ticket = ++loadId.current;
    setError(null);
    const cached = !options.refresh && cachedSnapshot(target);
    if (cached) {
      setQuery(formatModelRef(cached.ref));
      onChange(cached);
      return;
    }
    setBusy(true);
    try {
      const snapshot = await fetchModelSnapshot(target, {
        refresh: options.refresh,
      });
      if (ticket !== loadId.current) return;
      setQuery(formatModelRef(snapshot.ref));
      onChange(snapshot);
    } catch (failure) {
      if (ticket !== loadId.current) return;
      setError(failure instanceof HfError ? failure.code : "network");
    } finally {
      if (ticket === loadId.current) setBusy(false);
    }
  }

  return (
    <section className="rounded border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">{t.title}</h2>
      </header>

      {/* The box already shows the loaded reference, so it IS the model line:
          one row of input plus the actions on it. */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Submit is the one path in: the button and Enter both take it. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load(query);
            }}
            className="flex min-w-[15rem] flex-1 items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.inputHint}
              enterKeyHint="go"
              aria-label={t.inputLabel}
              spellCheck={false}
              autoComplete="off"
              className={FIELD}
            />
            {/* Once a model is loaded the box holds its name, and Reload is
                the action on it; Enter still submits for an edited ref. */}
            {!value && (
              <button type="submit" disabled={busy} className={BUTTON}>
                {t.search}
              </button>
            )}
          </form>

          {value && (
            <div className="flex shrink-0 items-center gap-2">
              {/* The name is no longer a link, so the way out to the Hub is. */}
              <a
                href={hubUrl(value.ref)}
                target="_blank"
                rel="noreferrer"
                aria-label={t.openOnHub}
                title={t.openOnHub}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded border border-line text-muted transition-colors hover:border-muted/40 hover:text-ink"
              >
                {/* Material Symbols "open_in_new" (Apache-2.0), inlined. */}
                <svg
                  viewBox="0 -960 960 960"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-[0.9em] w-[0.9em]"
                >
                  <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z" />
                </svg>
              </a>
              <CopyConfigButton snapshot={value} lang={lang} />
              <button
                type="button"
                onClick={() =>
                  void load(formatModelRef(value.ref), { refresh: true })
                }
                disabled={busy}
                className={BUTTON}
              >
                {t.reload}
              </button>
              <button
                type="button"
                onClick={() => {
                  loadId.current += 1;
                  onChange(null);
                  setError(null);
                }}
                className={BUTTON}
              >
                {t.clear}
              </button>
            </div>
          )}
        </div>

        {(busy || error) && (
          <p
            className={`mt-2 text-xs ${busy ? "text-muted" : "text-accent-strong"}`}
          >
            {busy ? t.loading : error && t.errors[error]}
          </p>
        )}
      </div>

      {value ? (
        <>
          <FactsView
            snapshot={value}
            lang={lang}
            // It explains these numbers, so it leads them rather than sitting
            // among the actions on the model.
            lead={
              <DocDialog
                label={c.methodology.button}
                title={c.methodology.title}
                html={doc}
                empty={c.methodology.empty}
                closeLabel={c.methodology.close}
              />
            }
          />
          <ArchPanel snapshot={value} lang={lang} />
        </>
      ) : (
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          {t.empty}
        </p>
      )}
    </section>
  );
}
