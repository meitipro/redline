import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';

import './global.css';

/*
 * Outfit, Geist Mono and Tektur, loaded by the browser from Google
 * Fonts rather than downloaded at build time, so a build never depends on
 * reaching the font CDN.
 */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Tektur:wght@500;600&display=swap';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://redline-genlayer.vercel.app'),
  title: { default: "Redline: bounties for breaking your agent's rules", template: '%s · Redline' },
  description:
    "A prompt-injection bounty board on GenLayer. Builders post a test version of an agent's instructions with rules and a locked bounty, hunters pay a small fee to attack, every validator runs the agent on its own model and checks the rules, and only a break that reproduces across validators pays.",
  openGraph: { siteName: 'Redline', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0b0b0e', colorScheme: 'dark' };

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ forcedTheme: 'dark', defaultTheme: 'dark', enableSystem: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
