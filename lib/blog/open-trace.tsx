// User-owned: <OpenTrace trace="/traces/….json" caption="…" /> in a blog post.
// A server component, so the Open Traces catalog is read at build time and
// never ships to the browser: it finds the record behind the trace file, names
// it, and builds the link that opens the same row in the Open Traces browser.
// The drawing itself is the client TraceEmbed (lib/blog/trace-embed.tsx).
import { NAV_LEVELS, formatParams, openTraceRecords } from "@/lib/open-traces";
import { TraceEmbed } from "./trace-embed";

export function traceRecord(trace: string) {
  const record = openTraceRecords.find((r) => r.trace === trace);
  if (!record) throw new Error(`OpenTrace: no Open Traces record for ${trace}`);
  return record;
}

/** "b=2, s=1024, h=8" style shape, from the record's launch parameters. */
function shapeOf(params: Record<string, string | number>) {
  const pick = ["batch", "seqlen", "heads", "head_dim"]
    .filter((k) => k in params)
    .map((k) => `${k} ${params[k]}`);
  return pick.join(", ");
}

export function traceTitle(trace: string) {
  const r = traceRecord(trace);
  return {
    title: `${r.software} ${r.version} on ${r.meta?.GPU ?? r.arch}`,
    subtitle: `${shapeOf(r.params)}. Captured by Xtrace at the SASS level.`,
  };
}

/** "a, b, c" in MDX, since a prop there is easiest written as one string. */
export function phaseList(phases?: string) {
  return phases
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function OpenTrace({
  trace,
  caption,
  blocks,
  phases,
}: {
  trace: string;
  caption: string;
  /** Keep only the first N CTAs. */
  blocks?: number;
  /** Comma-separated scope labels to keep, in legend order. */
  phases?: string;
}) {
  const record = traceRecord(trace);
  const query = new URLSearchParams();
  for (const level of NAV_LEVELS) query.set(level, String(record[level]));
  query.set("kernel", record.kernel);
  query.set("params", formatParams(record.params));
  const { title, subtitle } = traceTitle(trace);
  return (
    <TraceEmbed
      src={trace}
      title={title}
      subtitle={subtitle}
      href={`/open-traces/?${query.toString()}`}
      caption={caption}
      blocks={blocks}
      phases={phaseList(phases)}
    />
  );
}
