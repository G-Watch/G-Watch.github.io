---
title: Upgrading from upstream
description: Pull framework improvements into your cloned template without losing your content, config, or theme.
group: Deployment
order: 2
---

# Upgrading from upstream

You cloned goodoc as a template and filled it with your own content. When the
upstream framework improves, pull those improvements in **without losing your
content, config, or theme**:

```bash
npm run upgrade
```

Then `npm install`, `npm run build`, review `git diff`, and commit.

## What updates, what stays yours

The upgrade reads `goodoc.manifest.json`, which draws a hard line between two
kinds of files:

| | Examples | On upgrade |
| --- | --- | --- |
| **Framework-owned** | `app/[lang]/`, `components/`, the rendering libs, configs, `dev-docs/` | Overwritten from upstream |
| **User-owned** | `content/`, `public/`, `lib/site-config.ts`, `app/theme.css` | **Never touched** |
| **Review** | `package.json` | Upstream copy written as `package.json.upstream` to merge |

So your docs, your project copy and nav, your palette, and your assets are safe;
the framework's routing, rendering, and components get the upgrade.

## Options

```bash
npm run upgrade -- --ref v1.2.0   # upgrade to a specific tag/branch/commit
npm run upgrade -- --dry-run      # show what would change, do nothing
npm run upgrade -- --force        # discard uncommitted framework edits and proceed
```

By default the script refuses to overwrite framework files that have uncommitted
changes — commit or stash first, or pass `--force`.

## Tips

- **Commit before upgrading** so the post-upgrade `git diff` is easy to review
  and trivial to roll back.
- **Pin to tags** (`--ref vX.Y.Z`) for reproducible upgrades; the repo's
  `CHANGELOG.md` records what changed.
- Files **deleted upstream** are not auto-removed; check `git status` afterward.

For the full reference, see `UPGRADING.md` at the repository root.
