import type { ReactNode } from "react";

/**
 * Icons rendered before a header nav label. A nav entry in lib/site-config.ts
 * opts in by setting `icon` to a key of this registry.
 *
 * USER-OWNED: not listed in goodoc.manifest.json, so `npm run upgrade` never
 * touches it.
 *
 * Icons are inlined as SVG rather than loaded as a webfont, so the static
 * export makes no extra network request. Material Symbols paths use the
 * "0 -960 960 960" viewBox and are licensed Apache-2.0.
 */

/** Material Symbols "view_object_track" (outlined). */
function ViewObjectTrackIcon() {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      className="h-[1.15em] w-[1.15em] shrink-0"
    >
      <path d="M300-160q-58 0-99-41t-41-99q0-58 41-99t99-41h440q58 0 99 41t41 99q0 58-41 99t-99 41H300Zm0-80h440q25 0 42.5-17.5T800-300q0-25-17.5-42.5T740-360H300q-25 0-42.5 17.5T240-300q0 25 17.5 42.5T300-240Zm-80-280q-58 0-99-41t-41-99q0-58 41-99t99-41h440q58 0 99 41t41 99q0 58-41 99t-99 41H220Zm0-80h440q25 0 42.5-17.5T720-660q0-25-17.5-42.5T660-720H220q-25 0-42.5 17.5T160-660q0 25 17.5 42.5T220-600Zm300 300Zm-80-360Z" />
    </svg>
  );
}

export const navIcons: Record<string, ReactNode> = {
  "view-object-track": <ViewObjectTrackIcon />,
};
