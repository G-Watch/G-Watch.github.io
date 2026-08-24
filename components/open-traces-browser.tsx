"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  NAV_LEVELS,
  buildTraceTree,
  filterRecords,
  formatParams,
  getOpenTracesCopy,
  pathOf,
  type OpenTracesCopy,
  type TraceRecord,
  type TraceTreeNode,
} from "@/lib/open-traces";
import { localePath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { normalizeTrace, type TraceData } from "@/lib/trace-format";
import { TracePanel } from "./trace-panel";

/** Depth of the deepest sidebar level (arch); kernel has its own column. */
const ARCH_DEPTH = NAV_LEVELS.length - 1;

const pathKey = (path: string[]) => path.join(" ▸ ");

const LABEL = "text-xs text-muted";

/** Keys of every node that has children — the tree starts fully open. */
function branchKeys(nodes: TraceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length > 0
      ? [pathKey(node.path), ...branchKeys(node.children)]
      : [],
  );
}

const FIELD =
  "w-full min-w-0 rounded border border-line bg-surface px-2 py-1 text-xs text-ink transition-colors placeholder:text-muted/50 hover:border-muted/40 focus:border-accent focus:outline-none";

/** A dashed stand-in for a value the catalog does not have yet. */
function Ghost({ className = "w-20" }: { className?: string }) {
  return (
    <span
      className={`block h-[1.4em] rounded border border-dashed border-line bg-line-soft/40 ${className}`}
      aria-hidden="true"
    />
  );
}

/** One column of the trace table: its header, its cell text, its filter. */
interface Column {
  id: string;
  label: string;
  value: (record: TraceRecord) => string;
}

/** A parameter constraint, e.g. `precision` = `fp16`. */
interface ParamToken {
  key: string;
  value: string;
}

const tokenId = (token: ParamToken) => `${token.key}=${token.value}`;

/* -------------------------------------------------------------------------
 * Sidebar
 * ---------------------------------------------------------------------- */

/** Collapses a sidebar column down to its rail. */
function CollapseButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 px-1 text-[10px] text-muted transition-colors hover:text-ink"
    >
      «
    </button>
  );
}

/** A collapsed column: a narrow rail carrying its name, click to reopen. */
function CollapsedRail({
  onExpand,
  label,
  expandLabel,
}: {
  onExpand: () => void;
  label: string;
  expandLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`${expandLabel}: ${label}`}
      title={`${expandLabel}: ${label}`}
      className="flex h-full w-full flex-col items-center gap-3 rounded border border-line bg-paper-deep/40 py-3 text-muted transition-colors hover:border-muted/40 hover:text-ink"
    >
      <span className="text-[10px]">»</span>
      <span className="[writing-mode:vertical-rl] text-xs tracking-wide">
        {label}
      </span>
    </button>
  );
}

