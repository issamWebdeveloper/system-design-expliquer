import type { Metadata } from "next";
import ConceptView, { conceptMetadata, conceptStaticParams } from "@/views/ConceptView";

// Only the concepts in the content folder exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return conceptStaticParams();
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return conceptMetadata("fr", (await props.params).slug);
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  return <ConceptView locale="fr" slug={(await props.params).slug} />;
}
