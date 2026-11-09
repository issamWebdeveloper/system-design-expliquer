import type { Metadata } from "next";
import SystemView, { systemMetadata, systemStaticParams } from "@/views/SystemView";

// Only the systems in the content folder exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return systemStaticParams();
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return systemMetadata("fr", (await props.params).slug);
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  return <SystemView locale="fr" slug={(await props.params).slug} />;
}
