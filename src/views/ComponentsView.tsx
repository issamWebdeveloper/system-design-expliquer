import type { Metadata } from "next";
import Link from "@/i18n/client";
import type { ComponentCategory, ServiceProvider } from "@/types/schema";
import { getContent } from "@/content";
import { getProviders } from "@/content/providers";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { KindIcon } from "@/lib/icons";
import { getCategoryColor } from "@/lib/resolve";

export function componentsMetadata(locale: Locale): Metadata {
  const t = getMessages(locale);
  return { title: t.components.metaTitle, description: t.components.metaDescription };
}

export default function ComponentsView({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const { componentCategoryLabels, components, usagesOfComponent } = getContent(locale);
  const providers = getProviders(locale);
  const serviceProviders = providers.filter((p) => p.id !== "generic") as (typeof providers[number] & {
    id: ServiceProvider;
  })[];
  const groups = (Object.keys(componentCategoryLabels) as ComponentCategory[])
    .map((category) => ({ category, items: components.filter((c) => c.category === category) }))
    .filter((g) => g.items.length > 0 && g.category !== "client");

  return (
    <div className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-bold text-fg">{t.components.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {t.components.intro}
      </p>

      <div className="mt-8 space-y-10">
        {groups.map(({ category, items }) => (
          <section key={category}>
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: getCategoryColor(category) }}>
              {componentCategoryLabels[category]}
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-60 px-4 py-2.5 font-semibold">{t.components.component}</th>
                    {serviceProviders.map((p) => (
                      <th key={p.id} className="px-4 py-2.5 font-semibold" style={{ color: p.accent }}>
                        {p.shortName}
                      </th>
                    ))}
                    <th className="w-24 px-4 py-2.5 font-semibold">{t.components.usedIn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((c) => {
                    const used = usagesOfComponent(c.id).length;
                    return (
                      <tr key={c.id} className="bg-surface/40 align-top">
                        <td className="px-4 py-3">
                          <Link href={`/components/${c.id}`} className="group flex items-center gap-2.5">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${getCategoryColor(c.category)}26`, color: getCategoryColor(c.category) }}
                            >
                              <KindIcon kindId={c.id} size={15} />
                            </span>
                            <span className="font-medium text-fg group-hover:underline">{c.name}</span>
                          </Link>
                        </td>
                        {serviceProviders.map((p) => {
                          const options = c.providers[p.id];
                          return (
                            <td key={p.id} className="px-4 py-3 text-fg-soft">
                              {options ? (
                                <>
                                  {options[0].name}
                                  {options.length > 1 && (
                                    <span className="ml-1 text-xs text-muted">+{options.length - 1}</span>
                                  )}
                                </>
                              ) : c.thirdParty.length > 0 ? (
                                <span className="text-xs text-muted">{t.components.thirdParty}</span>
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-muted">
                          {used > 0 ? t.components.systemsCount(used) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
