"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sourceHref } from "@/lib/arch";
import { getArchCopy } from "@/lib/arch/copy";
import { chipLabel, layoutLayer, layoutOverview } from "@/lib/arch/layout";
import { outputOf, splice } from "@/lib/arch/splice";
import type { ArchChain, ArchLayerType, ArchModel } from "@/lib/arch/types";
import type { HfModelSnapshot } from "@/lib/hf-model";
import type { Locale } from "@/lib/i18n";
import { widthRange } from "./arch-nodes";
import { ArchLayerGraph } from "./arch-layer-graph";
import { ArchOverview, BRANCH_TONE, toneOf } from "./arch-overview";

/**
 * The model architecture: the stack as one wired line, with a layer opened in
 * place.
 *
 * Opening a layer does not replace the picture. The strip is cut at the chip
 * that was clicked and the two halves are pushed apart, the layer unfolding
 * into the gap between them — so the layer stays where it is in the model, and
 * scrolling out of it either way lands back on the line it came from. It used
 * to swap the strip for a panel, which meant losing sight of where in the model
 * you were the moment you looked inside it.
 *
 * Every width shown is computed from the loaded model's config by the spec in
 * lib/arch/<ArchitectureName>.ts; the topology is that spec's, traced to the
 * implementation it names.
 */

/**
 * How the opening is timed. The scroll follows the same curve.
 *
 * Eased at both ends, not just the tail: a curve that is front-loaded spends
 * half its distance in the first eighth of the time, which at this scale is
 * indistinguishable from a jump.
 */
const UNFOLD_MS = 620;
const UNFOLD_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
/** How far left of the gap the view settles, so the cut stays visible. */
const READ_INSET = 28;

/** Every width in the model — the log scale all glyphs share. */
function modelWidths(model: ArchModel): number[] {
  const out: number[] = [];
  const eat = (chain: ArchChain) => {
    for (const { op } of chain.steps) {
      if (op.inDim) out.push(op.inDim);
      if (op.outDim) out.push(op.outDim);
    }
  };
  eat(model.prologue);
  eat(model.epilogue);
  for (const type of model.layerTypes) {
    for (const section of type.sections) section.chains.forEach(eat);
  }
  return out;
}

