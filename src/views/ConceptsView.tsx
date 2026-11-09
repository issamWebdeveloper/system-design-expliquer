import type { Metadata } from "next";
import Link from "@/i18n/client";
import { conceptFamilies } from "@/types/schema";
import { getContent } from "@/content";
import { FamilyIcon } from "@/lib/identity";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

export function conceptsMetadata(locale: Locale): Metadata {
  const t = getMessages(locale);
  return { title: t.concepts.metaTitle, description: t.concepts.metaDescription };
}

export default function ConceptsView({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const { conceptFamilyLabels, concepts, systemsUsingConcept } = getContent(locale);
  const groups = conceptFamilies
    .map((family) => ({ family, items: concepts.filter((c) => c.family === family) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">{t.concepts.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {t.concepts.intro}
      </p>

      <nav aria-label={t.concepts.families} className="mt-6 flex flex-wrap gap-2">
        {groups.map(({ family, items }) => (
          <a
            key={family}
            href={`#${family}`}
            data-family={family}
            className="flex items-center gap-2 rounded-full bg-cat-tint px-3 py-1.5 text-sm font-medium text-fg transition-opacity hover:opacity-80"
          >
            <span className="text-cat">
              <FamilyIcon family={family} size={14} />
            </span>
            {conceptFamilyLabels[family]}
            <span className="text-muted">{items.length}</span>
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-12">
        {groups.map(({ family, items }) => (
          <section key={family} id={family} data-family={family} className="scroll-mt-6">
            <h2 className="flex items-center gap-2.5 text-xl font-semibold text-fg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cat-tint text-cat">
                <FamilyIcon family={family} size={16} />
              </span>
              {conceptFamilyLabels[family]}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((concept) => {
                const usedIn = systemsUsingConcept(concept.slug);
                return (
                  <li key={concept.slug}>
                    <Link
                      href={`/concepts/${concept.slug}`}
                      className="flex h-full flex-col rounded-2xl border border-line border-t-[3px] border-t-cat bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
                    >
                      <p className="font-semibold text-fg">{concept.name}</p>
                      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{concept.summary}</p>
                      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                        {concept.visual && (
                          <span className="rounded-full bg-cat-tint px-2 py-0.5 font-medium text-fg">{t.concepts.interactive}</span>
                        )}
                        <span className="truncate">
                          {usedIn.length > 0 ? t.concepts.seenInList(usedIn.map((s) => s.name).join(", ")) : t.concepts.reference}
                        </span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
