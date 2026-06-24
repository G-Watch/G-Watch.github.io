// User-owned hero showcase component.
//
// A caption plus two glass parallelogram buttons — one per supported GPU
// architecture (NVIDIA CUDA / AMD ROCm), stacked with a vertical gap. Each
// button has two zones split by an edge-parallel divider: a frosted-glass logo
// panel on the left and the brand-colored label on the right. Registered as the
// "arch" slot in lib/hero-slots.tsx and surfaced in the hero via
// lib/site-config.ts.
//
// On hover: the whole button grows, the logo panel grows, and a glass
// reflection sweeps across it.
//
// To swap a logo: drop the asset in public/ and set `logo` on the entry below
// (placeholder chip auto-swaps for an <img>). Static (no hooks) → server
// component.
import type { CSSProperties } from "react";
import { withBasePath } from "@/lib/paths";

type Arch = {
  /** Button label. */
  label: string;
  /** Vendor name — used as the logo's alt text. */
  vendor: string;
  /** Short placeholder text shown in the logo chip until a real asset exists. */
  short: string;
  /** Brand color for the border + hover glow. */
  accent: string;
  /** Logo asset under public/ (optional until assets arrive). */
  logo?: string;
};

const ARCHES: Arch[] = [
  { label: "CUDA", vendor: "NVIDIA", short: "NV", accent: "#76b900", logo: "/nvidia_logo.png" },
  { label: "ROCm", vendor: "AMD", short: "AMD", accent: "#ed1c24", logo: "/amd_logo.png" },
];

function Logo({ arch }: { arch: Arch }) {
  // skew-x-12 counter-skews the content so it sits upright inside the
  // -skew-x-12 parallelogram frame; it grows a bit when the button is hovered.
  const base =
    "relative z-10 h-24 w-24 flex-none skew-x-12 transition-transform duration-300 ease-out group-hover:scale-110";
  if (arch.logo) {
    // Plain <img>: the static export has no next/image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={withBasePath(arch.logo)}
        alt={arch.vendor}
        className={`${base} object-contain drop-shadow`}
      />
    );
  }
  // Placeholder until the real logo asset is provided.
  return (
    <span
      aria-hidden
      className={`${base} grid place-items-center rounded-xl bg-white/20 text-base font-bold tracking-tight text-white ring-1 ring-inset ring-white/30`}
    >
      {arch.short}
    </span>
  );
}

function ArchButton({ arch }: { arch: Arch }) {
  return (
    <div className="group relative">
      {/* Colored glow — fades in on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 -skew-x-12 rounded-2xl opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-75"
        style={{ backgroundColor: arch.accent }}
      />
      {/* Parallelogram frame — LIGHT by default; the deep brand fill crossfades
          in on hover. Whole button grows on hover. */}
      <div
        className="relative -skew-x-12 overflow-hidden rounded-2xl shadow-[0_18px_45px_-22px_rgba(43,41,37,0.45)] transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:scale-[1.05] group-hover:shadow-[0_40px_85px_-26px_rgba(43,41,37,0.6)]"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${arch.accent} 22%, white), color-mix(in srgb, ${arch.accent} 10%, white))`,
        }}
      >
        {/* Deep brand fill — fades in on hover (can't tween gradients directly). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${arch.accent} 88%, black), color-mix(in srgb, ${arch.accent} 64%, black))`,
          }}
        />
        <div className="relative z-10 flex items-stretch">
          {/* LEFT — light logo panel. The border-r renders slanted, parallel to
              the frame edges. Grows on hover. */}
          <div
            className="relative flex items-center justify-center overflow-hidden border-r-2 px-9 transition-all duration-300 ease-out group-hover:px-11"
            style={{
              borderColor: "rgba(255,255,255,0.55)",
              // Solid light brand tint (pale green / pale red) so the black logo
              // reads clearly in both states.
              background: `color-mix(in srgb, ${arch.accent} 16%, white)`,
            }}
          >
            <Logo arch={arch} />
            {/* Glass reflection — sweeps across on hover. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-[-40%] left-0 z-20 w-1/2 -translate-x-[180%] rotate-[14deg] bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:translate-x-[240%] group-hover:opacity-90"
            />
          </div>
          {/* RIGHT — label: dark brand color on the light default, fading to
              white once the deep fill appears on hover. */}
          <div className="flex flex-1 items-center px-11 py-9">
            <span
              className="skew-x-12 whitespace-nowrap text-5xl font-bold italic text-[color:var(--label)] transition-colors duration-300 ease-out group-hover:text-white"
              style={
                {
                  fontFamily: '"Space Grotesk", ui-sans-serif, sans-serif',
                  "--label": `color-mix(in srgb, ${arch.accent} 72%, black)`,
                } as CSSProperties
              }
            >
              {arch.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroArchButtons({ caption }: { caption: string }) {
  return (
    // The flowing-light beam IS the border (see .beam-border in theme.css).
    // Caption lives inside the box, so no line sits behind it.
    <div className="beam-border mx-auto w-fit rounded-2xl px-8 py-8">
      <p className="mb-6 font-sans text-xl font-bold tracking-wide text-accent">
        {caption}
      </p>
      <div className="flex w-fit flex-col gap-6">
        {ARCHES.map((arch) => (
          <ArchButton key={arch.label} arch={arch} />
        ))}
      </div>
    </div>
  );
}
