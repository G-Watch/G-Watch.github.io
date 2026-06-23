// User-owned registry of components available inside .mdx content.
//
// Register a component here, then use it as a tag in any .mdx file with no
// per-file import (the registry is the global scope, like Docusaurus):
//
//   // lib/mdx-components.tsx
//   import { Callout } from "@/components/callout";
//   export const mdxComponents = { Callout };
//
//   // some-page.mdx
//   <Callout type="tip">Markdown **works** inside.</Callout>
//
// Interactive components go in their own file with a "use client" directive.
// Seeded by `npm run upgrade` when missing; never overwritten once it exists.
export const mdxComponents = {};