/** The nearest ancestor that scrolls vertically, if any. */
function scrollParent(from: HTMLElement | null): HTMLElement | null {
  for (let el = from?.parentElement; el; el = el.parentElement) {
    const how = getComputedStyle(el).overflowY;
    if ((how === "auto" || how === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return null;
}

interface Open {
  type: ArchLayerType;
  /** Index into `model.layerTypes`, for the tone. */
  at: number;
  /** Where the left half of the strip stops, in the strip's coordinates. */
  leftTo: number;
  /** Where the right half resumes — past the chip the layer replaces. */
  rightFrom: number;
  /** The line in the strip that the cut hands over on. */
  stripLine: number;
  /**
   * Whether the tensor entering the layer is already the last thing on the left
   * half, in which case the layer must not draw it again.
   */
  omitEntry: boolean;
  /** Whether the block's output is already drawn to the right. */
  omitExit: boolean;
  /** The panel's width when it was opened — how far the fold animates. */
  span: number;
}

export function ArchDiagram({
  model,
  snapshot,
  lang,
}: {
  model: ArchModel;
  snapshot: HfModelSnapshot;
  lang: Locale;
}) {
  const t = getArchCopy(lang);
  const { lo, hi } = widthRange(modelWidths(model));

  /**
   * Whether the multi-token-prediction block is shown.
   *
   * Off by default: it only runs under speculative decoding, and it is not in
   * the model's line — it hangs off it and produces a second set of logits.
   */
  const [mtp, setMtp] = useState(false);
  const hanging = mtp && model.mtp ? model.mtp : null;

  /**
   * The hanging block's own geometry, needed before the strip can be laid out:
   * the strip has to step down after its chip by however far the block steps
   * down inside itself, or the seam at one end of the fold will not meet.
   */
  const branch = useMemo(() => {
    if (!hanging) return null;
    const shape = layoutLayer(hanging, lo, hi);
    const out = outputOf(hanging);
    if (!out) return null;
    return {
      type: hanging,
      label: hanging.label,
      io: hanging.io,
      out,
      drop: shape.exit - shape.centre,
    };
  }, [hanging, lo, hi]);

  const typeOf = useMemo(
    () =>
      Array.from({ length: model.layerCount }, (_, i) =>
        Math.max(
          0,
          model.layerTypes.findIndex((type) => type.layers.includes(i)),
        ),
      ),
    [model],
  );
  const overview = useMemo(
    () =>
      layoutOverview(
        model.input,
        model.prologue,
        model.epilogue,
        model.layerCount,
        typeOf,
        lo,
        hi,
        branch
          ? {
              label: branch.label,
              io: branch.io,
              out: branch.out,
              drop: branch.drop,
            }
          : undefined,
      ),
    [model, typeOf, lo, hi, branch],
  );

  const [open, setOpen] = useState<Open | null>(null);
  /** Whether the gap has been told to open — flipped one frame after it exists. */
  const [unfolded, setUnfolded] = useState(false);
  /**
   * Whether the gap has finished opening and taken its full width.
   *
   * A layer is ten times the width of the panel, and nothing that moves ten
   * panel-widths in half a second reads as motion — it reads as a jump. So the
   * fold only ever ANIMATES across one panel width, and takes the rest in one
   * step once the animation is over: by then the right half of the strip is
   * already past the right edge, so the step happens entirely off-screen.
   */
  const [settled, setSettled] = useState(false);

  const detail = useMemo(
    () =>
      open
        ? layoutLayer(open.type, lo, hi, 0, {
            leadIn: true,
            leadOut: true,
            omitEntry: open.omitEntry,
            omitExit: open.omitExit,
          })
        : null,
    [open, lo, hi],
  );

  const scroller = useRef<HTMLDivElement>(null);
  const gap = useRef<HTMLDivElement>(null);
  /** Where the view starts and ends up, interpolated by how far the gap is. */
  const travel = useRef<{ from: number; to: number } | null>(null);
  /** Which open/close this is, so a stale fallback cannot undo a newer one. */
  const turn = useRef(0);

  /**
   * Both ends of the fold are scheduled twice, on a frame and on a timer.
   *
   * A frame is the right moment — the gap has been painted at zero and the
   * transition has something to start from — but a tab that is not being
   * painted never gets one, and the panel then sat open at zero width with no
   * way to close it, because a width that never changed fires no
   * `transitionend` either. The timer is the floor: it runs regardless, and
   * whichever arrives first settles it.
   */
  const soon = (run: () => void) => {
    const mine = turn.current;
    const guarded = () => {
      if (turn.current === mine) run();
    };
    requestAnimationFrame(guarded);
    window.setTimeout(guarded, 90);
  };

  const openAt = (
    type: ArchLayerType,
    at: number,
    layer: number,
    /** A block that hangs off the stack rather than sitting in it. */
    hanging = false,
  ) => {
    const { leftTo, rightFrom, stripLine, omitEntry, omitExit } = splice(
      overview,
      type,
      layer,
      hanging,
    );
    const view = scroller.current?.clientWidth ?? 800;
    const to = Math.max(0, leftTo - READ_INSET);
    /**
     * Half a panel each way. The gap grows by one panel width while the view
     * scrolls by half of it, so on screen the left half slides one way and the
     * right half the other, by the same amount — the two halves part, rather
     * than one of them sitting still while the other is shoved off.
     */
    travel.current = { from: Math.max(0, to - Math.round(view / 2)), to };
    setOpen({
      type,
      at,
      leftTo,
      rightFrom,
      stripLine,
      omitEntry,
      omitExit,
      span: view,
    });
    turn.current += 1;
    setSettled(false);
    // Next frame, so the gap has been painted at zero width and the browser
    // has something to transition FROM.
    soon(() => setUnfolded(true));
    const mine = turn.current;
    // `transitionend` normally settles it. A tab that is not being painted
    // does not advance a transition at all, so it never ends and never fires
    // — and the fold would sit at one panel width for good.
    window.setTimeout(() => {
      if (turn.current === mine) setSettled(true);
    }, UNFOLD_MS + 160);
  };

  const fold = () => {
    setOpen(null);
    setSettled(false);
    travel.current = null;
  };

  const close = () => {
    turn.current += 1;
    // Back to one panel width, and the view back to the cut. Both happen with
    // no transition, and both are off-screen: this is the step taken when the
    // layer opened, run backwards.
    setSettled(false);
    const el = scroller.current;
    if (el && travel.current) el.scrollLeft = travel.current.to;
    soon(() => setUnfolded(false));
    const mine = turn.current;
    // `transitionend` normally folds it; on a tab that never animated, this
    // does.
    window.setTimeout(() => {
      if (turn.current === mine) fold();
    }, UNFOLD_MS + 240);
  };

  /**
   * The view follows the gap.
   *
   * Read the gap's real width each frame and scroll by the same fraction: the
   * left half slides out one way while the right half is pushed the other, on
   * exactly the curve the CSS transition is running, with no second easing to
   * keep in step. Scrolling only after the animation would have left the cut
   * off-screen for the whole of it.
   *
   * It runs for the whole duration rather than stopping once the width is
   * there: the browser's own scroll anchoring reacts to the gap resizing, and
   * switching straight from one open layer to another — where the width barely
   * changes — used to end after a single frame and let the anchoring put the
   * view back where it was.
   */
  useEffect(() => {
    const el = scroller.current;
    const box = gap.current;
    const trip = travel.current;
    if (!el || !box || !trip || !detail) return;
    if (settled) return;
    let frame = 0;
    const start = performance.now();
    const reach = Math.max(1, Math.min(detail.width, open?.span ?? 800));
    // The row grows to several times the strip's height, which pushes the line
    // the layer sits on out of the panel; the column follows it down so the
    // reader is never left looking at the empty half of the fold.
    const column = scrollParent(el);
    const follow = (now: number) => {
      const at = Math.min(1, box.getBoundingClientRect().width / reach);
      el.scrollLeft = trip.from + (trip.to - trip.from) * at;
      if (column) {
        const seen = box.getBoundingClientRect();
        const within = column.getBoundingClientRect();
        column.scrollTop +=
          seen.top + seen.height / 2 - (within.top + within.height / 2);
      }
      if (now - start < UNFOLD_MS + 80) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [unfolded, settled, detail, open]);

  const href = sourceHref(model, snapshot);
  const strip = (
    <ArchOverview
      layout={overview}
      lo={lo}
      hi={hi}
      label={(layer, type) =>
        `${chipLabel(layer)} ${model.layerTypes[type]?.label ?? ""}`
      }
      onOpen={(layer, type) => {
        const found = model.layerTypes[type];
        if (found) openAt(found, type, layer);
      }}
      onOpenBranch={() => {
        if (branch) openAt(branch.type, -1, branch.type.layers[0] ?? 0, true);
      }}
    />
  );
  const leftW = open ? open.leftTo : overview.width;
  const rightW = open ? overview.width - open.rightFrom : 0;
  /** How wide the gap is right now: nothing, one panel, or the whole layer. */
  const gapW = !detail
    ? 0
    : settled
      ? detail.width
      : unfolded
        ? Math.min(detail.width, open?.span ?? 800)
        : 0;

  /**
   * The vertical alignment, as four numbers that all move together.
   *
   * Neither picture is symmetric about the line its chain runs along — both
   * reserve room above for weight nodes and band titles that the bottom has no
   * counterpart for. Centring their BOXES therefore left the two lines at
   * different heights, and padding the short side to fix that put 92 points of
   * blank under the layer, because the layer's upper half is that much taller
   * than its lower one.
   *
   * So nothing is centred. The row is top-aligned and every piece is offset to
   * put its own line on one shared line, `line` below the row's top. All four
   * values are linear in how far the fold has opened, so transitioning each
   * between its two ends keeps the seam aligned the whole way through — and the
   * row ends up exactly as tall as the layer, with nothing left over.
   */
  const seam = open?.stripLine ?? overview.centre;
  const line = Math.max(seam, detail?.centre ?? 0);
  const align = {
    /** The strip slides down as the taller layer opens under it. */
    stripTop: unfolded ? line - seam : 0,
    /** The gap starts as a point ON the line and grows out from it. */
    gapTop: unfolded && detail ? line - detail.centre : seam,
    gapHeight: unfolded && detail ? detail.height : 0,
    /** Keeps the layer's own line still while the gap around it grows. */
    innerTop: unfolded || !detail ? 0 : -detail.centre,
  };
  const slide = `${UNFOLD_MS}ms ${UNFOLD_EASE}`;

  return (
    <div className="border-t border-line px-4 py-3">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-ink">{t.title}</h3>
          <span className="text-[10px] text-muted">{model.arch}</span>
          {open && (
            <>
              <span
                aria-hidden="true"
                style={{
                  background: open.at < 0 ? BRANCH_TONE : toneOf(open.at),
                }}
                className="ml-1 h-2.5 w-2.5 rounded-sm border border-ink"
              />
              <span className="text-xs font-bold text-ink">
                {open.type.label}
              </span>
              <span className="text-[10px] text-muted">
                {open.type.layers.map(chipLabel).join(" ")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p
            className="text-[10px] text-muted"
            title={model.omitted?.length ? `${t.omitted}: ${model.omitted.join("; ")}` : undefined}
          >
            {t.source}{" "}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                {model.source.label}
              </a>
            ) : (
              model.source.label
            )}
          </p>
          {model.mtp && (
            <button
              type="button"
              onClick={() => {
                if (mtp && open?.at === -1) close();
                setMtp((on) => !on);
              }}
              aria-pressed={mtp}
              title={t.mtpHint}
              className={`shrink-0 rounded border px-2.5 py-1 text-[11px] transition-colors ${
                mtp
                  ? "border-ink bg-accent-soft font-bold text-ink"
                  : "border-line text-ink-soft hover:border-muted/40 hover:text-ink"
              }`}
            >
              {t.mtp}
            </button>
          )}
          {open && (
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded border border-line bg-paper-deep px-2.5 py-1 text-[11px] font-bold text-ink transition-colors hover:border-muted/40"
            >
              {t.back}
            </button>
          )}
        </div>
      </header>

      <div ref={scroller} className="overflow-x-auto pb-1">
        {/* Scroll anchoring off: the gap resizing is the whole point, and the
            browser trying to hold the view still fights the scroll that
            follows it. */}
        <div
          className="flex w-max items-start"
          style={{ overflowAnchor: "none" }}
        >
          {/* The strip is drawn twice and each copy is windowed, so the cut can
              be anywhere without the line itself having to be split up. */}
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: leftW,
              marginTop: align.stripTop,
              // Dropped once the fold has settled, like the gap's: a value
              // still under a transition is a value that has not arrived if
              // the tab was never painted.
              transition: settled ? "none" : `margin-top ${slide}`,
            }}
          >
            {strip}
          </div>

          {open && detail && (
            <div
              ref={gap}
              onTransitionEnd={(event) => {
                if (event.propertyName !== "width") return;
                if (unfolded) setSettled(true);
                else fold();
              }}
              // Double-click anywhere in the opened layer to fold it back,
              // which is where the pointer already is.
              onDoubleClick={close}
              title={t.back}
              style={{
                width: gapW,
                height: align.gapHeight,
                marginTop: align.gapTop,
                // The step to full width is not animated; only the panel-wide
                // part of the fold is.
                transition: settled
                  ? "none"
                  : `width ${slide}, height ${slide}, margin-top ${slide}`,
              }}
              className="relative shrink-0 overflow-hidden"
            >
              {/* Offset so the layer's own line stays on the strip's line
                  while the gap around it grows, instead of sliding into
                  place. */}
              <div
                className="absolute left-0"
                style={{
                  width: detail.width,
                  top: align.innerTop,
                  transition: settled ? "none" : `top ${slide}`,
                }}
              >
                <ArchLayerGraph layout={detail} lo={lo} hi={hi} />
              </div>
            </div>
          )}

          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: rightW,
              marginTop: align.stripTop,
              // Dropped once the fold has settled, like the gap's: a value
              // still under a transition is a value that has not arrived if
              // the tab was never painted.
              transition: settled ? "none" : `margin-top ${slide}`,
            }}
          >
            <div style={{ marginLeft: open ? -open.rightFrom : 0 }}>
              {strip}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
