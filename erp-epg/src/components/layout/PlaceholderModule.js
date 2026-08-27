import { PageHeader } from "@/components/layout/PageHeader";

/**
 * @param {{
 *   crumbs?: Array<{ label: string, href?: string }>,
 *   title: string,
 *   description: string,
 * }} props
 */
export function PlaceholderModule({ crumbs = [], title, description }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader crumbs={crumbs} title={title} description={description} />
      <div className="palacio-card px-6 py-12 text-center">
        <p className="text-sm text-palacio-muted">
          Este módulo todavía no tiene pantalla implementada.
        </p>
      </div>
    </div>
  );
}