/** The navigable taxonomy, indented level by level — the sidebar with no data. */
function LevelScaffold({ copy }: { copy: OpenTracesCopy }) {
  const widths = ["w-20", "w-16", "w-12", "w-16"];
  return (
    <ol>
      {NAV_LEVELS.map((level, depth) => (
        <li
          key={level}
          style={{ marginLeft: depth === 0 ? 0 : "0.5rem" }}
          className={depth === 0 ? "" : "border-l border-line pl-3 pt-2"}
        >
          <div className={LABEL}>{copy.levels[level]}</div>
          <div className="mt-1">
            <Ghost className={widths[depth]} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One nested level of the real tree, down to the architecture. */
function TreeLevel({
  nodes,
  depth,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  nodes: TraceTreeNode[];
  depth: number;
  selected: string[];
  expanded: Set<string>;
  onSelect: (node: TraceTreeNode) => void;
  onToggle: (key: string) => void;
}) {
  return (
    <ul
      className={
        depth === 0 ? "space-y-px" : "space-y-px border-l border-line pl-2"
      }
    >
      {nodes.map((node) => {
        const key = pathKey(node.path);
        const isBranch = depth < ARCH_DEPTH;
        const onSelectedPath =
          selected.length > depth &&
          pathKey(selected.slice(0, depth + 1)) === key;
        const isOpen = isBranch && (expanded.has(key) || onSelectedPath);
        const isSelected = pathKey(selected) === key;

        return (
          <li key={key}>
            <div
              className={`flex items-center rounded transition-colors ${
                isSelected ? "bg-paper-deep" : "hover:bg-paper-deep/60"
              }`}
            >
              {isBranch ? (
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  aria-label={isOpen ? "collapse" : "expand"}
                  className="flex h-6 w-4 shrink-0 items-center justify-center text-[9px] text-muted transition-transform hover:text-ink"
                  style={{ transform: isOpen ? "rotate(90deg)" : undefined }}
                >
                  ▸
                </button>
              ) : (
                <span className="h-6 w-4 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(node)}
                className={`min-w-0 flex-1 truncate py-1 pr-1 text-left text-xs transition-colors ${
                  isSelected
                    ? "font-bold text-accent-strong"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {node.key}
              </button>
            </div>
            {isOpen && (
              <div className="ml-2 mt-px">
                <TreeLevel
                  nodes={node.children}
                  depth={depth + 1}
                  selected={selected}
                  expanded={expanded}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The kernels of the selected branch, searchable. Kernel names are long and
 * share their prefixes, so this is a search box rather than one more tree level.
 */
function KernelColumn({
  kernels,
  query,
  onQuery,
  selected,
  onSelect,
  copy,
  enabled,
  hasSelection,
  onCollapse,
}: {
  kernels: string[];
  query: string;
  onQuery: (value: string) => void;
  selected: string | null;
  onSelect: (kernel: string | null) => void;
  copy: OpenTracesCopy;
  enabled: boolean;
  hasSelection: boolean;
  onCollapse: () => void;
}) {
  return (
    <div>
      <div className={`${LABEL} mb-2 flex items-center justify-between gap-2`}>
        <span className="truncate">{copy.levels.kernel}</span>
        <CollapseButton onClick={onCollapse} label={copy.collapse} />
      </div>
      {!enabled ? (
        <>
          <Ghost className="w-full" />
          <div className="mt-4 space-y-2">
            {["w-full", "w-4/5", "w-11/12", "w-3/4", "w-5/6"].map((width) => (
              <Ghost key={width} className={width} />
            ))}
          </div>
        </>
      ) : !hasSelection ? null : (
        <>
          <input
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={copy.kernelSearchHint}
            aria-label={copy.kernelSearchHint}
            className={FIELD}
          />
          <ul className="mt-3 space-y-px">
            {kernels.map((kernel) => (
              <li key={kernel}>
                <button
                  type="button"
                  onClick={() => onSelect(kernel === selected ? null : kernel)}
                  title={kernel}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs transition-colors ${
                    kernel === selected
                      ? "bg-paper-deep font-bold text-accent-strong"
                      : "text-ink-soft hover:bg-paper-deep/60 hover:text-ink"
                  }`}
                >
                  {kernel}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Filters
 * ---------------------------------------------------------------------- */

/** One group of options inside a facet filter. */
interface FacetGroup {
  key: string;
  values: string[];
}

/**
 * The one filter every column uses. Opening it lists the values present in the
 * current scope; each pick narrows the table and stays listed and highlighted,
 * so reopening the menu appends or removes constraints. Several values of one
 * key widen it (b=2 OR b=4); values of different keys narrow (b=2 AND fp16).
 *
 * The parameters column passes many groups (one per parameter); a single-valued
 * column like GPU passes one group and hides the group headings.
 */
function FacetFilter({
  groups,
  tokens,
  onChange,
  placeholder,
  label,
  showGroupLabels,
}: {
  groups: FacetGroup[];
  tokens: ParamToken[];
  onChange: (tokens: ParamToken[]) => void;
  placeholder: string;
  label: string;
  showGroupLabels: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const picked = new Set(tokens.map(tokenId));
  const options = groups
    .map((group) => ({
      key: group.key,
      values: group.values.filter(
        (value) =>
          !needle ||
          `${group.key}=${value}`.toLowerCase().includes(needle) ||
          value.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.values.length > 0);

  return (
    <div ref={box} className="relative">
      <div
        className={`flex flex-wrap items-center gap-1 rounded border bg-surface px-1.5 py-1 transition-colors ${
          open ? "border-accent" : "border-line hover:border-muted/40"
        }`}
      >
        {tokens.map((token) => (
          <span
            key={tokenId(token)}
            className="flex items-center gap-1 rounded bg-paper-deep px-1.5 py-0.5 text-[11px] text-ink-soft"
          >
            {showGroupLabels ? tokenId(token) : token.value}
            <button
              type="button"
              onClick={() =>
                onChange(tokens.filter((t) => tokenId(t) !== tokenId(token)))
              }
              aria-label={`remove ${tokenId(token)}`}
              className="text-muted transition-colors hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={tokens.length === 0 ? placeholder : ""}
          aria-label={label}
          className="min-w-[4rem] flex-1 bg-transparent py-0.5 text-xs text-ink placeholder:text-muted/50 focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded border border-line bg-surface p-1 shadow-paper">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted">—</p>
          ) : (
            options.map((group) => (
              <div key={group.key} className="mb-1 last:mb-0">
                {showGroupLabels && (
                  <div className="px-2 py-1 text-[11px] text-muted">
                    {group.key}
                  </div>
                )}
                {group.values.map((value) => {
                  const isPicked = picked.has(`${group.key}=${value}`);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() =>
                        onChange(
                          isPicked
                            ? tokens.filter(
                                (t) => tokenId(t) !== `${group.key}=${value}`,
                              )
                            : [...tokens, { key: group.key, value }],
                        )
                      }
                      className={`block w-full truncate rounded px-2 py-1 text-left text-xs transition-colors ${
                        isPicked
                          ? "bg-accent-soft font-bold text-accent-strong"
                          : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Table
 * ---------------------------------------------------------------------- */

function TraceRow({
  record,
  columns,
  copy,
  lang,
  onOpen,
}: {
  record: TraceRecord;
  columns: Column[];
  copy: OpenTracesCopy;
  lang: Locale;
  onOpen: () => void;
}) {
  const href = record.href;
  const cta = "whitespace-nowrap text-xs font-bold text-accent-strong";

  return (
    <tr
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      className="cursor-pointer border-b border-line-soft transition-colors hover:bg-paper-deep/60 focus:bg-paper-deep focus:outline-none"
    >
      {columns.map((column, i) => (
        <td
          key={column.id}
          className={`py-3 pr-4 text-sm ${i === 0 ? "text-ink" : "text-ink-soft"}`}
        >
          {column.value(record) || "—"}
        </td>
      ))}
      <td className="py-3 text-right">
        {href ? (
          /^https?:\/\//.test(href) ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className={cta}
            >
              {copy.viewTrace}
            </a>
          ) : (
            <Link
              href={localePath(lang, href)}
              onClick={(event) => event.stopPropagation()}
              className={cta}
            >
              {copy.viewTrace}
            </Link>
          )
        ) : null}
      </td>
    </tr>
  );
}

/** Placeholder rows standing where published traces will be listed. */
function GhostRows({ columns }: { columns: Column[] }) {
  const widths = ["w-52", "w-44", "w-56", "w-48"];
  return (
    <tbody>
      {widths.map((width) => (
        <tr key={width} className="border-b border-line-soft">
          {columns.map((column, i) => (
            <td key={column.id} className="py-3 pr-4">
              <Ghost className={i === 0 ? width : "w-20"} />
            </td>
          ))}
          <td className="py-3 pl-4">
            <Ghost className="ml-auto w-14" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/* -------------------------------------------------------------------------
 * Trace view
 * ---------------------------------------------------------------------- */

/** Loads one record's trace JSON on demand and hands it to the panel. */
function TraceView({ record }: { record: TraceRecord }) {
  const [data, setData] = useState<TraceData | null>(null);
  const [failed, setFailed] = useState(false);
  const source = record.trace;

  useEffect(() => {
    if (!source) return;
    let live = true;
    fetch(/^https?:\/\//.test(source) ? source : withBasePath(source))
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((raw) => {
        if (live) {
          const parsed = normalizeTrace(raw);
          setData(parsed);
          setFailed(parsed === null);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [source]);

  if (!source || failed) {
    return (
      <div className="mt-4 flex-1 rounded-xl border border-line bg-surface" />
    );
  }
  return (
    <div className="mt-4 min-h-0 flex-1 rounded-xl border border-line bg-surface p-4">
      {data ? <TracePanel key={source} data={data} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Browser
 * ---------------------------------------------------------------------- */

export function OpenTracesBrowser({
  lang,
  records: catalog,
}: {
  lang: Locale;
  /** The catalog to render; an empty list renders the skeleton. */
  records: TraceRecord[];
}) {
  const search = useSearchParams();
  // The selection lives in the query string so a view can be pasted to someone
  // else. Read once on mount; every later change is written back below.
  const [selected, setSelected] = useState<string[]>(() => {
    const path: string[] = [];
    for (const level of NAV_LEVELS) {
      const value = search.get(level);
      if (!value) break;
      path.push(value);
    }
    return path;
  });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(branchKeys(buildTraceTree(catalog, NAV_LEVELS.length))),
  );
  const [kernelQuery, setKernelQuery] = useState("");
  const [pickedKernel, setPickedKernel] = useState<string | null>(() =>
    search.get("kernel"),
  );
  const [facets, setFacets] = useState<Record<string, ParamToken[]>>({});
  const [pickedRow, setPickedRow] = useState<TraceRecord | null>(() => {
    const wanted = search.get("params");
    if (!wanted) return null;
    return catalog.find((r) => formatParams(r.params) === wanted) ?? null;
  });
  const [treeOpen, setTreeOpen] = useState(true);
  const [kernelsOpen, setKernelsOpen] = useState(true);
  const copy = getOpenTracesCopy(lang);
  const hasRecords = catalog.length > 0;

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // The columns fill in one step at a time: kernels appear once the tree is
  // walked all the way to an architecture, the table once a kernel is picked.
  const hasArch = selected.length === NAV_LEVELS.length;
  const inBranch = hasArch ? filterRecords(catalog, selected) : [];

  const needle = kernelQuery.trim().toLowerCase();
  const kernels = [...new Set(inBranch.map((record) => record.kernel))]
    .filter((kernel) => !needle || kernel.toLowerCase().includes(needle))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  // A kernel picked in one branch may not exist in the next one, so the
  // selection is derived rather than stored — moving the tree never strands it.
  const activeKernel =
    pickedKernel && kernels.includes(pickedKernel) ? pickedKernel : null;

  const scope = inBranch.filter(
    (record) => !activeKernel || record.kernel === activeKernel,
  );

  // Capture facts differ per trace, so the columns beyond params are the union
  // of the meta keys present in the current scope.
  const metaKeys = hasRecords
    ? [...new Set(catalog.flatMap((record) => Object.keys(record.meta ?? {})))]
    : [copy.columns.meta];
  const columns: Column[] = [
    {
      id: "params",
      label: copy.levels.params,
      value: (r) => formatParams(r.params),
    },
    ...metaKeys.map((key) => ({
      id: `meta:${key}`,
      label: key,
      value: (r: TraceRecord) => r.meta?.[key] ?? "",
    })),
    {
      id: "gwatch",
      label: copy.columns.gwatch,
      value: (r) => r.gwatchVersion ?? "",
    },
  ];

  /** The values a column offers, grouped the way its filter lists them. */
  function groupsOf(column: Column): FacetGroup[] {
    if (column.id !== "params") {
      return [
        {
          key: column.id,
          values: [...new Set(scope.map(column.value))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
        },
      ];
    }
    const byKey = new Map<string, Set<string>>();
    for (const record of scope) {
      for (const [key, value] of Object.entries(record.params)) {
        const values = byKey.get(key) ?? new Set<string>();
        values.add(String(value));
        byKey.set(key, values);
      }
    }
    return [...byKey.entries()].map(([key, values]) => ({
      key,
      values: [...values].sort((a, b) =>
        a.localeCompare(b, "en", { numeric: true }),
      ),
    }));
  }

  /** One column's constraint: OR over the values of a key, AND across keys. */
  function passes(record: TraceRecord, column: Column): boolean {
    const tokens = facets[column.id] ?? [];
    if (tokens.length === 0) return true;
    const byKey = new Map<string, Set<string>>();
    for (const token of tokens) {
      const values = byKey.get(token.key) ?? new Set<string>();
      values.add(token.value);
      byKey.set(token.key, values);
    }
    return [...byKey].every(([key, values]) =>
      values.has(
        column.id === "params"
          ? String(record.params[key] ?? "")
          : column.value(record),
      ),
    );
  }

  // The table lists rows only once a kernel is picked; before that it shows its
  // header and filters with an empty body.
  const records = !activeKernel
    ? []
    : scope.filter((record) =>
        columns.every((column) => passes(record, column)),
      );

  // Like the kernel pick, the opened row is derived: moving the tree or the
  // kernel selection out from under it closes the trace view instead of
  // leaving a record on screen that no longer belongs to the selection.
  const openRecord =
    pickedRow && records.includes(pickedRow) ? pickedRow : null;

  const isFiltered = Object.values(facets).some((tokens) => tokens.length > 0);

  const shareKernel = activeKernel;
  const shareParams = openRecord ? formatParams(openRecord.params) : null;
  useEffect(() => {
    const query = new URLSearchParams();
    NAV_LEVELS.forEach((level, i) => {
      if (selected[i]) query.set(level, selected[i]);
    });
    if (shareKernel) query.set("kernel", shareKernel);
    if (shareParams) query.set("params", shareParams);
    const qs = query.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
  }, [selected, shareKernel, shareParams]);

  return (
    <div
      className={`grid min-h-0 flex-1 grid-cols-1 items-stretch gap-x-6 gap-y-10 transition-[grid-template-columns] duration-300 ease-out sm:grid-cols-2 ${
        treeOpen
          ? kernelsOpen
            ? "lg:grid-cols-[214px_224px_minmax(0,1fr)]"
            : "lg:grid-cols-[214px_60px_minmax(0,1fr)]"
          : kernelsOpen
            ? "lg:grid-cols-[60px_224px_minmax(0,1fr)]"
            : "lg:grid-cols-[60px_60px_minmax(0,1fr)]"
      }`}
    >
      <aside className="min-h-0 overflow-x-hidden overflow-y-auto border-muted/30 pr-6 lg:border-r">
        {!treeOpen ? (
          <CollapsedRail
            onExpand={() => setTreeOpen(true)}
            label={copy.levels.vendor}
            expandLabel={copy.expand}
          />
        ) : (
          <div className="lg:w-[190px]">
            {hasRecords ? (
              <>
                <div
                  className={`${LABEL} mb-2 flex items-center justify-between gap-2 border-b border-line pb-2`}
                >
                  <span className="truncate">{copy.levels.vendor}</span>
                  <CollapseButton
                    onClick={() => setTreeOpen(false)}
                    label={copy.collapse}
                  />
                </div>
                <TreeLevel
                  nodes={buildTraceTree(catalog, NAV_LEVELS.length)}
                  depth={0}
                  selected={selected}
                  expanded={expanded}
                  onSelect={(node) =>
                    setSelected(
                      pathKey(selected) === pathKey(node.path) ? [] : node.path,
                    )
                  }
                  onToggle={toggle}
                />
              </>
            ) : (
              <LevelScaffold copy={copy} />
            )}
          </div>
        )}
      </aside>

      <aside className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto border-muted/30 pr-6 lg:border-r">
        {!kernelsOpen ? (
          <CollapsedRail
            onExpand={() => setKernelsOpen(true)}
            label={copy.levels.kernel}
            expandLabel={copy.expand}
          />
        ) : (
          <div className="lg:w-[200px]">
            <KernelColumn
              kernels={kernels}
              query={kernelQuery}
              onQuery={setKernelQuery}
              selected={activeKernel}
              onSelect={setPickedKernel}
              copy={copy}
              enabled={hasRecords}
              hasSelection={hasArch}
              onCollapse={() => setKernelsOpen(false)}
            />
          </div>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col sm:col-span-2 lg:col-span-1">
        {openRecord ? (
          <>
            <button
              type="button"
              onClick={() => setPickedRow(null)}
              className="self-start text-xs font-bold text-accent-strong transition-colors hover:text-accent"
            >
              {copy.backToTable}
            </button>
            <div className="mt-3 border-b border-line pb-2">
              <div className="truncate text-sm font-bold text-ink">
                {openRecord.kernel}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {formatParams(openRecord.params)}
              </div>
            </div>
            <TraceView key={pathKey(pathOf(openRecord))} record={openRecord} />
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse">
                {/* Stays put while the rows scroll under it. */}
                <thead className="sticky top-0 z-10 bg-paper">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className={`${LABEL} py-2 pr-4 text-left font-normal`}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="w-px py-2" />
                  </tr>
                  <tr className="border-b border-line">
                    {columns.map((column) => (
                      <td key={column.id} className="pb-2 pr-4 align-top">
                        {!hasRecords ? (
                          <Ghost className="w-full" />
                        ) : !activeKernel ? null : (
                          <FacetFilter
                            groups={groupsOf(column)}
                            tokens={facets[column.id] ?? []}
                            onChange={(tokens) =>
                              setFacets((prev) => ({
                                ...prev,
                                [column.id]: tokens,
                              }))
                            }
                            placeholder={copy.filterHint}
                            label={column.label}
                            showGroupLabels={column.id === "params"}
                          />
                        )}
                      </td>
                    ))}
                    <td className="w-px" />
                  </tr>
                </thead>
                {hasRecords ? (
                  <tbody>
                    {records.map((record) => (
                      <TraceRow
                        key={pathKey(pathOf(record))}
                        record={record}
                        columns={columns}
                        copy={copy}
                        lang={lang}
                        onOpen={() => setPickedRow(record)}
                      />
                    ))}
                  </tbody>
                ) : (
                  <GhostRows columns={columns} />
                )}
              </table>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <p className="text-sm text-muted">
                {!hasRecords
                  ? copy.skeletonNote
                  : activeKernel
                    ? copy.countLabel(records.length)
                    : null}
              </p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => setFacets({})}
                  className="text-xs text-accent transition-colors hover:text-accent-strong"
                >
                  {copy.clearFilters}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
