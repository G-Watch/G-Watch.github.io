import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { defaultLocale, type Locale } from "./i18n";

/** A content collection lives under content/<locale>/<kind>. */
export type Collection = "docs" | "blog";

export interface ContentMeta {
  title: string;
  description?: string;
  /** ISO date (blog posts). */
  date?: string;
  /** Sidebar sort key for docs (lower comes first). */
  order?: number;
  /** Sidebar group heading for docs. */
  group?: string;
  tags?: string[];
  draft?: boolean;
}

export interface ContentItem extends ContentMeta {
  collection: Collection;
  /** Path segments, e.g. ["guide", "authoring"]. */
  slug: string[];
  /** Joined slug, e.g. "guide/authoring". */
  slugPath: string;
  /** Raw body (frontmatter stripped) — Markdown for "md", MDX for "mdx". */
  body: string;
  /** Source format: plain Markdown or MDX (allows custom components). */
  format: "md" | "mdx";
}

const CONTENT_ROOT = path.join(process.cwd(), "content");

function collectionDir(lang: Locale, collection: Collection): string {
  return path.join(CONTENT_ROOT, lang, collection);
}

/** Matches the content file extensions: .md, .mdx, .markdown. */
const CONTENT_EXT = /\.(mdx?|markdown)$/;

/** Recursively list every Markdown/MDX file under a directory. */
function walkMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (CONTENT_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function fileToItem(
  collection: Collection,
  baseDir: string,
  file: string,
): ContentItem {
  const rel = path.relative(baseDir, file);
  const slug = rel.replace(CONTENT_EXT, "").split(path.sep);
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const meta = data as ContentMeta;
  return {
    collection,
    slug,
    slugPath: slug.join("/"),
    body: content,
    format: /\.mdx$/.test(file) ? "mdx" : "md",
    title: meta.title ?? slug[slug.length - 1],
    description: meta.description,
    date: meta.date ? String(meta.date) : undefined,
    order: typeof meta.order === "number" ? meta.order : undefined,
    group: meta.group,
    tags: meta.tags,
    draft: meta.draft ?? false,
  };
}

const isProd = process.env.NODE_ENV === "production";

/** Load every item of one collection for a single locale folder. */
function loadLocale(lang: Locale, collection: Collection): ContentItem[] {
  const dir = collectionDir(lang, collection);
  return walkMarkdown(dir).map((file) => fileToItem(collection, dir, file));
}

/**
 * Load a collection for `lang`, falling back to the default locale for any
 * document missing a translation. Localized files override default ones by
 * slug.
 */
function loadCollection(lang: Locale, collection: Collection): ContentItem[] {
  const bySlug = new Map<string, ContentItem>();
  if (lang !== defaultLocale) {
    for (const item of loadLocale(defaultLocale, collection)) {
      bySlug.set(item.slugPath, item);
    }
  }
  for (const item of loadLocale(lang, collection)) {
    bySlug.set(item.slugPath, item);
  }
  return [...bySlug.values()].filter(
    (item) => !(isProd && item.draft),
  );
}

/* ------------------------------------------------------------------ docs -- */

export function getAllDocs(lang: Locale): ContentItem[] {
  return loadCollection(lang, "docs").sort((a, b) => {
    const ao = a.order ?? 1000;
    const bo = b.order ?? 1000;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}

export function getDoc(lang: Locale, slug: string[]): ContentItem | undefined {
  const target = slug.join("/");
  return getAllDocs(lang).find((d) => d.slugPath === target);
}

export interface DocGroup {
  group: string;
  items: ContentItem[];
}

/** Docs grouped by their `group` frontmatter, preserving sorted order. */
export function getDocsNav(lang: Locale): DocGroup[] {
  const groups: DocGroup[] = [];
  for (const doc of getAllDocs(lang)) {
    const name = doc.group ?? "Docs";
    let bucket = groups.find((g) => g.group === name);
    if (!bucket) {
      bucket = { group: name, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(doc);
  }
  return groups;
}

/* ------------------------------------------------------------------ blog -- */

export function getAllBlogPosts(lang: Locale): ContentItem[] {
  return loadCollection(lang, "blog").sort((a, b) => {
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    return bd.localeCompare(ad);
  });
}

export function getBlogPost(
  lang: Locale,
  slug: string[],
): ContentItem | undefined {
  const target = slug.join("/");
  return getAllBlogPosts(lang).find((p) => p.slugPath === target);
}
