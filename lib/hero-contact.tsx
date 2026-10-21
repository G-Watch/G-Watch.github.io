// User-owned hero showcase component.
//
// Shown in place of the install buttons (lib/hero-arch-buttons.tsx) while
// G-Watch is handed out on request: a caption, one sentence and the address to
// write to. Registered as the "contact" slot in lib/hero-slots.tsx and surfaced
// in the hero via lib/site-config.ts. Static (no hooks) → server component.

/** Where a reader asks for a G-Watch trial. */
export const CONTACT_EMAIL = "zobin1999@gmail.com";

export function HeroContact({
  caption,
  body,
}: {
  caption: string;
  /** The sentence before the address. */
  body: string;
}) {
  // Same frame as the side-by-side install buttons it stands in for.
  return (
    <div className="beam-border mx-auto flex w-fit flex-col items-center gap-4 rounded-2xl px-6 py-5 sm:flex-row sm:gap-6 lg:mx-0">
      <p className="whitespace-nowrap font-sans text-lg font-bold tracking-wide text-accent">
        {caption}
      </p>
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
        <p className="text-base text-ink-soft">{body}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-paper shadow-paper transition-colors hover:bg-accent-strong"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
