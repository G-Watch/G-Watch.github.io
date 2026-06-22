import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getDictionary } from "@/lib/dictionaries";
import { defaultLocale, localePath } from "@/lib/i18n";

export default function NotFound() {
  const lang = defaultLocale;
  const t = getDictionary(lang).notFound;

  return (
    <SiteShell lang={lang}>
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-32 text-center">
        <p className="font-serif text-7xl font-bold text-accent">404</p>
        <h1 className="mt-4 font-serif text-2xl font-bold text-ink">
          {t.title}
        </h1>
        <p className="mt-3 text-ink-soft">{t.body}</p>
        <Link
          href={localePath(lang, "/")}
          className="mt-8 rounded-full bg-accent px-6 py-3 text-sm font-bold text-paper transition-colors hover:bg-accent-strong"
        >
          {t.home}
        </Link>
      </div>
    </SiteShell>
  );
}
