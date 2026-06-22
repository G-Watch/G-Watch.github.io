import { notFound } from "next/navigation";
import { locales, isLocale, localeHtmlLang } from "@/lib/i18n";
import { HtmlLang } from "@/components/html-lang";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <>
      <HtmlLang lang={localeHtmlLang[lang]} />
      {children}
    </>
  );
}
