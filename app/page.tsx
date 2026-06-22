import { RootRedirect } from "@/components/root-redirect";
import { defaultLocale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

/**
 * The root path ("/") has no locale, so it forwards to the default locale.
 * The <meta http-equiv="refresh"> makes the redirect instant and works without
 * JavaScript (no splash flash); RootRedirect is the JS fallback and the visible
 * language picker if a browser ignores the refresh.
 */
export default function RootPage() {
  const target = withBasePath(`/${defaultLocale}/`);
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <RootRedirect />
    </>
  );
}
