// User-owned: agent-view twin of InstrumentLevels (lib/docs/instrument-levels.tsx).
// The same stack as monospace text; server component, nothing ships to the browser.

// The site styles <code> in PT Mono, which lacks box-drawing glyphs, so the
// font goes on <code> as well (see lib/blog/xtrace-ascii.tsx).
const MONO = {
  fontFamily:
    'ui-monospace, "SF Mono", Menlo, "DejaVu Sans Mono", Consolas, monospace',
  lineHeight: 1.18,
};

const STACK = `┌──────────────┐
│ Source code  │ ◀── PTX tier: scope markers
└──────┬───────┘
       ▼
█ DSL compiler █
       ▼
┌──────────────┐
│     PTX      │ ◀── PTX tier: markers become probes
└──────┬───────┘
       ▼
█    ptxas     █     compiles the probes on the PTX tier
       ▼
┌──────────────┐
│     SASS     │ ◀── SASS tier: probes spliced into the cubin
└──────┬───────┘
       ▼
   execution

PTX tier   instrumentation_tier="ptx"    CUDA, TileLang, CuTeDSL, Triton
SASS tier  instrumentation_tier="sass"   SASS (no markers, no rebuild)`;

export function InstrumentLevelsText() {
  return (
    <>
      <p>
        <strong>Where Xtrace inserts probes</strong>
      </p>
      <pre style={MONO}>
        <code style={MONO}>{STACK}</code>
      </pre>
    </>
  );
}
