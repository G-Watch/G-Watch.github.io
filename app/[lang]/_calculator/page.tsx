/*
 * HIDDEN FROM THE SITE, TEMPORARILY.
 *
 * The folder is `_calculator`, and a leading underscore makes it a private
 * folder in the App Router — the files still compile, but no route is
 * generated for them. The two nav entries in lib/site-config.ts are commented
 * out to match.
 *
 * To bring it back: rename this folder to `calculator` and uncomment those two
 * lines. Nothing else was changed, and everything under components/ and
 * lib/arch/ is still built and still covered by tmp/check.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { CalculatorWorkbench } from "@/components/calculator-workbench";
import { getCalculatorCopy } from "@/lib/calculator";
import { getCalculatorDoc } from "@/lib/calculator-doc";
import { renderMathMarkdown } from "@/lib/markdown-math";
import { resolveLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLocale((await params).lang);
  const t = getCalculatorCopy(lang);
  return { title: t.title, description: t.intro };
}

export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  // The methodology document is first-party Markdown+LaTeX, rendered here at
  // build time so the client never loads a math renderer.
  const source = getCalculatorDoc(lang);
  const doc = source ? await renderMathMarkdown(source) : "";

  return (
    <SiteShell lang={lang} fullHeight>
      {/* Full-bleed working surface filling the shell, as Open Traces does:
          nothing scrolls except each column's own region. */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-5 pb-4 pt-4 sm:px-8">
        {/* The workbench reads its active panel from the query string. */}
        <Suspense fallback={null}>
          <CalculatorWorkbench lang={lang} doc={doc} />
        </Suspense>
      </div>
    </SiteShell>
  );
}
