#!/usr/bin/env node
/**
 * goodoc upgrade — pull framework updates from upstream without touching your
 * content, config, or theme.
 *
 * Usage:
 *   npm run upgrade            # upgrade from upstream/<branch> in the manifest
 *   npm run upgrade -- --ref v1.2.0   # upgrade to a specific tag/branch/commit
 *   npm run upgrade -- --force        # proceed even if framework files are dirty
 *   npm run upgrade -- --dry-run      # show what would change, do nothing
 *
 * How it works: it reads goodoc.manifest.json, which lists framework-owned
 * paths (overwritten from upstream) vs. user-owned paths (never touched). It
 * adds an `upstream` git remote if missing, fetches it, and checks out each
 * framework path at the chosen ref. Files in `review` (e.g. package.json) are
 * written next to yours as `<file>.upstream` for you to diff and merge.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const getOpt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const force = hasFlag("--force");
const dryRun = hasFlag("--dry-run");

const log = (...m) => console.log(...m);
const die = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

function git(cmd, opts = {}) {
  return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", ...opts }).trim();
}
// Treat a path as a literal pathspec so glob chars (e.g. the brackets in
// "app/[lang]") match the real path instead of being interpreted as wildcards.
function pathspec(p) {
  return JSON.stringify(`:(literal)${p}`);
}
function tryGit(cmd) {
  try {
    return git(cmd, { stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

// --- Load manifest --------------------------------------------------------
let manifest;
try {
  manifest = JSON.parse(readFileSync(path.join(root, "goodoc.manifest.json"), "utf8"));
} catch {
  die("Could not read goodoc.manifest.json. Run this from your project root.");
}
const upstreamUrl = manifest.upstream;
const branch = manifest.branch || "main";
const frameworkPaths = manifest.framework ?? [];
const reviewPaths = manifest.review ?? [];

if (tryGit("rev-parse --is-inside-work-tree") !== "true") {
  die("Not a git repository. goodoc upgrades work over git.");
}

// --- Ensure upstream remote ----------------------------------------------
// Adding a remote and fetching are non-destructive (no working-tree changes),
// so we do them even in --dry-run to produce an accurate preview.
const remotes = tryGit("remote") ?? "";
if (!remotes.split("\n").includes("upstream")) {
  log(`+ adding 'upstream' remote → ${upstreamUrl}`);
  git(`remote add upstream ${upstreamUrl}`);
}

// --- Fetch ----------------------------------------------------------------
const ref = getOpt("--ref") || `upstream/${branch}`;
log(`↓ fetching upstream …`);
git("fetch upstream --tags", { stdio: "inherit" });

// Verify the ref exists.
if (tryGit(`rev-parse --verify --quiet ${ref}^{commit}`) === null) {
  die(`Ref '${ref}' not found upstream. Try a tag like --ref v1.0.0.`);
}

// --- Safety: refuse if framework files have uncommitted changes -----------
const porcelain = tryGit("status --porcelain") ?? "";
const dirty = porcelain
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).trim());

const underFramework = (file) =>
  frameworkPaths.some((p) => file === p || file.startsWith(`${p}/`));
const dirtyFramework = dirty.filter(underFramework);

if (!dryRun && dirtyFramework.length && !force) {
  log("\n⚠ These framework files have uncommitted changes and would be overwritten:");
  dirtyFramework.forEach((f) => log(`    ${f}`));
  die("Commit/stash them, or re-run with --force to discard them.");
}

// --- Apply ----------------------------------------------------------------
log(`\n↻ updating framework files from ${ref} …`);
const updated = [];
const failed = [];
for (const p of frameworkPaths) {
  if (dryRun) {
    const changed = tryGit(`diff --name-only ${ref} -- ${pathspec(p)}`);
    if (changed) updated.push(...changed.split("\n").filter(Boolean));
    continue;
  }
  try {
    git(`checkout ${ref} -- ${pathspec(p)}`);
    updated.push(p);
  } catch {
    failed.push(p);
  }
}

// --- Review files: write upstream copy beside yours -----------------------
for (const p of reviewPaths) {
  const upstreamContent = tryGit(`show ${ref}:${p}`);
  if (upstreamContent === null) continue;
  const dest = `${p}.upstream`;
  if (!dryRun) writeFileSync(path.join(root, dest), upstreamContent + "\n");
  log(`  • wrote ${dest} — diff it against ${p} and merge by hand`);
}

// --- Report ---------------------------------------------------------------
if (dryRun) {
  log("\n(dry run) framework files that would change:");
  if (updated.length) [...new Set(updated)].forEach((f) => log(`    ${f}`));
  else log("    none — you are up to date");
  process.exit(0);
}

log("\n✓ framework files updated.");
if (failed.length) {
  log("  (skipped — not present at that ref, safe to ignore unless unexpected:)");
  failed.forEach((f) => log(`    ${f}`));
}
log("\nNext steps:");
log("  1. npm install            # framework deps may have changed (see package.json.upstream)");
log("  2. npm run build          # verify the upgrade");
log("  3. git diff               # review framework changes, then commit");
log("\nYour content/, public/, lib/site-config.ts and app/theme.css were left untouched.");
log("Note: files deleted upstream are not auto-removed; check git status.\n");
