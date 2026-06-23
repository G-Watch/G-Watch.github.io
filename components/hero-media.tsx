"use client";

import { useState, useEffect } from "react";
import type { HeroMedia as HeroMediaConfig } from "@/lib/site-config";
import { heroSlots } from "@/lib/hero-slots";
import { withBasePath } from "@/lib/paths";

const FEATHER = "radial-gradient(78% 82% at 70% 50%, #000 40%, transparent 80%)";
const INTERVAL_MS = 4000;

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
 * Showcase image/video for the hero. Accepts a single item or an array;
 * arrays crossfade automatically on a timer.
 *
 * Placements:
 * - "below"   — a calm floating card beneath the text (dot nav shown).
 * - "overlap" — same band as the text, feathered edges, silent auto-advance.
 */
export function HeroMedia({
  media,
}: {
  media: HeroMediaConfig | HeroMediaConfig[];
}) {
  const items = Array.isArray(media) ? media : [media];
  const overlap = items[0]?.placement === "overlap";
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(
      () => setActive((n) => (n + 1) % items.length),
      INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [items.length]);

  // item[0] stays in flow (sets the container height); rest are absolute overlays
  const stack = (
    <div className="relative">
      {items.map((item, i) => (
        <div
          key={i}
          className="transition-opacity duration-700 ease-in-out"
          style={
            i === 0
              ? { opacity: active === 0 ? 1 : 0 }
              : { position: "absolute", inset: 0, opacity: active === i ? 1 : 0 }
          }
        >
          <MediaItem media={item} />
        </div>
      ))}
    </div>
  );

  if (overlap) {
    return (
      <div className="relative min-w-0 lg:-ml-[14%] lg:w-[130%]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-6 -z-10 bg-accent-soft/40 blur-3xl"
        />
        <div
          className="overflow-hidden"
          style={{ maskImage: FEATHER, WebkitMaskImage: FEATHER }}
        >
          {stack}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto mt-14 max-w-5xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -bottom-6 top-6 -z-10 rounded-[2.5rem] bg-accent-soft/50 blur-3xl"
      />
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
