import type { Author } from "@/lib/content";

/**
 * Blog author registry — this file is yours to edit (upgrades seed it if
 * missing and never overwrite it).
 *
 * Reference an entry by its key in a post's frontmatter:
 *
 *   ---
 *   title: My Post
 *   authors: [ada, lin]
 *   ---
 *
 * Or write an author inline in the frontmatter instead of registering here:
 *
 *   authors:
 *     - name: Guest Writer
 *       affiliation: Acme
 *       email: guest@acme.dev
 *
 * Avatars are images under public/ (e.g. /authors/ada.svg); omit `avatar` to
 * fall back to a monogram. `email` renders as a mailto link; `url` links the
 * author's name.
 */
export const authors: Record<string, Author> = {
  ada: {
    name: "Ada Lovelace",
    avatar: "/authors/ada.svg",
    email: "ada@goodoc.dev",
    affiliation: "goodoc",
    url: "https://github.com/zobinHuang/goodoc",
  },
  lin: {
    name: "Lin Mercer",
    avatar: "/authors/lin.svg",
    email: "lin@goodoc.dev",
    affiliation: "Docs Team",
  },
};
