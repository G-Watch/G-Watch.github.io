"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLaneRows,
  formatTime,
  niceStep,
  usableLevels,
  type LaneLevel,
  type LaneRows,
  type TraceData,
} from "@/lib/trace-format";

/**
 * Intra-kernel trace panel: time on x, threads/warps/warpgroups on y.
 *
 * Rendered as a radiograph rather than a chart. A phase is exposure, not a
 * texture: each scope carries a fixed density, intervals are composited
 * additively, and wherever many lanes collapse into one row the accumulated
 * light is the density of work there. Bubbles stay at film black. That is what
 * makes a crowded region read as a smooth bright field instead of moiré.
 *
 * Vertical granularity follows the zoom: rows live in a normalised lane space,
 * so zooming in hands each row more pixels, and the finest level whose rows
 * still clear MIN_ROW_PX is the one drawn.
 */

const AXIS_H = 26; // time axis strip along the bottom
const AXIS_W = 54; // lane axis gutter on the left
const MIN_ROW_PX = 2.2; // below this a level is too dense to draw
const PAD_TOP = 8;

const FILM = "#fdfdfd"; // clear film
const GRID = "rgba(21,24,27,0.06)";
const TICK = "#6b7278";
const EDGE = "rgba(21,24,27,0.16)";

/** Absorption per scope: a spread of densities, faintest scope first. */
function density(index: number, count: number): number {
  if (count <= 1) return 1;
  return 0.34 + (0.66 * index) / (count - 1);
}

const inkAt = (alpha: number) => `rgba(21,24,27,${alpha.toFixed(3)})`;

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

export function TracePanel({ data }: { data: TraceData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({
    t0: 0,
    t1: data.span,
    v0: 0,
    v1: 1,
  });
  const [selection, setSelection] = useState<{ a: number; b: number } | null>(
    null,
  );
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
  const drag = useRef<
    | { kind: "pan"; x: number; y: number; view: View }
    | { kind: "select"; from: number }
    | null
  >(null);

  const levels = useMemo(() => usableLevels(data), [data]);
  const rowsByLevel = useMemo(() => {
    const map = new Map<LaneLevel, LaneRows>();
    for (const level of levels) map.set(level, buildLaneRows(data, level));
    return map;
  }, [data, levels]);

  const plotH = Math.max(0, size.h - AXIS_H - PAD_TOP);
  const plotW = Math.max(0, size.w - AXIS_W);

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
    // Absorption stacks: two overlapping intervals transmit the product of
    // their densities, so a crowded row goes dark the way thick material does.
    lc.globalCompositeOperation = "multiply";

    // Exposure normalisation: at coarse levels many lanes land on one row and
    // additive light would blow out. Dividing by that fold makes a fully
    // covered row reach exactly its scope's density, so brightness reads as
    // "how much of this group is in this phase" instead of saturating.
    const fold = Math.max(1, data.lanes.length / rows.count);
    const alphas = data.scopes.map(
      (_, i) => (density(i, data.scopes.length) / fold) * 1.25,
    );
    const scopeIndex = new Map(data.scopes.map((s, i) => [s.id, i]));
    const bandH = rowH * rows.span;
    const barH = bandH > 4 ? bandH - 1 : bandH;
    const firstRow = Math.floor(v0 * rows.count) - rows.span;
    const lastRow = Math.ceil(v1 * rows.count) + rows.span;
    const left = AXIS_W;
    const right = AXIS_W + plotW;

    for (const [lane, scope, start, dur] of data.intervals) {
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
      lc.fillStyle = inkAt(alphas[scopeIndex.get(scope) ?? 0]);
      lc.fillRect(clippedX, y, clippedW, Math.max(0.7, barH));
    }

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

    if (selection) {
      const a = xOf(Math.min(selection.a, selection.b));
      const b = xOf(Math.max(selection.a, selection.b));
      // Wash the exposure out while measuring, harder outside the span, so the
      // caliper and its numbers sit clear of the film underneath.
      ctx.fillStyle = "rgba(253,253,253,0.62)";
      ctx.fillRect(AXIS_W, PAD_TOP, a - AXIS_W, plotH);
      ctx.fillRect(b, PAD_TOP, AXIS_W + plotW - b, plotH);
      ctx.fillStyle = "rgba(253,253,253,0.30)";
      ctx.fillRect(a, PAD_TOP, b - a, plotH);
      ctx.fillStyle = MARK_FILL;
      ctx.fillRect(a, PAD_TOP, b - a, plotH);
      ctx.strokeStyle = MARK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(a) + 0.5, PAD_TOP);
      ctx.lineTo(Math.round(a) + 0.5, PAD_TOP + plotH);
      ctx.moveTo(Math.round(b) + 0.5, PAD_TOP);
      ctx.lineTo(Math.round(b) + 0.5, PAD_TOP + plotH);
      ctx.stroke();

      // caliper: the span reads on the selection itself, not off in a corner
      const label = formatTime(Math.abs(selection.b - selection.a), data.span);
      ctx.font =
        "11px var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, sans-serif";
      const textW = ctx.measureText(label).width;
      const chipW = textW + 10;
      const rule = PAD_TOP + 15;
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
  }, [data, view, size, rows, selection, cursor, hover, plotH, plotW]);

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
      // Browsers turn shift+wheel into horizontal scroll, so the amount can
      // arrive on either axis; and some report lines or pages, not pixels.
      const raw =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      const perUnit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(raw * perUnit * 0.0015);
      if (event.shiftKey || event.altKey) {
        const rect = canvas!.getBoundingClientRect();
        const y = clamp(
          event.clientY - rect.top - PAD_TOP,
          0,
          Math.max(plotH, 1),
        );
        const anchor = view.v0 + (y / Math.max(plotH, 1)) * (view.v1 - view.v0);
        zoomLanes(factor, anchor);
      } else {
        zoomTime(factor, toTime(event.clientX));
      }
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [toTime, zoomTime, zoomLanes, view, plotH]);

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
    const y = event.clientY - rect.top;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    // The axis strip selects a time range; the plot itself pans.
    if (y > PAD_TOP + plotH || event.shiftKey) {
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
    if (
      state?.kind === "pan" &&
      Math.abs(event.clientX - state.x) < 3 &&
      Math.abs(event.clientY - state.y) < 3
    ) {
      setCursor(toTime(event.clientX));
    }
  }

  function reset() {
    setView({ t0: 0, t1: data.span, v0: 0, v1: 1 });
    setSelection(null);
    setCursor(null);
  }

  const control =
    "h-6 rounded border border-line px-2 text-ink-soft transition-colors hover:border-muted/50 hover:text-ink";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-4 pb-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {data.scopes.map((scope, i) => (
            <span key={scope.id} className="flex items-center gap-1.5">
              <span
                className="block h-2.5 w-4 rounded-[1px] border border-line"
                style={{
                  backgroundColor: inkAt(density(i, data.scopes.length)),
                }}
                aria-hidden="true"
              />
              <span className="text-ink-soft">{scope.label}</span>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
            onClick={reset}
            aria-label="reset"
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
  );
}
