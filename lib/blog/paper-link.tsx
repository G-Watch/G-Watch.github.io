// User-owned: a link to a paper, with a document icon in front of the text.
// Used in blog posts as <PaperLink href="…">our paper</PaperLink>. The icon is
// inline SVG (Material Symbols "description", outlined, Apache-2.0), like the
// nav icons in lib/nav-icons.tsx, so it costs no extra request.
import type { ReactNode } from "react";

export function PaperLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className="inline-flex items-baseline gap-[0.2em]">
      <svg
        viewBox="0 -960 960 960"
        fill="currentColor"
        aria-hidden="true"
        className="h-[1.05em] w-[1.05em] shrink-0 self-center"
      >
        <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z" />
      </svg>
      {children}
    </a>
  );
}

/** Agent view: the same link, without the icon. */
export function PaperLinkText({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return <a href={href}>{children}</a>;
}
