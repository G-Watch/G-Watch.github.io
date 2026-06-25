// User-owned registry of custom feature-card visuals.
//
// A feature in lib/site-config.ts can set `slot: "<key>"` to render one of these
// components in the card's media band instead of a plain image/video. The card
// is the `group`, so components here may use `group-hover:` for hover effects.
//
// Seeded by `npm run upgrade` when missing; never overwritten once it exists.
import type { ReactNode } from "react";
import { withBasePath } from "@/lib/paths";

/**
 * Intra-kernel Tracing card visual: the Human view and the Agent view shown
 * side by side, split by a diagonal seam. On card hover the halves do a liquid
 * zoom and a glass reflection sweeps across.
 */
function IketViews() {
  return (
    <div className="relative h-44 w-full overflow-hidden bg-ink">
      {/* Human view — left half, diagonal clip. */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        style={{ clipPath: "polygon(0 0, 56% 0, 44% 100%, 0 100%)" }}
      >
        <video
          src={withBasePath("/media/iket_triton.mp4")}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover object-center"
        />
        <span className="absolute bottom-2 left-3 rounded bg-white/75 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink">
          Human View
        </span>
      </div>

      {/* Agent view — right half, diagonal clip. */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        style={{ clipPath: "polygon(58% 0, 100% 0, 100% 100%, 46% 100%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath("/media/iket_agentview.png")}
          alt="Agent view"
          className="h-full w-full object-cover object-center"
        />
        <span className="absolute bottom-2 right-3 rounded bg-white/75 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink">
          Agent View
        </span>
      </div>

      {/* Diagonal seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent calc(50% - 1.5px), rgba(255,255,255,0.85) 50%, transparent calc(50% + 1.5px))",
        }}
      />

      {/* Glass reflection — sweeps across on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 z-10 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[120%] group-hover:opacity-100"
      />
    </div>
  );
}

export const featureSlots: Record<string, ReactNode> = {
  "iket-views": <IketViews />,
};
