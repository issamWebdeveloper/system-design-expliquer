// Validates every content file: schema (on import) plus cross-references.
import { components, concepts, systems } from "../src/content";
import { validateContent } from "../src/lib/validate";
import { conceptDiagrams } from "../src/content/conceptDiagrams";
import { systemIcons } from "../src/lib/identity";

const problems = validateContent(components, systems, concepts);
for (const s of systems) {
  if (!systemIcons[s.slug]) problems.push(`system "${s.slug}" has no icon in src/lib/identity.ts`);
}
for (const slug of Object.keys(conceptDiagrams)) {
  if (!concepts.some((c) => c.slug === slug)) problems.push(`conceptDiagrams has an entry for unknown concept "${slug}"`);
}

if (problems.length > 0) {
  console.error(`Content validation failed (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `Content OK: ${components.length} component kinds, ${systems.length} systems, ${concepts.length} concepts.`,
);
