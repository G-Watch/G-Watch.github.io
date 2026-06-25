import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { defaultLocale, type Locale } from "./i18n";

/** A content collection lives under content/<locale>/<kind>. */
export type Collection = "docs" | "blog";

/** A blog author. Define once in lib/authors.ts, or inline in frontmatter. */
export interface Author {
  /** Display name. */
  name: string;
  /** Avatar image under public/, e.g. "/authors/ada.jpg". */
  avatar?: string;
  /** Contact email — rendered as a mailto link. */
  email?: string;
  /** Affiliation / organization. */
  affiliation?: string;
  /** Optional homepage; the author's name links here when set. */
  url?: string;
}

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
  /** Blog authors: registry keys (see lib/authors.ts) and/or inline objects. */
  authors?: (string | Author)[];
}

/**
 * Resolve a post's raw `authors` frontmatter against an author registry.
 * String entries are looked up by key; object entries are used as-is.
 * Unknown keys are dropped. The registry is passed in so this stays a pure
 * function (the registry lives in user-owned lib/authors.ts).
 */
export function resolveAuthors(
  raw: (string | Author)[] | undefined,
  registry: Record<string, Author>,
): Author[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? registry[entry] : entry))
    .filter((a): a is Author => Boolean(a && a.name));
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
    authors: Array.isArray(meta.authors) ? meta.authors : undefined,
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

/** A node in the docs sidebar tree: either a page or a (possibly nested) folder. */
export interface DocTreeNode {
  type: "doc" | "folder";
  title: string;
  order: number;
  /** Link target — set for pages, and for folders that have an index page. */
  slugPath?: string;
  /** Shown on the docs landing page cards (pages only). */
  description?: string;
  children: DocTreeNode[];
}

/** Filename (without extension) that turns a folder into a landing page. */
const FOLDER_INDEX = "index";

/** "advanced-topics" → "Advanced Topics" (fallback folder title). */
function humanizeSegment(seg: string): string {
  return seg
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the docs sidebar tree. Nesting comes from folders under
 * `content/<locale>/docs/`; a file's `group` frontmatter still groups flat
 * root-level files (backward compatible). An optional `index.md`/`index.mdx` in
 * a folder sets that folder's title/order and gives it an overview page.
 */
export function getDocTree(lang: Locale): DocTreeNode[] {
  const rootChildren: DocTreeNode[] = [];
  const folderByKey = new Map<string, DocTreeNode>();

  const ensureFolder = (keys: string[], titles: string[]): DocTreeNode | null => {
    let parent = rootChildren;
    let acc = "";
    let folder: DocTreeNode | null = null;
    for (let i = 0; i < keys.length; i++) {
      acc += `/${keys[i]}`;
      let f = folderByKey.get(acc);
      if (!f) {
        f = { type: "folder", title: titles[i], order: 1000, children: [] };
        folderByKey.set(acc, f);
        parent.push(f);
      }
      parent = f.children;
      folder = f;
    }
    return folder;
  };

  for (const doc of getAllDocs(lang)) {
    const order = doc.order ?? 1000;
    const last = doc.slug[doc.slug.length - 1];
    const isFolderIndex = doc.slug.length >= 2 && last === FOLDER_INDEX;

    // Folder chain this doc lives under (and its display titles).
    let keys: string[] = [];
    let titles: string[] = [];
    if (doc.slug.length >= 2) {
      keys = doc.slug.slice(0, -1);
      titles = keys.map(humanizeSegment);
    } else if (doc.group && !isFolderIndex) {
      keys = [`group:${doc.group}`];
      titles = [doc.group];
    }

    const folder = ensureFolder(keys, titles);

    if (isFolderIndex && folder) {
      // Configure the folder rather than adding a separate child.
      if (doc.title) folder.title = doc.title;
      folder.slugPath = doc.slugPath;
      folder.description = doc.description;
    } else {
      (folder ? folder.children : rootChildren).push({
        type: "doc",
        title: doc.title,
        order,
        slugPath: doc.slugPath,
        description: doc.description,
        children: [],
      });
    }

    // Let the smallest child order float each ancestor folder up the list.
    let acc = "";
    for (const k of keys) {
      acc += `/${k}`;
      const f = folderByKey.get(acc);
      if (f) f.order = Math.min(f.order, order);
    }
  }

  const sortNodes = (nodes: DocTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    for (const n of nodes) if (n.children.length) sortNodes(n.children);
  };
  sortNodes(rootChildren);
  return rootChildren;
}

/** Flatten the page leaves under a set of nodes (depth-first), for card lists. */
export function flattenDocLeaves(nodes: DocTreeNode[]): DocTreeNode[] {
  const out: DocTreeNode[] = [];
  const walk = (ns: DocTreeNode[]) => {
    for (const n of ns) {
      if (n.type === "doc") out.push(n);
      else walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Pages in sidebar reading order (depth-first) — drives prev/next links. */
export function getDocsReadingOrder(
  lang: Locale,
): { slugPath: string; title: string }[] {
  const out: { slugPath: string; title: string }[] = [];
  const walk = (nodes: DocTreeNode[]) => {
    for (const n of nodes) {
      if (n.slugPath) out.push({ slugPath: n.slugPath, title: n.title });
      if (n.children.length) walk(n.children);
    }
  };
  walk(getDocTree(lang));
  return out;
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
