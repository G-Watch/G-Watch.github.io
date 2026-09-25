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
import { InstallWizard } from "@/components/install-wizard";
import {
  Fa3AgentCase,
  Fa4CudnnCase,
  InstrumentStack,
} from "@/lib/blog/xtrace-charts";
import {
  Fa3AgentCaseAscii,
  Fa4CudnnCaseAscii,
  InstrumentStackAscii,
  OpenTraceAscii,
} from "@/lib/blog/xtrace-ascii";
import { OpenTrace } from "@/lib/blog/open-trace";
import { PaperLink, PaperLinkText } from "@/lib/blog/paper-link";

export const mdxComponents = {
  InstallWizard,
  Fa3AgentCase,
  Fa4CudnnCase,
  InstrumentStack,
  OpenTrace,
  PaperLink,
};

// Agent-view overrides: same tag names, rendered for machine readers (the
// agent view layers these on top of mdxComponents).
export const agentMdxComponents = {
  Fa3AgentCase: Fa3AgentCaseAscii,
  Fa4CudnnCase: Fa4CudnnCaseAscii,
  InstrumentStack: InstrumentStackAscii,
  OpenTrace: OpenTraceAscii,
  PaperLink: PaperLinkText,
};
