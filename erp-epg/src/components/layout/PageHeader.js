import Link from "next/link";

/**
 * @param {{
 *   crumbs?: Array<{ label: string, href?: string }>,
 *   title: string,
 *   description?: string,
 *   actions?: import('react').ReactNode,
 * }} props
 */
export function PageHeader({
  crumbs = [],
  title,
  description,
  actions,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {crumbs.length > 0 ? (
          <nav className="mb-2 text-sm text-palacio-muted">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`}>
                {i > 0 ? <span className="mx-1.5">›</span> : null}
                {c.href ? (
                  <Link
                    href={c.href}
                    className="hover:text-palacio-red hover:underline"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-palacio-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
