import ComponentsView, { componentsMetadata } from "@/views/ComponentsView";

export const metadata = componentsMetadata("fr");

export default function Page() {
  return <ComponentsView locale="fr" />;
}
