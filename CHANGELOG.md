# Changelog

Notable changes to the goodoc framework. Downstream projects can pin to a tag
with `npm run upgrade -- --ref vX.Y.Z`. See [UPGRADING.md](./UPGRADING.md).

## Unreleased

### Added
- **Agent skill** as a single source-of-truth file at `skills/goodoc/SKILL.md`,
  distributable to any agent (Claude, Codex, Gemini, …) via `npx skills`. It
  instructs an agent how to author docs/blog, configure the landing
  page/theme/footer, manage i18n, build, deploy, and upgrade. Framework-owned,
  so it travels with the template and updates via `npm run upgrade`.
- **i18n** with locale-prefixed URLs (`/en/…`, `/zh/…`), English default.
  Locales live in `lib/i18n.ts`, UI strings in `lib/dictionaries.ts`, and
  per-locale content under `content/<locale>/`. Missing translations fall back
  to the default locale. Language switcher in the header.
- **Landing quickstart** section (install command + immediate-usage steps) and
  **illustrated feature cards** (optional `image` on each feature).
- **Footer attribution line**: `<Project Name> <Duration> | Powered by Goodoc`,
  configured via `projectName` / `duration` / `poweredBy` in `lib/site-config.ts`.
- **Upgrade mechanism**: `npm run upgrade` pulls framework updates from upstream
  while preserving user-owned files, driven by `goodoc.manifest.json`.
- Theme tokens split into user-owned `app/theme.css`, separate from the
  framework's rendering CSS in `app/globals.css`.

## 0.1.0

### Added
- Initial framework: literary light-only landing page, two-view docs
  (humanize/agent) and blog, GitHub-style Markdown rendering with Shiki, static
  export for GitHub Pages, and the `dev-docs/` development documentation.
