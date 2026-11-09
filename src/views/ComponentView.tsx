import type { Metadata } from "next";
import Link from "@/i18n/client";
import { notFound } from "next/navigation";
import type { ServiceOption, ServiceProvider } from "@/types/schema";
import { components, getContent } from "@/content";
import { getProviders } from "@/content/providers";
import type { Locale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { KindIcon } from "@/lib/icons";
import { getCategoryColor } from "@/lib/resolve";

export function componentStaticParams() {
  return components.map((c) => ({ id: c.id }));
}

export function componentMetadata(locale: Locale, id: string): Metadata {
  const kind = getContent(locale).getComponentKind(id);
  if (!kind) return {};
  return { title: getMessages(locale).components.kindMetaTitle(kind.name), description: kind.what };
}

export default function ComponentView({ locale, id }: { locale: Locale; id: string }) {
  const t = getMessages(locale);
  const { componentCategoryLabels, getComponentKind, getConcept, usagesOfComponent } = getContent(locale);
  const providers = getProviders(locale);
  const serviceProviders = providers.filter((p) => p.id !== "generic") as (typeof providers[number] & {
    id: ServiceProvider;
  })[];
  const kind = getComponentKind(id);
  if (!kind) notFound();

  const color = getCategoryColor(kind.category);
  const usages = usagesOfComponent(kind.id);

  return (
    <div className="max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/components" className="text-xs text-muted hover:text-fg">
        {t.components.allComponents}
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <KindIcon kindId={kind.id} size={24} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
            {componentCategoryLabels[kind.category]}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-fg">{kind.name}</h1>
          <p className="mt-2 max-w-2xl text-fg-soft">{kind.what}</p>
        </div>
      </div>

      {(kind.whenToUse.length > 0 || kind.pitfalls.length > 0) && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {kind.whenToUse.length > 0 && <ListCard title={t.components.whenToUse} items={kind.whenToUse} />}
          {kind.pitfalls.length > 0 && <ListCard title={t.components.pitfalls} items={kind.pitfalls} />}
        </div>
      )}

      {(Object.keys(kind.providers).length > 0 || kind.thirdParty.length > 0) && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-fg">{t.components.optionsByProvider}</h2>
          <p className="mt-1 text-sm text-muted">{t.components.firstOption}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {serviceProviders.map((p) => {
              const options = kind.providers[p.id];
              if (!options) return null;
              return (
                <div key={p.id} className="rounded-xl border border-line bg-surface/40 p-4">
                  <h3 className="text-sm font-semibold" style={{ color: p.accent }}>
                    {p.name}
                  </h3>
                  <OptionList options={options} t={t} />
                </div>
              );
            })}
            {kind.thirdParty.length > 0 && (
              <div className="rounded-xl border border-line bg-surface/40 p-4">
                <h3 className="text-sm font-semibold text-fg-soft">{t.components.thirdPartyAnyCloud}</h3>
                <OptionList options={kind.thirdParty} t={t} />
              </div>
            )}
          </div>
        </section>
      )}

      {kind.concepts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-fg">{t.components.relatedConcepts}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {kind.concepts.map((slug) => (
              <Link
                key={slug}
                href={`/concepts/${slug}`}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-500/15"
              >
                {getConcept(slug)?.name ?? slug}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold text-fg">{t.components.usedIn}</h2>
        {usages.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.components.notUsed}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {usages.map(({ system, nodes }) => (
              <li key={system.slug} className="rounded-xl border border-line bg-surface/40 p-4">
                <Link href={`/systems/${system.slug}`} className="font-semibold text-fg hover:underline">
                  {system.name}
                </Link>
                <ul className="mt-2 space-y-1.5">
                  {nodes.map((node) => (
                    <li key={node.id} className="text-sm">
                      <Link
                        href={`/systems/${system.slug}?node=${node.id}#architecture`}
                        className="text-indigo-300 hover:underline"
                      >
                        {node.label}
                      </Link>
                      <span className="text-muted"> — {node.role}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OptionList({ options, t }: { options: ServiceOption[]; t: Messages }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {options.map((o) => (
        <li key={o.name} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-fg-soft">
            {o.name}
            {o.note && <span className="text-xs text-muted"> — {o.note}</span>}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              o.managed ? "bg-sky-500/10 text-sky-300" : "bg-line-strong/50 text-fg-soft"
            }`}
          >
            {o.managed ? t.components.managed : t.components.selfHosted}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-soft marker:text-faint">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
