import ConceptsView, { conceptsMetadata } from "@/views/ConceptsView";

export const metadata = conceptsMetadata("en");

export default function Page() {
  return <ConceptsView locale="en" />;
}
