"use client";

// User-owned: one Open Traces trace embedded in a blog post. The same
// TracePanel the Open Traces browser draws, in a fixed-height card, with a link
// to the full browser. The trace JSON is fetched only once the card nears the
// viewport, so a reader who never scrolls that far never downloads it.
// Wrapped by OpenTrace (lib/blog/open-trace.tsx), which resolves the record.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TracePanel } from "@/components/trace-panel";
import { localePath, resolveLocale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { normalizeTrace, type TraceData } from "@/lib/trace-format";

export function TraceEmbed({
  src,
  title,
  subtitle,
  href,
  caption,
  blocks,
  phases,
}: {
  src: string;
  title: string;
  subtitle: string;
  /** Locale-relative link into the Open Traces browser, query included. */
  href: string;
  caption: string;
  /** Keep only the first N CTAs, so each row can be one warp. */
  blocks?: number;
  /** Keep only these scopes (labels), in this order, one ink each. */
  phases?: string[];
}) {
  const params = useParams<{ lang?: string }>();
  const lang = resolveLocale(params?.lang);
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [data, setData] = useState<TraceData | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  // The panel takes every wheel event over it (the wheel pans and zooms), which
  // in the middle of an article would trap the page's own scrolling. A shield
  // sits over the plot until the reader clicks it, and comes back once the
  // pointer leaves, so scrolling past the trace always scrolls the page.
  const [active, setActive] = useState(false);

  useEffect(() => {
    // A plain distance check on scroll: cheap, and it runs in every browser
    // context, where an IntersectionObserver can sit idle in a throttled tab.
    const check = () => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      if (r.top < window.innerHeight + 600 && r.bottom > -600) {
        setNear(true);
        window.removeEventListener("scroll", check);
        window.removeEventListener("resize", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  useEffect(() => {
    if (!near) return;
    let live = true;
    fetch(withBasePath(src))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((raw) => {
        if (!live) return;
        const cut = slice(raw as RawTrace, blocks, phases);
        const parsed = normalizeTrace(cut.trace);
        setNote(cut.note);
        setData(parsed);
        setFailed(parsed === null);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // phases arrives as a fresh array each render; its contents are what count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, src, blocks, phases?.join(",")]);

  return (
    <figure className="not-prose my-10">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-paper sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{title}</p>
            <p className="text-xs text-muted">{subtitle}</p>
            {note && <p className="mt-1 text-xs text-muted">{note}</p>}
          </div>
          <Link
            href={localePath(lang, href)}
            className="flex-none rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Open in Open Traces →
          </Link>
        </div>
        <div
          ref={boxRef}
          className="relative h-[460px]"
          onPointerLeave={() => setActive(false)}
        >
          {data ? (
            <>
              <TracePanel data={data} stateKey={`blog:${src}`} />
              {!active && (
                <button
                  type="button"
                  onClick={() => setActive(true)}
                  className="group absolute inset-0 z-10 flex cursor-pointer items-end justify-center pb-10"
                  aria-label="Explore the trace"
                >
                  <span className="rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-paper opacity-0 shadow-paper transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Click to explore the trace
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">
              {failed ? "The trace could not be loaded." : "Loading the trace…"}
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm leading-relaxed text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

interface RawTrace {
  span: number;
  grid: number[];
  totalThreads: number;
  laneRepeat?: number;
  scopes: { id: number; label: string; role?: string }[];
  lanes: { tid: number; warp: number; wg: number; block: number }[];
  intervals: [number, number, number, number][];
  smDispatch?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * A readable slice of a trace: the first `blocks` CTAs and the `phases` scopes,
 * with lanes, scope ids and time re-based so the result is a trace of its own.
 */
function slice(raw: RawTrace, blocks?: number, phases?: string[]) {
  const lanes = raw.lanes
    .map((lane, i) => ({ lane, i }))
    .filter(({ lane }) => blocks == null || lane.block < blocks);
  const laneAt = new Map(lanes.map(({ i }, k) => [i, k]));
  const scopes = phases
    ? phases
        .map((label) => raw.scopes.find((s) => s.label === label))
        .filter((s): s is RawTrace["scopes"][number] => Boolean(s))
    : raw.scopes;
  const scopeAt = new Map(scopes.map((s, k) => [s.id, k]));
  const kept = raw.intervals.filter(
    ([lane, sid]) => laneAt.has(lane) && scopeAt.has(sid),
  );
  const t0 = kept.length ? Math.min(...kept.map((iv) => iv[2])) : 0;
  const intervals = kept.map(
    ([lane, sid, start, dur]) =>
      [laneAt.get(lane)!, scopeAt.get(sid)!, start - t0, dur] as const,
  );
  const span = Math.max(0, ...intervals.map((iv) => iv[2] + iv[3]));
  const nBlocks = new Set(lanes.map(({ lane }) => lane.block)).size;
  const totalBlocks = new Set(raw.lanes.map((l) => l.block)).size;
  const trace = {
    ...raw,
    span,
    grid: [nBlocks, 1, 1],
    totalThreads: lanes.length * (raw.laneRepeat ?? 1),
    scopes: scopes.map((s, k) => ({ ...s, id: k })),
    lanes: lanes.map(({ lane }) => lane),
    intervals,
    smDispatch: Object.fromEntries(
      Object.entries(raw.smDispatch ?? {}).filter(
        ([block]) => blocks == null || Number(block) < blocks,
      ),
    ),
  };
  const parts: string[] = [];
  if (nBlocks < totalBlocks) parts.push(`${nBlocks} of ${totalBlocks} CTAs`);
  if (scopes.length < raw.scopes.length)
    parts.push(`${scopes.length} of ${raw.scopes.length} phases`);
  const note = parts.length
    ? `Showing ${parts.join(" and ")}. The full trace is in Open Traces.`
    : "";
  return { trace, note };
}
