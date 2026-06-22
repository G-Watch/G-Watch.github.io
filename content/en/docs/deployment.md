---
title: Deploying to GitHub Pages
description: goodoc builds to a pure static site that you can publish to GitHub Pages or any static host with one click.
group: Deployment
order: 1
---

# Deploying to GitHub Pages

goodoc uses Next.js static export (`output: "export"`), so `npm run build` generates pure static
HTML/CSS/JS in the `out/` directory, ready to host on any static host.

## Local Build

```bash
npm run build      # output goes to out/
npx serve out      # preview the static output locally
```

## Base Path

A GitHub *project* site has an address like `https://<username>.github.io/<repo-name>/`, where the site lives under a subpath.
In that case you need to set a base path:

```bash
NEXT_PUBLIC_BASE_PATH=/goodoc npm run build
```

`next.config.ts` reads this environment variable and automatically prefixes all
links and assets. The base path is applied to **production builds only** —
`npm run dev` always serves from the root, so a stray `NEXT_PUBLIC_BASE_PATH` in
your shell can never 404 your dev site.

## GitHub Actions

The repo ships with `.github/workflows/deploy.yml`; pushing to the `main` branch builds and publishes automatically.
You only need to go to the repo settings and set **Settings → Pages → Source** to **GitHub Actions**.

The workflow looks roughly like this:

```yaml
- run: npm ci
- run: npm run build
  env:
    NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
- uses: actions/upload-pages-artifact@v3
  with:
    path: ./out
```

> For a custom domain or a user page (`<username>.github.io`), which deploy at the root path, no
> base path is needed—just leave `NEXT_PUBLIC_BASE_PATH` empty.

## Other Hosts

`out/` is just ordinary static files, so it can also be deployed to Netlify, Cloudflare Pages, Nginx, or any other
static host.
