// User-owned registry of custom hero showcase components.
//
// Register a component under a key here, then reference it from
// lib/site-config.ts with:  media: { type: "custom", slot: "<key>" }
//
// Custom slots inherit the same below/overlap framing and carousel crossfade as
// image/video media. Components may import your own files and third-party libs;
// if a component needs hooks/state/browser APIs, put it in its own file with a
// "use client" directive (do NOT add "use client" to this file).
//
// Seeded by `npm run upgrade` when missing; never overwritten once it exists.
import type { ReactNode } from "react";
import { HeroArchButtons } from "@/lib/hero-arch-buttons";

export const heroSlots: Record<string, ReactNode> = {
  arch: <HeroArchButtons caption="Install G-Watch on major GPU platforms" />,
  archZh: <HeroArchButtons caption="安装 G-Watch" />,
};
