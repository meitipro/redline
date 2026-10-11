import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Redline';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'meitipro',
  repo: 'redline',
  branch: 'main',
};

/** The public site, for links pasted outside it (badges). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://redline-genlayer.vercel.app';

export const REPO_URL = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
