# A-02 — Gestionar marcas de artículos

> **Estado:** implementado · SQL aplicado (2026-08-20) · CRUD verificado end-to-end contra la base.
> **Ruta:** `/marcas` · **Sprint:** 1 · **PF:** 2
> ⚠️ **RLS deshabilitado temporalmente** (2026-08-20) para desarrollar sin login; ver [§6](#6-auditoría-y-permisos-estado-transitorio).

Pantalla de gestión de marcas del catálogo: **alta**, **renombrado** y **baja lógica** (activar/desactivar), con buscador. Además de la HU en sí, este trabajo deja construido el **shell del dashboard** (topbar + sidebar + design system del mockup aprobado), que es reutilizable por los próximos CRUDs (S-01 Depósitos, A-01 Unidades, A-03 Rubros, S-04 Tipos de movimiento).

---

## 1. SQL requerido (✅ ya aplicado el 2026-08-20; se deja como referencia)

La tabla `marca` ya existía; la baja lógica requirió una columna nueva:

```sql
-- Baja lógica de marcas (aplicado)
alter table public.marca
  add column activo boolean not null default true;

-- Evita duplicados por mayúsculas ("Arcor" vs "arcor") — aplicado.
-- El error es 23505, el código lo maneja sin cambios.
create unique index marca_nombre_marca_lower_ux
  on public.marca (lower(trim(nombre_marca)));
```

Nota: si en otro entorno la columna no existe, `/marcas` muestra el error boundary hasta correr el `ALTER`. El SQL no toca RLS ni el trigger `set_editado_marca()`.

Esquema resultante de `marca`: `id_marca` (uuid PK), `nombre_marca` (text, unique, check no-vacío), `activo` (bool, default true), `creado`, `editado` (timestamptz), `creado_por` (text).

## 2. Arquitectura de archivos

```
src/
├─ app/
│  ├─ layout.js                        # raíz: fuentes next/font (Inter + Baloo 2), fondo crema
│  ├─ globals.css                      # design tokens Tailwind 4 (@theme) + .card/.btn-primary/.btn-ghost
│  └─ (dashboard)/                     # route group: NO afecta la URL
│     ├─ layout.js                     # [Server] shell: Topbar + grid [248px|1fr] Sidebar/main
│     └─ marcas/
│        ├─ page.js                    # [Server] fetch marcas + detección de sesión
│        ├─ actions.js                 # ['use server'] crearMarca / renombrarMarca / cambiarActivoMarca
│        ├─ loading.js                 # skeleton (Suspense boundary automático)
│        └─ error.js                   # ['use client'] card de error + Reintentar (reset())
└─ components/
   ├─ dashboard/
   │  ├─ Topbar.js                     # [Server] barra roja degradada, logo, chip Sprint, usuario placeholder
   │  └─ Sidebar.js                    # ['use client' solo por usePathname] nav data-driven
   ├─ marcas/
   │  ├─ MarcasManager.js              # ['use client'] banner sin-sesión, alta inline, buscador, tabla
   │  └─ MarcaRow.js                   # ['use client'] fila: vista / edición inline / toggle activo
   └─ ui/
      └─ Badge.js                      # pill Activa (verde) / Inactiva (ámbar) — reutilizable
```

**No se tocó:** `src/middleware.js` (la migración a `proxy.js` de Next 16 es una tarea aparte del equipo), `src/lib/supabase/*`, `src/app/page.js`.

## 3. Design system (para los próximos CRUDs)

Los tokens del mockup viven como `@theme` en `globals.css` y se usan como utilidades Tailwind:

| Token | Utilidades | Uso |
| --- | --- | --- |
| `rojo` / `rojo-hondo` / `rojo-noche` | `bg-rojo`, `text-rojo-hondo`… | Topbar, acciones destructivas, errores |
| `oro` / `oro-claro` / `oro-hondo` | `border-oro`, `focus:border-oro`… | Botón primario, focos, acentos |
| `crema` / `panel` / `linea` | `bg-crema`, `bg-panel`, `border-linea` | Fondos y bordes |
| `tinta` / `tinta-suave` | `text-tinta`, `text-tinta-suave` | Texto principal / secundario |
| `verde` / `verde-bg`, `ambar` / `ambar-bg`, `rosado` | badges, avisos, item activo del sidebar | Estados |
| `font-baloo` / `font-sans` | títulos y botones primarios / texto | Tipografías (Baloo 2 / Inter vía `next/font`) |
| `shadow-suave`, `rounded-card` | sombra y radio de cards | Cards |

Clases de componente listas (en `@layer components`): **`.card`**, **`.btn-primary`** (degradado oro, texto rojo-noche, Baloo), **`.btn-ghost`**.

**Receta para un CRUD nuevo (ej. S-01 Depósitos):**
1. Crear `src/app/(dashboard)/depositos/{page,actions,loading,error}.js` copiando la estructura de `marcas/`.
2. En `Sidebar.js`, agregarle `href: "/depositos"` al item "Depósitos" (ya existe deshabilitado).
3. Reutilizar `Badge`, `.card`, `.btn-*` y el patrón de actions de `marcas/actions.js`.

## 4. Server actions — contrato y decisiones

Las tres actions devuelven el mismo shape para `useActionState`: **`{ ok: boolean, error: string | null }`**.

| Action | Inputs (formData) | Notas |
| --- | --- | --- |
| `crearMarca` | `nombre_marca` | Setea `creado_por` con el email (o `sub`) de la sesión |
| `renombrarMarca` | `id_marca`, `nombre_marca` | — |
| `cambiarActivoMarca` | `id_marca`, `activo` (valor **nuevo**, `"true"`/`"false"`) | Baja/alta lógica |

Reglas comunes:
- **Validación en servidor**: trim, no vacío, máx. 60 caracteres (además del `required`/`maxLength` del cliente — las actions son invocables por POST directo).
- **Auditoría**: `creado_por` se puebla con `getClaims()` **si hay sesión** (email o `sub`); sin sesión queda `null`. No bloquea (ver §6).
- **Guard de no-op**: un `UPDATE` sobre fila inexistente (o filtrada por RLS cuando vuelva) **no da error**, afecta 0 filas. Por eso todo update lleva `.select("id_marca")` y se valida que haya filas devueltas.
- **Mapeo de errores Postgres**: `23505` → "Ya existe una marca con ese nombre" · `42501` → "No tenés permisos" · `23514` → nombre vacío · resto → genérico.
- Tras mutar: `revalidatePath("/marcas")`.

## 5. Decisiones técnicas (gotchas de Next 16 / React 19)

- **`createClient()` del server es async** (`await cookies()` en Next 16): siempre `const supabase = await createClient()`.
- **Sin sesión, el SELECT devuelve `[]` sin error** (RLS filtra filas): la página nunca infiere sesión de los datos; `getClaims()` decide el banner y el empty state.
- **React 19 resetea los campos no controlados de un `<form action>` al terminar la action, aunque falle**: los inputs de alta y de edición son controlados (no se pierde lo tipeado ante un error, p.ej. nombre duplicado).
- **Nada de `setState` dentro de `useEffect` observando el action state** (regla `react-hooks/set-state-in-effect` del React Compiler): los side-effects de éxito (limpiar input, cerrar edición) se hacen envolviendo la server action en el propio `useActionState`.
- **Fechas formateadas en el server** (`Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })`) y pasadas como string → evita mismatch de hidratación.
- **Edición inline** reemplaza la fila por un `<td colSpan={5}>` con el form (un `<form>` no puede envolver `<tr>`; HTML inválido rompería la hidratación).
- Dark mode del boilerplate **eliminado a propósito**: el design system es claro (`color-scheme: light`).
- **`error.js` usa `retry()` (estable desde Next 16.3), no `reset()`**: `retry()` re-ejecuta el fetch del segmento; `reset()` solo re-renderiza sin volver a consultar (el botón "Reintentar" no serviría). Además el boundary muestra un mensaje fijo en español: en producción Next redacta los `error.message` de Server Components (llegaría texto genérico en inglés) y en dev mostrarlos filtraría detalles del esquema; el detalle técnico va a los logs del server (`console.error` en `page.js`) correlacionable por `digest`.

## 6. Auditoría y permisos (estado transitorio)

**RLS fue deshabilitado temporalmente en la base (2026-08-20)** para poder desarrollar y probar sin login. Consecuencias actuales:
- El CRUD funciona completo sin sesión (los requests van como rol `anon`).
- `creado_por` queda `null` hasta que exista login (las actions ya lo pueblan solas cuando haya sesión).
- No hay ningún gating de sesión en la UI (se quitó el banner y los empty states condicionales).

**Cuando llegue el login** (tarea de otro compañero): re-habilitar RLS con las 4 políticas de `authenticated`. El código ya está preparado: mapea `42501` a "No tenés permisos" y los updates detectan el no-op silencioso de RLS vía `.select()`.

## 7. Verificación

Hecha (2026-08-20):
- ✅ `npm run lint` limpio · `npm run build` OK (`/marcas` = ruta dinámica ƒ).
- ✅ `/marcas` responde 200 con shell completo (topbar, sidebar con "Marcas" activo, fondo crema, fuentes) + form de alta, buscador y empty state.
- ✅ SQL de `activo` + índice case-insensitive aplicados.
- ✅ **CRUD verificado end-to-end contra la base real** (mismas operaciones que las actions, con marca de prueba luego eliminada): alta (201, `activo` default true), duplicado case-insensitive rechazado (23505 por `marca_nombre_marca_lower_ux`), renombrado y toggle `activo` OK con el trigger actualizando `editado` en cada cambio.
- ✅ Revisión adversarial multi-agente (14 agentes): 3 bugs confirmados y corregidos — input de edición controlado (React 19 reseteaba lo tipeado ante error), `retry()` en vez de `reset()` en `error.js` (con `reset()` "Reintentar" no volvía a consultar), mensaje de error fijo en español sin filtrar detalles del esquema.

### Pendientes
- **Cuando llegue el login**: re-habilitar RLS, verificar `creado_por` poblado y el flujo con permisos (42501).

## 8. Cómo correr

```bash
cd erp-epg
npm install
npm run dev     # http://localhost:3000/marcas
```

Requiere `erp-epg/.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
