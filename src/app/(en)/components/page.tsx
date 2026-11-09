import ComponentsView, { componentsMetadata } from "@/views/ComponentsView";

export const metadata = componentsMetadata("en");

export default function Page() {
  return <ComponentsView locale="en" />;
}
