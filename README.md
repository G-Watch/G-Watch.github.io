<div align="center">
  <img src="./public/goodoc-mark.svg" alt="goodoc" width="160" />
  <h1>goodoc</h1>
  <p><em>A documentation framework for project homepages, docs, and blogs</em></p>
  <p><strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a></p>
</div>

**goodoc** turns Markdown into a project site — a landing page, docs, and a blog —
that builds to a static site for GitHub Pages. Every doc and post renders in two
views: **humanize** (for people) and **agent** (clean HTML for machines). It's
multilingual (locale-prefixed URLs, English default).

## Quick start

```bash
git clone https://github.com/zobinHuang/goodoc.git my-project
cd my-project
npm install
npm run dev        # http://localhost:3000
```

1. Edit `lib/site-config.ts` — project name, navigation, and landing copy
   (palette in `app/theme.css`).
2. Add Markdown to `content/<locale>/docs/` and `content/<locale>/blog/`
   (default locale is `en`).
3. Push to GitHub; the bundled Actions workflow publishes to Pages
   (**Settings → Pages → Source → GitHub Actions**).

## Agent skill

This repo ships an agent skill at [`skills/goodoc/`](./skills/goodoc/SKILL.md)
that teaches a coding agent (Claude, Codex, Gemini, …) how to author content,
configure, build, and deploy on this template. Install and manage it with the
[`skills`](https://www.npmjs.com/package/skills) CLI:

```bash
npx skills        # install / manage the bundled skill for your agent(s)
```

## Build & deploy

```bash
npm run build                                 # static export → out/
NEXT_PUBLIC_BASE_PATH=/goodoc npm run build   # GitHub project site (sub-path)
```

## Upgrade

Cloned goodoc as a template? Pull upstream framework updates without touching
your content:

```bash
npm run upgrade
```

See [`UPGRADING.md`](./UPGRADING.md) and [`CHANGELOG.md`](./CHANGELOG.md).

## Docs

- On-site: visit `/` (redirects to `/en/`) or `/en/docs/`.
- Framework internals: [`dev-docs/`](./dev-docs/).

Tech: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
static export.

## License

See [LICENSE](./LICENSE).
