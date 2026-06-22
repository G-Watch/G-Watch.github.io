import type { Metadata } from "next";
import { PT_Sans, PT_Serif, PT_Mono } from "next/font/google";
import { siteConfig, getSiteContent } from "@/lib/site-config";
import { defaultLocale, localeHtmlLang } from "@/lib/i18n";
import "./globals.css";

const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const ptMono = PT_Mono({
  variable: "--font-pt-mono",
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
});

const defaultContent = getSiteContent(defaultLocale);

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${defaultContent.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: defaultContent.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={localeHtmlLang[defaultLocale]}
      className={`${ptSans.variable} ${ptSerif.variable} ${ptMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
