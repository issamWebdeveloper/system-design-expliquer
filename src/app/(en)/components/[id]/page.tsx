import type { Metadata } from "next";
import ComponentView, { componentMetadata, componentStaticParams } from "@/views/ComponentView";

// Only the component kinds in the catalogue exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return componentStaticParams();
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return componentMetadata("en", (await props.params).id);
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return <ComponentView locale="en" id={(await props.params).id} />;
}
