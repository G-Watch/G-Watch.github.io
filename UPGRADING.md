# Upgrading goodoc

You cloned goodoc as a template and filled it with your own content. When the
upstream framework improves, you can pull those improvements **without losing
your content, config, or theme**.

```bash
npm run upgrade
```

That's it. Then `npm install`, `npm run build`, review `git diff`, and commit.

## What gets updated, what stays yours

`npm run upgrade` reads [`goodoc.manifest.json`](./goodoc.manifest.json), which
draws a hard line between two kinds of files:

| | Examples | On upgrade |
| --- | --- | --- |
| **Framework-owned** | `app/[lang]/`, `components/`, the rendering libs, configs, `dev-docs/` | Overwritten from upstream |
| **User-owned** | `content/`, `public/`, `lib/site-config.ts`, `lib/hero-slots.tsx`, `app/theme.css` | **Never touched** |
| **Review** | `package.json` | Upstream copy written to `package.json.upstream` for you to merge |
| **Seed** | new user-owned files like `lib/hero-slots.tsx`, `lib/feature-slots.tsx`, `lib/authors.ts`, `lib/mdx-components.tsx` | Created **only if missing**, then yours |

The **Seed** row is how new user-editable files reach older clones: when the
framework starts depending on a file you're meant to own, upgrade creates it from
upstream the first time (only if you don't already have it) and never overwrites
it afterward.

So your docs (`content/`), your project copy and nav (`lib/site-config.ts`),
your palette and fonts (`app/theme.css`), and your assets (`public/`) are safe.
The framework's routing, rendering pipeline, and components get the upgrade.

## The boundary, in practice

Edit these freely — upgrades won't clobber them:

- `content/<locale>/docs/*.{md,mdx}`, `content/<locale>/blog/*.{md,mdx}` — your content
- `lib/site-config.ts` — name, tagline, nav, hero, features, quickstart, footer
- `lib/hero-slots.tsx` — custom hero showcase components
- `lib/feature-slots.tsx` — custom feature-card media components
- `lib/authors.ts` — blog author registry
- `lib/mdx-components.tsx` — components usable inside `.mdx` content
- `app/theme.css` — colors and font mappings
- `public/` — your images and assets

Avoid editing these (they get overwritten). If you must, expect to re-apply your
change after each upgrade:

- `app/[lang]/**`, `components/**` — pages and UI
- `lib/{content,markdown,i18n,dictionaries,paths,format}.ts` — the engine
- `app/globals.css` — prose/agent rendering CSS (palette lives in `theme.css`)
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`

UI strings live in `lib/dictionaries.ts` (framework-owned). If you translated
them and an upgrade overwrites the file, re-apply your translations — a build
type-error will point at any new keys you still need to fill in.

## Options

```bash
npm run upgrade -- --ref v1.2.0   # upgrade to a specific tag/branch/commit
npm run upgrade -- --dry-run      # show what would change, do nothing
npm run upgrade -- --force        # discard uncommitted framework edits and proceed
```

By default the script refuses to overwrite framework files that have local edits
**differing from upstream** — commit or stash first, or pass `--force`. Framework
files left uncommitted by a previous upgrade (i.e. already matching upstream)
don't trip this, so you can run `npm run upgrade` several times in a row without
committing in between.

## Tips

- **Commit before upgrading.** A clean tree makes `git diff` after the upgrade
  easy to review and trivial to roll back.
- **Pin to tags** (`--ref vX.Y.Z`) for reproducible upgrades; see the
  [CHANGELOG](./CHANGELOG.md) for what changed between versions.
- Files **deleted upstream** are not auto-removed; check `git status` for
  stragglers after a big upgrade.
- First run adds an `upstream` git remote pointing at the URL in the manifest.
