import ConceptsView, { conceptsMetadata } from "@/views/ConceptsView";

export const metadata = conceptsMetadata("fr");

export default function Page() {
  return <ConceptsView locale="fr" />;
}
