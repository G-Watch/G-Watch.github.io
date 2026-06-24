"use client";

import { useState, useEffect, type CSSProperties } from "react";
import type { HeroMedia as HeroMediaConfig } from "@/lib/site-config";
import { heroSlots } from "@/lib/hero-slots";
import { withBasePath } from "@/lib/paths";

const INTERVAL_MS = 4000;

/** Overlap geometry defaults (overridable via `media.layout`). */
const DEFAULT_OFFSET_X = -14; // %
const DEFAULT_WIDTH = 130; // % of column
const DEFAULT_FEATHER = 0.4; // image/video; custom slots default to 0

/**
 * Build a radial mask for a feather amount. `0` (or less) means no mask at all
 * (crisp edges); `1` is a strong fade. The fade is biased to the left edge (the
 * side that approaches the hero text) via the off-centre focus.
 */
function featherMask(amount: number): string | undefined {
  if (!(amount > 0)) return undefined;
  const a = Math.min(amount, 1);
  const core = Math.round(88 - a * 73); // a→0+: ~88% solid (subtle); a→1: ~15% solid
  return `radial-gradient(82% 86% at 70% 50%, #000 ${core}%, transparent 100%)`;
}

function MediaItem({ media }: { media: HeroMediaConfig }) {
  if (media.type === "custom") {
    // A user-defined component from lib/hero-slots.tsx.
    return <>{heroSlots[media.slot] ?? null}</>;
  }
  if (media.type === "video") {
    return (
      <video
        className="block w-full"
        src={withBasePath(media.src)}
        poster={media.poster ? withBasePath(media.poster) : undefined}
        autoPlay
        loop
        muted
        playsInline
        aria-label={media.alt}
      />
    );
  }
  // Plain <img>: the static export has no next/image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="block w-full" src={withBasePath(media.src)} alt={media.alt ?? ""} />;
}

/**
 * Showcase image/video/custom-component for the hero. Accepts a single item or
 * an array (arrays crossfade on a timer).
 *
 * Placements:
 * - "below"   — a calm floating card beneath the text (dot nav shown).
 * - "overlap" — same band as the text, shifted aside; image/video edges feather
 *   into the page, custom components keep crisp edges by default.
 *
 * All of the framing is tunable per `media.layout` (feather, offsetX, width,
 * glow) — see lib/site-config.ts.
 */
export function HeroMedia({
  media,
}: {
  media: HeroMediaConfig | HeroMediaConfig[];
}) {
  const items = Array.isArray(media) ? media : [media];
  const first = items[0];
  const overlap = first?.placement === "overlap";

  // Frame geometry comes from the first item; feather is resolved per slide.
  const layout = first?.layout ?? {};
  const offsetX = layout.offsetX ?? DEFAULT_OFFSET_X;
  const width = layout.width ?? DEFAULT_WIDTH;
  const glow = layout.glow ?? true;

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(
      () => setActive((n) => (n + 1) % items.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [items.length]);

  const featherFor = (item: HeroMediaConfig): string | undefined => {
    if (!overlap) return undefined; // the "below" card has its own chrome
    const amount =
      item.layout?.feather ?? (item.type === "custom" ? 0 : DEFAULT_FEATHER);
    return featherMask(amount);
  };

  // item[0] stays in flow (sets the container height); rest are absolute overlays
  const stack = (
    <div className="relative">
      {items.map((item, i) => {
        const mask = featherFor(item);
        const base: CSSProperties =
          i === 0
            ? { opacity: active === 0 ? 1 : 0 }
            : { position: "absolute", inset: 0, opacity: active === i ? 1 : 0 };
        const style: CSSProperties = mask
          ? { ...base, maskImage: mask, WebkitMaskImage: mask }
          : base;
        return (
          <div
            key={i}
            className="transition-opacity duration-700 ease-in-out"
            style={style}
          >
            <MediaItem media={item} />
          </div>
        );
      })}
    </div>
  );

  if (overlap) {
    return (
      <div
        className="relative min-w-0 lg:ml-[var(--hero-ml)] lg:w-[var(--hero-w)]"
        style={
          { "--hero-ml": `${offsetX}%`, "--hero-w": `${width}%` } as CSSProperties
        }
      >
        {glow && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-6 -z-10 bg-accent-soft/40 blur-3xl"
          />
        )}
        {stack}
      </div>
    );
  }

  return (
    <div className="relative mx-auto mt-14 max-w-5xl">
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 -bottom-6 top-6 -z-10 rounded-[2.5rem] bg-accent-soft/50 blur-3xl"
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-32px_rgba(43,41,37,0.30)]">
        {stack}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-5 bg-accent"
                  : "w-1.5 bg-ink/20 hover:bg-ink/40"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
