import Link from "@/i18n/client";
import { ArrowRight, Boxes, Cloud, Lightbulb, PlayCircle } from "lucide-react";
import SystemCatalogue, { type CatalogueCard } from "@/components/site/SystemCatalogue";
import HeroDiagram from "@/components/site/HeroDiagram";
import LearningPaths, { type LearningPath } from "@/components/site/LearningPaths";
import { getContent } from "@/content";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

/** Icons and hues for the four "what you can do" cards; their text comes from the messages. */
const lenses = [
  { icon: Cloud, hue: "infrastructure" },
  { icon: PlayCircle, hue: "mobility" },
  { icon: Boxes, hue: "commerce-fintech" },
  { icon: Lightbulb, hue: "bookings" },
];

/** Systems in each learning path, in order; titles and levels come from the messages. */
const learningPaths = [
  { hue: "infrastructure", slugs: ["url-shortener", "pastebin", "rate-limiter", "typeahead"] },
  { hue: "mobility", slugs: ["whatsapp", "websocket-scale", "live-sports", "uber"] },
  { hue: "media-social", slugs: ["instagram", "twitter", "youtube", "netflix"] },
  { hue: "commerce-fintech", slugs: ["bookmyshow", "amazon", "payments", "bnpl"] },
];

export default function HomeView({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const { components, concepts, difficultyLabels, getConcept, getSystem, systemCategoryLabels, systems } =
    getContent(locale);
  const lensCards = lenses.map((lens, i) => ({ ...lens, ...t.home.lenses[i] }));
  const hero = getSystem("url-shortener") ?? systems[0];

  const cards: CatalogueCard[] = systems.map((s) => ({
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    category: s.category,
    categoryLabel: systemCategoryLabels[s.category],
    difficulty: s.difficulty,
    difficultyLabel: difficultyLabels[s.difficulty],
    componentCount: s.nodes.length,
    flowCount: s.flows.length,
    complete: s.requirements.functional.length > 0,
    concepts: s.concepts.map((slug) => ({ slug, name: getConcept(slug)?.name ?? slug })),
  }));

  const paths: LearningPath[] = learningPaths.map(({ slugs, hue }, i) => ({
    ...t.home.paths[i],
    hue,
    systems: slugs.flatMap((slug) => {
      const s = getSystem(slug);
      return s ? [{ slug, name: s.name }] : [];
    }),
  }));

  const categories = Object.entries(systemCategoryLabels)
    .filter(([value]) => systems.some((s) => s.category === value))
    .map(([value, label]) => ({ value, label }));

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Hero */}
        <section className="relative isolate grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[1fr_1.15fr]">
          {/* Mesh gradient: three slow-drifting blurred blobs behind the hero. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_72%)]">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[var(--accent)] opacity-20 blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
            <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-[var(--accent-2)] opacity-15 blur-3xl [animation:drift_22s_ease-in-out_infinite_reverse]" />
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[var(--accent-3)] opacity-15 blur-3xl [animation:drift_26s_ease-in-out_infinite]" />
          </div>
          <div>
            <p className="text-sm font-medium text-accent">
              {t.home.stats(systems.length, components.length, concepts.length)}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-fg md:text-5xl">
              {t.home.titleStart}
              <span className="text-brand">{t.home.titleAccent}</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
              {t.home.intro}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/systems/youtube"
                className="inline-flex items-center gap-2 bg-brand shadow-soft rounded-xl px-4 py-2.5 text-sm font-semibold text-[#fff] transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                {t.home.exploreYoutube} <ArrowRight size={16} aria-hidden />
              </Link>
              <a
                href="#catalogue"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
              >
                {t.home.browseAll}
              </a>
            </div>
          </div>
          <HeroDiagram system={hero} />
        </section>

        {/* What you can do */}
        <section aria-labelledby="lenses" className="py-6">
          <h2 id="lenses" className="sr-only">
            {t.home.whatYouCanDo}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lensCards.map(({ icon: Icon, hue, title, text }) => (
              <li
                key={title}
                data-category={hue}
                className="rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-cat-tint text-cat"
                  aria-hidden
                >
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Learning paths: a dark band in both themes breaks up the page. */}
      <section
        aria-labelledby="paths"
        className="scope-dark relative isolate my-10 overflow-hidden bg-bg py-14"
      >
        <div aria-hidden className="bg-brand absolute inset-x-0 top-0 h-px opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-[var(--accent-2)] opacity-15 blur-3xl"
        />
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h2 id="paths" className="text-2xl font-semibold tracking-tight text-fg">
            {t.home.pathsTitle}
          </h2>
          <p className="mt-1 text-muted">
            {t.home.pathsIntro}
          </p>
          <LearningPaths paths={paths} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Catalogue */}
        <section id="catalogue" aria-labelledby="catalogue-title" className="scroll-mt-4 pb-16 pt-6">
          <h2 id="catalogue-title" className="text-2xl font-semibold tracking-tight text-fg">
            {t.home.allSystems}
          </h2>
          <SystemCatalogue
            cards={cards}
            categories={categories}
            difficulties={([1, 2, 3] as const).map((d) => ({ value: String(d), label: difficultyLabels[d] }))}
            conceptOptions={concepts.map((c) => ({ value: c.slug, label: c.name }))}
          />
        </section>
      </div>
    </div>
  );
}
