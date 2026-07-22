import { notFound } from "next/navigation";
import { BentoDocsPage, docsPages, getDocPage } from "@/components/docs-section";

export function generateStaticParams() {
  return docsPages.map((page) => ({ slug: page.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDocPage(slug)) notFound();
  return <BentoDocsPage slug={slug} />;
}
