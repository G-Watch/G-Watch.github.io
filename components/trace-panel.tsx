"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLaneRows,
  formatTime,
  hasWarpRoles,
  laneRuns,
  niceStep,
  usableLevels,
  type LaneLevel,
  type LaneOrder,
  type LaneRows,
  type LaneRun,
  type TraceData,
  type TraceLane,
} from "@/lib/trace-format";

/**
 * Intra-kernel trace panel: time on x, threads/warps/warpgroups on y.
 *
 * Rendered as a chromatic print rather than a chart. Each scope carries one ink
 * from a fixed validated palette; intervals are composited multiplicatively, so
 * overlapping phases mix the way layered inks do and a crowded row saturates
 * toward its scope's hue. Bubbles stay at paper white.
 *
 * Vertical granularity follows the zoom: rows live in a normalised lane space,
 * so zooming in hands each row more pixels, and the finest level whose rows
 * still clear MIN_ROW_PX is the one drawn.
 */

const AXIS_H = 26; // time axis strip along the bottom
const AXIS_W = 54; // lane axis gutter on the left
const MIN_ROW_PX = 2.2; // below this a level is too dense to draw
const MIN_MARK_PX = 3; // a marked run thinner than this would vanish
const PAD_TOP = 8;

const FILM = "#fdfdfd"; // clear film
const GRID = "rgba(21,24,27,0.06)";
const TICK = "#6b7278";
const EDGE = "rgba(21,24,27,0.16)";

/**
 * Scope inks, assigned by scope order and never cycled: an artisanal print
 * palette validated for adjacent-pair CVD separation and >= 3:1 contrast on the
 * film surface. Scopes past the palette fold into neutral ink.
 */
const SCOPE_INKS: [number, number, number][] = [
  [13, 132, 166], // teal
  [192, 74, 44], // brick
  [77, 84, 184], // indigo
  [176, 128, 26], // ochre
  [0, 121, 90], // pine
  [192, 90, 155], // plum
  [125, 138, 31], // olive
];
const NEUTRAL_INK: [number, number, number] = [107, 114, 120];

const scopeRgb = (index: number) => SCOPE_INKS[index] ?? NEUTRAL_INK;

/** Exposure density: identity lives in the hue, so every scope prints equally. */
const DENSITY = 0.82;

const inkAt = (index: number, alpha: number) => {
  const [r, g, b] = scopeRgb(index);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
};

export const legendInk = (index: number) => {
  const [r, g, b] = scopeRgb(index);
  return `rgb(${r},${g},${b})`;
};

/**
 * Legend groups: consecutive-by-first-appearance buckets of scopes sharing a
 * warp role. The scope's palette index is carried so grouping never recolors.
 */
export function groupScopesByRole(scopes: TraceData["scopes"]) {
  const groups: {
    role?: string;
    entries: { scope: TraceData["scopes"][number]; index: number }[];
  }[] = [];
  const byRole = new Map<string | undefined, number>();
  scopes.forEach((scope, index) => {
    let at = byRole.get(scope.role);
    if (at === undefined) {
      at = groups.length;
      byRole.set(scope.role, at);
      groups.push({ role: scope.role, entries: [] });
    }
    groups[at].entries.push({ scope, index });
  });
  return groups;
}

// The measurement layer — cursor, selection, hover — is the one place colour is
// allowed: the exposure stays greyscale, the tools sit on top of it.
const MARK = "#0f7d8c";
const MARK_FILL = "rgba(15,125,140,0.13)";

interface View {
  /** Time window in ns. */
  t0: number;
  t1: number;
  /** Lane window in normalised [0,1] lane space. */
  v0: number;
  v1: number;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** A tile of film grain, tiled over the exposure. */
function makeGrain(): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = 96;
  tile.height = 96;
  const ctx = tile.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(96, 96);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  return tile;
}

