import { PageHeader } from "@/components/layout/PageHeader";

/**
 * Pantalla placeholder para módulos aún no implementados (Sprint 2).
 *
 * @param {{
 *   crumbs?: Array<{ label: string, href?: string }>,
 *   title: string,
 *   description: string,
 *   hu?: string,
 * }} props
 */
export function PlaceholderModule({ crumbs = [], title, description, hu }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={crumbs}
        title={title}
        description={
          hu ? `${description} (${hu}).` : description
        }
      />
      <div className="palacio-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-zinc-800">Por implementarse</p>
        {hu ? (
          <p className="mt-1 text-xs text-palacio-muted">Historia {hu}</p>
        ) : null}
      </div>
    </div>
  );
}
