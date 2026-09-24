"use client";

import { useEffect, useRef, useState } from "react";
import { Prose } from "./prose";

/**
 * A short document behind a button — the "how is this computed" note beside a
 * heading.
 *
 * The body is HTML rendered at build time from first-party Markdown+LaTeX (see
 * lib/markdown-math.ts), which is why it can be injected directly.
 *
 * Built on the native `<dialog>`: it brings the top layer, focus trapping,
 * `Esc` to close and a `::backdrop` with no library and no scroll-lock hack.
 */
export function DocDialog({
  label,
  title,
  html,
  empty,
  closeLabel,
}: {
  /** The opening button's text — a sentence, not a control label. */
  label: string;
  /** Heading inside the dialog. */
  title: string;
  /** Rendered document body; empty while the document is unwritten. */
  html: string;
  /** Stand-in shown when `html` is empty. */
  empty: string;
  /** Accessible name of the close button. */
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // `open` is the React-side intent; showModal/close is what actually puts the
  // element in the top layer, so the two are synced here rather than by
  // rendering the `open` attribute (which would skip the modal behaviour).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {/* Reads as a question, not a control: it explains rather than acts, so
          it sits beside the buttons without borrowing their frame. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-xs text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink hover:decoration-muted"
      >
        {label}
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        // A click that lands on the dialog element itself is a click on the
        // backdrop — the content sits in the child below.
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        // Entry / exit transition lives in app/theme.css — it needs
        // @starting-style and allow-discrete, which utilities cannot express.
        className="doc-dialog m-auto max-h-[80vh] w-[min(46rem,92vw)] rounded border border-line bg-surface p-0 text-ink shadow-paper"
      >
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              title={closeLabel}
              className="shrink-0 rounded px-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              ✕
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {html ? (
              <Prose html={html} />
            ) : (
              <p className="text-xs text-muted">{empty}</p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
