import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMDXComponents } from '@/components/mdx';
import dates from '@/lib/docs-dates.json';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';
import { source } from '@/lib/source';

const UPDATED = dates as Record<string, string>;
const SECTIONS: Record<string, string> = { concepts: 'Concepts', reference: 'Reference', more: 'More' };

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/web/content/docs/${page.path}`;
  const updated = UPDATED[page.path];

  const group = SECTIONS[page.path.split('/')[0]] ?? 'Getting started';

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} breadcrumb={{ enabled: false }}>
      <nav aria-label="Breadcrumb" className="text-fd-muted-foreground -mb-2 flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/docs" className="hover:text-fd-foreground">Docs</Link>
        <span aria-hidden>/</span>
        <span>{group}</span>
        <span aria-hidden>/</span>
        <span className="text-fd-foreground">{page.data.title}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <DocsTitle>{page.data.title}</DocsTitle>
        <span className="c-pill" title="Every address and transaction on this page is on GenLayer Studio Next, chain 61997">
          <span className="dot" />
          Studio Next
        </span>
      </div>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <EditOnGitHub href={githubUrl} />
        {updated && <PageLastUpdate date={new Date(updated)} />}
      </div>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}
