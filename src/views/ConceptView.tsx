import type { Metadata } from "next";
import Link from "@/i18n/client";
import { notFound } from "next/navigation";
import ConceptFlow from "@/components/concepts/ConceptFlow";
import ConceptVisual from "@/components/concepts/visuals";
import { FamilyIcon } from "@/lib/identity";
import { concepts, getContent } from "@/content";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { KindIcon } from "@/lib/icons";
import { getCategoryColor } from "@/lib/resolve";

export function conceptStaticParams() {
  return concepts.map((c) => ({ slug: c.slug }));
}

export function conceptMetadata(locale: Locale, slug: string): Metadata {
  const concept = getContent(locale).getConcept(slug);
  if (!concept) return {};
  return { title: getMessages(locale).concepts.conceptMetaTitle(concept.name), description: concept.summary };
}

export default function ConceptView({ locale, slug }: { locale: Locale; slug: string }) {
  const t = getMessages(locale);
  const {
    conceptFamilyLabels,
    componentsUsingConcept,
    conceptDiagramSystem,
    getConcept,
    systemsUsingConcept,
  } = getContent(locale);
  const concept = getConcept(slug);
  if (!concept) notFound();

  const usedBySystems = systemsUsingConcept(concept.slug);
  const usedByComponents = componentsUsingConcept(concept.slug);
  const diagram = conceptDiagramSystem(concept);

  return (
    <div data-family={concept.family}>
      <header className="bg-gradient-to-b from-cat-tint to-transparent">
        <div className="mx-auto max-w-4xl px-4 pb-4 pt-6 md:px-8 md:pt-10">
          <Link href="/concepts" className="text-xs text-muted hover:text-fg">
            {t.concepts.allConcepts}
          </Link>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-soft">
            <span className="text-cat">
              <FamilyIcon family={concept.family} size={13} />
            </span>
            {conceptFamilyLabels[concept.family]}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">{concept.name}</h1>
          <p className="mt-2 text-lg text-fg-soft">{concept.summary}</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 pb-10 md:px-8">
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-fg-soft">
          {concept.explanation.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        {(concept.visual || diagram) && (
          <section aria-labelledby="in-action" className="mt-10 space-y-5">
            <div>
              <h2 id="in-action" className="text-xl font-semibold text-fg">
                {t.concepts.inAction}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {concept.visual
                  ? t.concepts.inActionVisual
                  : t.concepts.inActionDiagram}
              </p>
            </div>
            {concept.visual && <ConceptVisual visual={concept.visual} />}
            {diagram && <ConceptFlow system={diagram} />}
          </section>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {concept.howItWorks.length > 0 && <ListCard title={t.concepts.howItWorks} items={concept.howItWorks} />}
          {concept.tradeoffs.length > 0 && <ListCard title={t.concepts.tradeoffs} items={concept.tradeoffs} />}
        </div>

        {usedBySystems.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-fg">{t.concepts.seenIn}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {usedBySystems.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/systems/${s.slug}`}
                    className="block rounded-xl border border-line bg-surface/40 p-4 hover:border-line-strong"
                  >
                    <span className="font-semibold text-fg">{s.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">{s.tagline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {usedByComponents.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-fg">{t.concepts.componentsInvolved}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {usedByComponents.map((c) => (
                <Link
                  key={c.id}
                  href={`/components/${c.id}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface/40 px-3 py-1.5 text-sm text-fg-soft hover:border-line-strong"
                >
                  <span style={{ color: getCategoryColor(c.category) }}>
                    <KindIcon kindId={c.id} size={14} />
                  </span>
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {concept.related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-fg">{t.concepts.related}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {concept.related.map((r) => (
                <Link
                  key={r}
                  href={`/concepts/${r}`}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-500/15"
                >
                  {getConcept(r)?.name ?? r}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-soft marker:text-faint">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
