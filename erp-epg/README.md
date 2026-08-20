# ERP EPG

ERP de "El Palacio de las Golosinas" — Next.js 16 + Supabase (Postgres + Auth + RLS) + Tailwind 4.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Requiere un `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Documentación

- [`AGENTS.md`](./AGENTS.md) — **fuente de verdad**: convenciones de base de datos y backlog del Sprint 1. Leerlo antes de codear.
- [`docs/A-02-marcas.md`](./docs/A-02-marcas.md) — CRUD de marcas (`/marcas`): arquitectura, design system reutilizable del dashboard y receta para los próximos CRUDs.

## Módulos

| Ruta | HU | Estado |
| --- | --- | --- |
| `/marcas` | A-02 Gestionar marcas | ✅ Implementado y verificado contra la base |