export function TracePanel({
  data,
  focus,
}: {
  data: TraceData;
  /** A block picked elsewhere (the SM dispatching grid); a fresh object re-zooms. */
  focus?: { block: number } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const scopeLayerRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  // Lanes bucket by warp role by default — that is the reading a
  // warp-specialized kernel asks for. Turning it off gives the plain hardware
  // order, thread id ascending. Offered only when there is more than one role.
  const roleGroupable = useMemo(() => hasWarpRoles(data), [data]);
  const [groupByRole, setGroupByRole] = useState(true);
  const laneOrder: LaneOrder = roleGroupable && groupByRole ? "role" : "tid";

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);
  const [view, setView] = useState<View>({
    t0: 0,
    t1: data.span,
    v0: 0,
    v1: 1,
  });

  const [selection, setSelection] = useState<{ a: number; b: number } | null>(
    null,
  );
  // Lane selection in normalised [0,1] lane space, zoom-independent like time.
  // A drag leaves one run; a picked block leaves one per warp role, since role
  // grouping cuts its threads into a band apiece. Runs are ordered and disjoint.
  const [laneSel, setLaneSel] = useState<LaneRun[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    scope: number;
    lane: number;
    row: number;
    start: number;
    dur: number;
  } | null>(null);

  // an externally picked block zooms the lane axis onto its lanes and marks each
  // run of them, so the block reads as its bands with the thread ranges named
  // on the calipers. The time span stays whole.
  //
  // The block stays marked when the lane order changes: its runs are re-read in
  // the new order, so role grouping shows it as one band per warp role rather
  // than as a single span that would swallow most of the launch. A *fresh* pick
  // additionally drops to thread-id order, where a block is the one contiguous
  // interval it really is and the zoom can be tight; merely flipping the toggle
  // does not, or the toggle and the block would fight over it.
  const pickedFocus = useRef<typeof focus>(null);
  useEffect(() => {
    if (!focus) return;
    const fresh = pickedFocus.current !== focus;
    pickedFocus.current = focus;
    const isBlock = (lane: TraceLane) => lane.block === focus.block;
    let runs = laneRuns(data, laneOrder, isBlock);
    if (fresh && runs.length > 1) {
      const whole = laneRuns(data, "tid", isBlock);
      if (whole.length === 1) {
        setGroupByRole(false);
        runs = whole;
      }
    }
    if (!runs.length) return;
    // a margin of a quarter of the marked span on each side keeps the calipers
    // off the plot edge and leaves the neighbouring blocks visible for scale
    const from = runs[0].a;
    const to = runs[runs.length - 1].b;
    const margin = (to - from) / 4;
    setLaneSel(runs);
    setView({
      t0: 0,
      t1: data.span,
      v0: Math.max(0, from - margin),
      v1: Math.min(1, to + margin),
    });
  }, [focus, data, laneOrder]);
  const drag = useRef<
    | { kind: "pan"; x: number; y: number; view: View }
    | { kind: "select"; from: number }
    | { kind: "vselect"; from: number }
    | null
  >(null);

  const levels = useMemo(() => usableLevels(data), [data]);
  const rowsByLevel = useMemo(() => {
    const map = new Map<LaneLevel, LaneRows>();
    for (const level of levels) {
      map.set(level, buildLaneRows(data, level, laneOrder));
    }
    return map;
  }, [data, levels, laneOrder]);

  const plotH = Math.max(0, size.h - AXIS_H - PAD_TOP);
  const plotW = Math.max(0, size.w - AXIS_W);

  // Intervals bucketed by scope, so the draw makes one print pass per scope.
  const intervalsByScope = useMemo(() => {
    const buckets = new Map<number, TraceData["intervals"]>();
    for (const interval of data.intervals) {
      const bucket = buckets.get(interval[1]);
      if (bucket) bucket.push(interval);
      else buckets.set(interval[1], [interval]);
    }
    return buckets;
  }, [data]);

  // The finest level whose rows still clear MIN_ROW_PX at this zoom.
  const rows = useMemo(() => {
    const span = Math.max(view.v1 - view.v0, 1e-6);
    for (const level of levels) {
      const candidate = rowsByLevel.get(level);
      if (!candidate) continue;
      if (plotH / (span * candidate.count) >= MIN_ROW_PX) return candidate;
    }
    return rowsByLevel.get(levels[levels.length - 1]) as LaneRows;
  }, [levels, rowsByLevel, plotH, view.v0, view.v1]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = (w: number, h: number) =>
      setSize((prev) =>
        prev.w === Math.floor(w) && prev.h === Math.floor(h)
          ? prev
          : { w: Math.floor(w), h: Math.floor(h) },
      );
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(element);
    // First paint may land before the observer reports, so measure once too.
    const frame = requestAnimationFrame(() => {
      const box = element.getBoundingClientRect();
      measure(box.width, box.height);
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  /* ---------------------------------------------------------------- draw */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = FILM;
    ctx.fillRect(0, 0, size.w, size.h);

    const { t0, t1, v0, v1 } = view;
    const tSpan = Math.max(t1 - t0, 1e-6);
    const vSpan = Math.max(v1 - v0, 1e-9);
    const rowH = plotH / (vSpan * rows.count);
    const xOf = (t: number) => AXIS_W + ((t - t0) / tSpan) * plotW;
    const yOf = (row: number) =>
      PAD_TOP + ((row / rows.count - v0) / vSpan) * plotH;

    // exposure layer: intervals accumulate here, then get composited back
    let layer = layerRef.current;
    if (!layer) {
      layer = document.createElement("canvas");
      layerRef.current = layer;
    }
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lc = layer.getContext("2d");
    if (!lc) return;
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    lc.clearRect(0, 0, size.w, size.h);
    lc.fillStyle = FILM;
    lc.fillRect(AXIS_W, PAD_TOP, plotW, plotH);
    lc.strokeStyle = GRID;
    lc.lineWidth = 1;
    lc.beginPath();
    const grid = niceStep(Math.max(t1 - t0, 1e-6) / 8);
    for (let t = Math.ceil(t0 / grid) * grid; t <= t1; t += grid) {
      const x = Math.round(AXIS_W + ((t - t0) / (t1 - t0)) * plotW) + 0.5;
      lc.moveTo(x, PAD_TOP);
      lc.lineTo(x, PAD_TOP + plotH);
    }
    lc.stroke();
    // One print pass per scope: the scope's intervals accumulate translucent
    // SAME-HUE ink on a scratch layer (self-overlap deepens, never shifts hue,
    // so a folded row reads as coverage in the legend's own colour), then the
    // whole pass composites multiplicatively — only different scopes mix inks.
    let scopeLayer = scopeLayerRef.current;
    if (!scopeLayer) {
      scopeLayer = document.createElement("canvas");
      scopeLayerRef.current = scopeLayer;
    }
    scopeLayer.width = canvas.width;
    scopeLayer.height = canvas.height;
    const sc = scopeLayer.getContext("2d");
    if (!sc) return;
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Exposure normalisation: at coarse levels many lanes land on one row; the
    // per-interval alpha makes a fully folded row saturate to the pure hue,
    // and the pass alpha sets the scope's print density.
    const fold = Math.max(1, data.lanes.length / rows.count);
    const stampAlpha = Math.min(1, 1.25 / fold);
    const scopeIndex = new Map(data.scopes.map((s, i) => [s.id, i]));
    const bandH = rowH * rows.span;
    const barH = bandH > 4 ? bandH - 1 : bandH;
    const firstRow = Math.floor(v0 * rows.count) - rows.span;
    const lastRow = Math.ceil(v1 * rows.count) + rows.span;
    const left = AXIS_W;
    const right = AXIS_W + plotW;

    for (const [scopeId, list] of intervalsByScope) {
      const si = scopeIndex.get(scopeId) ?? 0;
      sc.clearRect(0, 0, size.w, size.h);
      sc.fillStyle = inkAt(si, stampAlpha);
      for (const [lane, , start, dur] of list) {
        if (start > t1 || start + dur < t0) continue;
        const row = rows.rowOf[lane];
        if (row < firstRow || row > lastRow) continue;
        const x = xOf(start);
        const w = Math.max(0.5, (dur / tSpan) * plotW);
        if (x > right || x + w < left) continue;
        const y = yOf(row);
        if (y + barH < PAD_TOP || y > PAD_TOP + plotH) continue;
        const clippedX = Math.max(x, left);
        const clippedW = Math.min(x + w, right) - clippedX;
        sc.fillRect(clippedX, y, clippedW, Math.max(0.7, barH));
      }
      lc.globalCompositeOperation = "multiply";
      lc.globalAlpha = DENSITY;
      lc.drawImage(scopeLayer, 0, 0, size.w, size.h);
    }
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = "source-over";

    // bloom, then the sharp exposure over it
    ctx.save();
    ctx.beginPath();
    ctx.rect(AXIS_W, PAD_TOP, plotW, plotH);
    ctx.clip();

    const step = niceStep(tSpan / 8);
    ctx.drawImage(layer, 0, 0, size.w, size.h);
    // a soft halo around dense regions, the way a print bleeds
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.32;
    ctx.filter = "blur(3px)";
    ctx.drawImage(layer, 0, 0, size.w, size.h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // film grain
    if (!grainRef.current) grainRef.current = makeGrain();
    const grain = grainRef.current;
    if (grain) {
      const pattern = ctx.createPattern(grain, "repeat");
      if (pattern) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = pattern;
        ctx.fillRect(AXIS_W, PAD_TOP, plotW, plotH);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    // Runs to mark down the lane axis; none means the whole plot is the band,
    // which is what a time selection on its own wants.
    const marked = laneSel?.length ? laneSel : null;

    if (selection || marked) {
      // A missing axis spans the whole plot, so one selection is a band and
      // two are an intersection rectangle.
      const a = selection ? xOf(Math.min(selection.a, selection.b)) : AXIS_W;
      const b = selection
        ? xOf(Math.max(selection.a, selection.b))
        : AXIS_W + plotW;
      const yFracOf = (f: number) => PAD_TOP + ((f - v0) / vSpan) * plotH;
      // A block's runs under role grouping are a couple of hundred lanes each
      // inside a window spanning most of the axis, so drawn honestly they come
      // out a pixel tall and vanish. Each run gets a visible minimum, and runs
      // pushed into each other by it merge, which keeps them ordered and
      // disjoint for the wash below. The lane count stays read off the data.
      const bands: { y0: number; y1: number }[] = [];
      for (const run of marked ?? [{ a: v0, b: v1 }]) {
        let y0 = yFracOf(run.a);
        let y1 = yFracOf(run.b);
        if (y1 - y0 < MIN_MARK_PX) {
          const mid = (y0 + y1) / 2;
          y0 = mid - MIN_MARK_PX / 2;
          y1 = mid + MIN_MARK_PX / 2;
        }
        const last = bands[bands.length - 1];
        if (last && y0 <= last.y1) last.y1 = Math.max(last.y1, y1);
        else bands.push({ y0, y1 });
      }
      const ya = bands[0].y0;

      // Wash the exposure out while measuring, harder outside the marked runs
      // and in the gaps between them, so the calipers and their numbers sit
      // clear of the film.
      ctx.fillStyle = "rgba(253,253,253,0.62)";
      ctx.fillRect(AXIS_W, PAD_TOP, a - AXIS_W, plotH);
      ctx.fillRect(b, PAD_TOP, AXIS_W + plotW - b, plotH);
      let gap = PAD_TOP;
      for (const band of bands) {
        if (band.y0 > gap) ctx.fillRect(a, gap, b - a, band.y0 - gap);
        gap = Math.max(gap, band.y1);
      }
      if (gap < PAD_TOP + plotH) {
        ctx.fillRect(a, gap, b - a, PAD_TOP + plotH - gap);
      }
      for (const band of bands) {
        ctx.fillStyle = "rgba(253,253,253,0.30)";
        ctx.fillRect(a, band.y0, b - a, band.y1 - band.y0);
        ctx.fillStyle = MARK_FILL;
        ctx.fillRect(a, band.y0, b - a, band.y1 - band.y0);
      }
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (selection) {
        ctx.moveTo(Math.round(a) + 0.5, PAD_TOP);
        ctx.lineTo(Math.round(a) + 0.5, PAD_TOP + plotH);
        ctx.moveTo(Math.round(b) + 0.5, PAD_TOP);
        ctx.lineTo(Math.round(b) + 0.5, PAD_TOP + plotH);
      }
      if (marked) {
        for (const band of bands) {
          ctx.moveTo(AXIS_W, Math.round(band.y0) + 0.5);
          ctx.lineTo(AXIS_W + plotW, Math.round(band.y0) + 0.5);
          ctx.moveTo(AXIS_W, Math.round(band.y1) + 0.5);
          ctx.lineTo(AXIS_W + plotW, Math.round(band.y1) + 0.5);
        }
      }
      ctx.stroke();

      ctx.font =
        "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";

      if (selection) {
        // caliper: the span reads on the selection itself, not off in a corner
        const label = formatTime(
          Math.abs(selection.b - selection.a),
          data.span,
        );
        const textW = ctx.measureText(label).width;
        const chipW = textW + 10;
        const rule = ya + 15;
        const inside = b - a > chipW + 14;
        const chipX = inside
          ? (a + b) / 2 - chipW / 2
          : Math.min(b + 6, AXIS_W + plotW - chipW - 2);

        ctx.strokeStyle = MARK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a, rule - 4);
        ctx.lineTo(a, rule + 4);
        ctx.moveTo(b, rule - 4);
        ctx.lineTo(b, rule + 4);
        if (inside) {
          ctx.moveTo(a, rule);
          ctx.lineTo(chipX - 4, rule);
          ctx.moveTo(chipX + chipW + 4, rule);
          ctx.lineTo(b, rule);
        } else {
          ctx.moveTo(a, rule);
          ctx.lineTo(b, rule);
        }
        ctx.stroke();

        ctx.fillStyle = MARK;
        ctx.fillRect(chipX, rule - 8, chipW, 16);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, chipX + chipW / 2, rule + 0.5);
        ctx.textBaseline = "top";
      }

      if (marked) {
        // lane caliper: same idiom rotated. Every run gets bracketed; the count
        // is the whole selection's and reads on the tallest run, so a block
        // split across the role bands still states its size once.
        const lanes = Math.max(
          1,
          Math.round(
            marked.reduce((sum, run) => sum + (run.b - run.a), 0) *
              data.lanes.length,
          ),
        );
        const label = `${lanes} ${lanes === 1 ? "lane" : "lanes"}`;
        const chipW = ctx.measureText(label).width + 10;
        const rule = a + 15;
        let tallest = bands[0];
        for (const band of bands) {
          if (band.y1 - band.y0 > tallest.y1 - tallest.y0) tallest = band;
        }
        const inside = tallest.y1 - tallest.y0 > 16 + 14;
        const chipY = inside
          ? (tallest.y0 + tallest.y1) / 2
          : Math.min(tallest.y1 + 14, PAD_TOP + plotH - 10);
        const chipX = clamp(
          rule - chipW / 2,
          AXIS_W + 2,
          AXIS_W + plotW - chipW - 2,
        );

        ctx.strokeStyle = MARK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const band of bands) {
          ctx.moveTo(rule - 4, band.y0);
          ctx.lineTo(rule + 4, band.y0);
          ctx.moveTo(rule - 4, band.y1);
          ctx.lineTo(rule + 4, band.y1);
          if (band === tallest && inside) {
            ctx.moveTo(rule, band.y0);
            ctx.lineTo(rule, chipY - 12);
            ctx.moveTo(rule, chipY + 12);
            ctx.lineTo(rule, band.y1);
          } else {
            ctx.moveTo(rule, band.y0);
            ctx.lineTo(rule, band.y1);
          }
        }
        ctx.stroke();

        ctx.fillStyle = MARK;
        ctx.fillRect(chipX, chipY - 8, chipW, 16);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, chipX + chipW / 2, chipY + 0.5);
        ctx.textBaseline = "top";
      }
    }

    if (hover) {
      const x = xOf(hover.start);
      const w = Math.max(1.5, (hover.dur / tSpan) * plotW);
      const y = yOf(rows.rowOf[hover.lane]);
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, Math.max(2, barH));
    }

    if (cursor !== null) {
      const x = Math.round(xOf(cursor)) + 0.5;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + plotH);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(AXIS_W + 0.5, PAD_TOP + 0.5, plotW - 1, plotH - 1);

    // time axis
    ctx.fillStyle = TICK;
    ctx.font =
      "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "top";
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const x = xOf(t);
      if (x < AXIS_W - 1 || x > right + 1) continue;
      ctx.strokeStyle = EDGE;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, PAD_TOP + plotH);
      ctx.lineTo(Math.round(x) + 0.5, PAD_TOP + plotH + 4);
      ctx.stroke();
      ctx.textAlign =
        x < AXIS_W + 24 ? "left" : x > right - 24 ? "right" : "center";
      ctx.fillText(formatTime(t, data.span), x, PAD_TOP + plotH + 6);
    }

    if (selection) {
      ctx.font =
        "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "top";
      for (const edge of [
        Math.min(selection.a, selection.b),
        Math.max(selection.a, selection.b),
      ]) {
        const x = xOf(edge);
        if (x < AXIS_W || x > right) continue;
        const label = formatTime(edge, data.span);
        const w = ctx.measureText(label).width + 8;
        const bx = clamp(x - w / 2, AXIS_W, right - w);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bx, PAD_TOP + plotH + 4, w, 15);
        ctx.strokeStyle = MARK;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, PAD_TOP + plotH + 4.5, w - 1, 14);
        ctx.fillStyle = MARK;
        ctx.textAlign = "center";
        ctx.fillText(label, bx + w / 2, PAD_TOP + plotH + 6);
      }
    }

    if (cursor !== null) {
      const x = xOf(cursor);
      if (x >= AXIS_W && x <= right) {
        const label = formatTime(cursor, data.span);
        ctx.font =
          "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = MARK;
        ctx.fillRect(
          clamp(x - w / 2, AXIS_W, right - w),
          PAD_TOP + plotH + 4,
          w,
          15,
        );
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(
          label,
          clamp(x, AXIS_W + w / 2, right - w / 2),
          PAD_TOP + plotH + 6,
        );
      }
    }

    if (marked) {
      ctx.font =
        "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      // edge rows are inclusive: a run's upper edge names its first row, its
      // lower edge its last one. Runs are ordered, so the labels come out top
      // to bottom and one that would land on the previous is dropped rather
      // than stacked on it.
      const edges: [number, number][] = [];
      for (const run of marked) {
        edges.push([
          run.a,
          clamp(Math.floor(run.a * rows.count), 0, rows.count - 1),
        ]);
        edges.push([
          run.b,
          clamp(Math.ceil(run.b * rows.count) - 1, 0, rows.count - 1),
        ]);
      }
      let lastY = -Infinity;
      for (const [frac, row] of edges) {
        const y = PAD_TOP + ((frac - v0) / vSpan) * plotH;
        if (y < PAD_TOP || y > PAD_TOP + plotH) continue;
        if (y - lastY < 16) continue;
        lastY = y;
        const label = rows.label(row);
        const w = ctx.measureText(label).width + 8;
        const by = clamp(y - 7, PAD_TOP, PAD_TOP + plotH - 15);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(AXIS_W - w - 4, by, w, 15);
        ctx.strokeStyle = MARK;
        ctx.lineWidth = 1;
        ctx.strokeRect(AXIS_W - w - 3.5, by + 0.5, w - 1, 14);
        ctx.fillStyle = MARK;
        ctx.textAlign = "center";
        ctx.fillText(label, AXIS_W - 4 - w / 2, by + 8);
      }
      ctx.textBaseline = "top";
    }

    // lane axis
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const labelEvery = Math.max(1, Math.ceil(16 / Math.max(rowH, 0.001)));
    for (
      let row = Math.max(0, firstRow);
      row <= Math.min(rows.count - 1, lastRow);
      row++
    ) {
      if (row % labelEvery !== 0) continue;
      const y = yOf(row) + Math.min(rowH, 12) / 2;
      if (y < PAD_TOP + 4 || y > PAD_TOP + plotH - 2) continue;
      ctx.fillStyle = TICK;
      ctx.fillText(rows.label(row), AXIS_W - 8, y);
    }
  }, [data, intervalsByScope, view, size, rows, selection, laneSel, cursor, hover, plotH, plotW]);

  /* ----------------------------------------------------------- interaction */
  const toTime = useCallback(
    (clientX: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return view.t0;
      const x = clamp(clientX - rect.left - AXIS_W, 0, Math.max(plotW, 1));
      return view.t0 + (x / Math.max(plotW, 1)) * (view.t1 - view.t0);
    },
    [view, plotW],
  );

  const toLaneFrac = useCallback(
    (clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return view.v0;
      const y = clamp(clientY - rect.top - PAD_TOP, 0, Math.max(plotH, 1));
      return view.v0 + (y / Math.max(plotH, 1)) * (view.v1 - view.v0);
    },
    [view, plotH],
  );

  const zoomTime = useCallback(
    (factor: number, anchor: number) => {
      setView((prev) => {
        const span = (prev.t1 - prev.t0) * factor;
        const min = Math.max(data.span / 5e5, 1);
        const clamped = clamp(span, min, data.span);
        const ratio = (anchor - prev.t0) / Math.max(prev.t1 - prev.t0, 1e-9);
        let t0 = anchor - ratio * clamped;
        t0 = clamp(t0, 0, data.span - clamped);
        return { ...prev, t0, t1: t0 + clamped };
      });
    },
    [data.span],
  );

  const zoomLanes = useCallback((factor: number, anchor: number) => {
    setView((prev) => {
      const span = clamp((prev.v1 - prev.v0) * factor, 1 / 4096, 1);
      const ratio = (anchor - prev.v0) / Math.max(prev.v1 - prev.v0, 1e-9);
      let v0 = anchor - ratio * span;
      v0 = clamp(v0, 0, 1 - span);
      return { ...prev, v0, v1: v0 + span };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      // Some devices report lines or pages, not pixels.
      const perUnit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const dy = event.deltaY * perUnit;
      const dx = event.deltaX * perUnit;

      // cmd+wheel zooms time, option+wheel zooms lanes, a bare wheel pans:
      // vertically through the lanes, horizontally along the time axis.
      if (event.metaKey || event.ctrlKey) {
        zoomTime(Math.exp(dy * 0.0015), toTime(event.clientX));
        return;
      }
      if (event.altKey) {
        const rect = canvas!.getBoundingClientRect();
        const y = clamp(
          event.clientY - rect.top - PAD_TOP,
          0,
          Math.max(plotH, 1),
        );
        const anchor = view.v0 + (y / Math.max(plotH, 1)) * (view.v1 - view.v0);
        zoomLanes(Math.exp(dy * 0.0015), anchor);
        return;
      }
      setView((prev) => {
        const vSpan = prev.v1 - prev.v0;
        const dv = clamp(
          (dy / Math.max(plotH, 1)) * vSpan,
          -prev.v0,
          1 - prev.v1,
        );
        const tSpan = prev.t1 - prev.t0;
        const dt = clamp(
          (dx / Math.max(plotW, 1)) * tSpan,
          -prev.t0,
          data.span - prev.t1,
        );
        return {
          t0: prev.t0 + dt,
          t1: prev.t1 + dt,
          v0: prev.v0 + dv,
          v1: prev.v1 + dv,
        };
      });
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [toTime, zoomTime, zoomLanes, view, plotH, plotW, data.span]);

  /** The interval under the pointer, or null over film. */
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || plotW <= 0 || plotH <= 0) return null;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      if (px < AXIS_W || py < PAD_TOP || py > PAD_TOP + plotH) return null;
      const t = view.t0 + ((px - AXIS_W) / plotW) * (view.t1 - view.t0);
      const row = Math.floor(
        (view.v0 + ((py - PAD_TOP) / plotH) * (view.v1 - view.v0)) * rows.count,
      );
      for (const [lane, scope, start, dur] of data.intervals) {
        const top = rows.rowOf[lane];
        if (row < top || row >= top + rows.span) continue;
        if (t >= start && t <= start + dur) {
          return { x: px, y: py, scope, lane, row, start, dur };
        }
      }
      return null;
    },
    [data.intervals, rows, view, plotW, plotH],
  );

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    // The bottom axis strip selects a time range, the lane gutter a lane
    // range; the plot itself pans.
    if (x < AXIS_W && y <= PAD_TOP + plotH) {
      const from = toLaneFrac(event.clientY);
      drag.current = { kind: "vselect", from };
      setLaneSel([{ a: from, b: from }]);
    } else if (y > PAD_TOP + plotH || event.shiftKey) {
      const from = toTime(event.clientX);
      drag.current = { kind: "select", from };
      setSelection({ a: from, b: from });
    } else {
      drag.current = {
        kind: "pan",
        x: event.clientX,
        y: event.clientY,
        view: { ...view },
      };
    }
  }

  function onPointerLeave() {
    setHover(null);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const state = drag.current;
    if (!state) {
      setHover(hitTest(event.clientX, event.clientY));
      return;
    }
    if (state.kind === "select") {
      setSelection({ a: state.from, b: toTime(event.clientX) });
      return;
    }
    if (state.kind === "vselect") {
      const to = toLaneFrac(event.clientY);
      setLaneSel([{ a: Math.min(state.from, to), b: Math.max(state.from, to) }]);
      return;
    }
    const tPerPx = (state.view.t1 - state.view.t0) / Math.max(plotW, 1);
    const vPerPx = (state.view.v1 - state.view.v0) / Math.max(plotH, 1);
    const dt = (event.clientX - state.x) * tPerPx;
    const dv = (event.clientY - state.y) * vPerPx;
    const tSpan = state.view.t1 - state.view.t0;
    const vSpan = state.view.v1 - state.view.v0;
    const t0 = clamp(state.view.t0 - dt, 0, data.span - tSpan);
    const v0 = clamp(state.view.v0 - dv, 0, 1 - vSpan);
    setView({ t0, t1: t0 + tSpan, v0, v1: v0 + vSpan });
  }

  function endDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    const state = drag.current;
    drag.current = null;
    // A degenerate axis drag leaves no band behind.
    if (state?.kind === "select" && selection) {
      const px =
        (Math.abs(selection.b - selection.a) /
          Math.max(view.t1 - view.t0, 1e-9)) *
        plotW;
      if (px < 3) setSelection(null);
      return;
    }
    if (state?.kind === "vselect" && laneSel?.length === 1) {
      const run = laneSel[0];
      const px =
        ((run.b - run.a) / Math.max(view.v1 - view.v0, 1e-9)) * plotH;
      if (px < 3) setLaneSel(null);
      return;
    }
    if (
      state?.kind === "pan" &&
      Math.abs(event.clientX - state.x) < 3 &&
      Math.abs(event.clientY - state.y) < 3
    ) {
      // A click outside the selected region clears the selection; inside it,
      // or with none held, the click places the time cursor.
      if (selection || laneSel?.length) {
        const t = toTime(event.clientX);
        const f = toLaneFrac(event.clientY);
        const inT =
          !selection ||
          (t >= Math.min(selection.a, selection.b) &&
            t <= Math.max(selection.a, selection.b));
        // inside any marked run counts as inside
        const inF =
          !laneSel?.length ||
          laneSel.some((run) => f >= run.a && f <= run.b);
        if (!(inT && inF)) {
          setSelection(null);
          setLaneSel(null);
          return;
        }
      }
      setCursor(toTime(event.clientX));
    }
  }

  function toggleGroupByRole() {
    setGroupByRole((on) => !on);
    // The axis re-sorts, so a hand-dragged band no longer names the same lanes:
    // a run that is contiguous in one order is scattered in the other. Drop it
    // and hand back the whole axis, keeping the time window, which still means
    // what it did. A picked block is re-marked run by run by its own effect.
    setView((v) => ({ ...v, v0: 0, v1: 1 }));
    setLaneSel(null);
    setHover(null);
  }

  function reset() {
    setView({ t0: 0, t1: data.span, v0: 0, v1: 1 });
    setSelection(null);
    setLaneSel(null);
    setCursor(null);
  }

  const control =
    "h-6 rounded border border-line px-2 text-ink-soft transition-colors hover:border-muted/50 hover:text-ink";

  return (
    <>
      {fullscreen && (
        <div
          className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
          aria-hidden="true"
        />
      )}
      {fullscreen && (
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          aria-label="exit fullscreen"
          className="fixed right-[calc(8vw+0.5rem)] top-[calc(9vh+0.4rem)] z-50 h-6 w-6 rounded border border-line bg-surface text-sm text-ink-soft transition-colors hover:border-muted/50 hover:text-ink"
        >
          ×
        </button>
      )}
      {/* The same node in both modes, so the canvas subtree never remounts:
          fullscreen only swaps the container's classes and lets the resize
          observer refit the plot to the lightbox. */}
      <div
        className={
          fullscreen
            ? "fixed left-1/2 top-1/2 z-50 flex h-[82vh] w-[84vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface p-4 pt-8 shadow-paper"
            : "flex h-full min-h-0 flex-col"
        }
      >
      <div className="flex items-center justify-between gap-4 pb-2 text-xs text-muted">
        <div className="flex flex-col gap-y-1">
          {groupScopesByRole(data.scopes).map((group) => (
            <span
              key={group.role ?? "\u0000ungrouped"}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5"
            >
              {group.role && (
                <span className="font-medium text-muted/80">{group.role}</span>
              )}
              {group.entries.map(({ scope, index }) => (
                <span key={scope.id} className="flex items-center gap-1.5">
                  <span
                    className="block h-2.5 w-4 rounded-[1px] border border-line"
                    style={{ backgroundColor: legendInk(index) }}
                    aria-hidden="true"
                  />
                  <span className="text-ink-soft">{scope.label}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {roleGroupable && (
            <button
              type="button"
              role="switch"
              aria-checked={groupByRole}
              onClick={toggleGroupByRole}
              title={
                groupByRole
                  ? "Lanes are bucketed by warp role; click for thread-id order"
                  : "Lanes are in thread-id order; click to bucket them by warp role"
              }
              className={`mr-1 inline-flex h-6 items-center gap-1.5 rounded border px-2 transition-colors ${
                groupByRole
                  ? "border-muted/50 text-ink"
                  : "border-line text-ink-soft hover:border-muted/50 hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-3 w-3 shrink-0 place-items-center rounded-[2px] border ${
                  groupByRole ? "border-ink bg-ink" : "border-line"
                }`}
              >
                {groupByRole && (
                  <svg
                    viewBox="0 0 10 10"
                    className="h-2 w-2"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 5.2 4.2 7.4 8 2.8" />
                  </svg>
                )}
              </span>
              Group by warp role
            </button>
          )}
          <span className="pr-2">
            {rows.level}
            {data.lanes.length * Math.max(1, data.laneRepeat) <
              data.totalThreads && (
              <span className="pl-1 text-muted/70">
                {`· 1/${data.sampledEvery} sampled`}
              </span>
            )}
          </span>
          <span className="px-1 text-[11px]" aria-hidden="true">
            ↔
          </span>
          <button
            type="button"
            onClick={() => zoomTime(1.6, (view.t0 + view.t1) / 2)}
            aria-label="zoom out, time"
            className={`${control} w-6 px-0`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomTime(0.625, (view.t0 + view.t1) / 2)}
            aria-label="zoom in, time"
            className={`${control} w-6 px-0`}
          >
            +
          </button>
          <span className="pl-2 pr-1 text-[11px]" aria-hidden="true">
            ↕
          </span>
          <button
            type="button"
            onClick={() => zoomLanes(1.6, (view.v0 + view.v1) / 2)}
            aria-label="zoom out, lanes"
            className={`${control} w-6 px-0`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomLanes(0.625, (view.v0 + view.v1) / 2)}
            aria-label="zoom in, lanes"
            className={`${control} w-6 px-0`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="fullscreen"
            className={`${control} ml-1`}
          >
            ⤢
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h }}
          className="block touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={onPointerLeave}
          onDoubleClick={reset}
        />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded border border-line bg-surface/95 px-2 py-1 text-xs shadow-paper"
            style={{
              left: clamp(hover.x + 12, 0, Math.max(size.w - 200, 0)),
              top: clamp(hover.y + 12, 0, Math.max(size.h - 130, 0)),
            }}
          >
            <div className="font-bold text-ink">
              {data.scopes.find((s) => s.id === hover.scope)?.label ?? ""}
            </div>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-ink-soft">
              <dt className="text-muted">Thread</dt>
              <dd>
                {data.lanes[hover.lane]
                  ? data.lanes[hover.lane].tid +
                    (hover.row - rows.rowOf[hover.lane])
                  : "—"}
              </dd>
              <dt className="text-muted">Warp</dt>
              <dd>{data.lanes[hover.lane]?.warp ?? "—"}</dd>
              <dt className="text-muted">Warpgroup</dt>
              <dd>{data.lanes[hover.lane]?.wg ?? "—"}</dd>
              <dt className="text-muted">Block</dt>
              <dd>{data.lanes[hover.lane]?.block ?? "—"}</dd>
              <dt className="text-muted">Start</dt>
              <dd>{formatTime(hover.start, data.span)}</dd>
              <dt className="text-muted">Duration</dt>
              <dd className="font-bold text-ink">
                {formatTime(hover.dur, data.span)}
              </dd>
            </dl>
          </div>
        )}
      </div>
      </div>
    </>
  );
}