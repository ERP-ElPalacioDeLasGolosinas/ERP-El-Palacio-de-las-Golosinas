<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# El Palacio de las Golosinas — Contexto ERP

Sistema de gestión para "El Palacio de las Golosinas". Backend: **Supabase** (Postgres + Auth + RLS). Este documento es la fuente de verdad del estado actual de la base y del backlog del Sprint 1. Seguirlo al generar migraciones, SQL, APIs o pantallas.

## Convenciones de la base (obligatorias en TODO lo nuevo)

- **PK**: `uuid`, default `gen_random_uuid()`.
- **Nombres de columnas** en español, con sufijo de la entidad (`nombre_marca`, `nombre_producto`), no genéricos (`nombre`).
- Toda columna de **texto obligatoria** lleva `check (length(trim(columna)) > 0)` — no basta con `NOT NULL`.
- **Auditoría** en todas las tablas: `creado timestamptz default now()`, `editado timestamptz default now()`, `creado_por text`.
- **Trigger** `BEFORE UPDATE` por tabla (`set_editado_<tabla>()`) que actualiza `editado` y evita que se pisen `creado` / `creado_por`. La función debe llevar `set search_path = public`.
- **RLS** habilitado en toda tabla nueva, con 4 políticas para `authenticated`: `SELECT` / `INSERT` / `UPDATE` / `DELETE`, todas con `using (true)` / `with check (true)` por ahora.
  - El control de acceso por `rol_usuario` **NO** está implementado a nivel RLS todavía (lo hace otro compañero). No bloquea el resto del desarrollo.
- **Cantidades**: `integer` con `check (>= 0)`. **Precios/costos**: `numeric` con `check (>= 0)`, default `0`.
- **Nada de tablas de stock sueltas**: el stock se calcula desde lotes/movimientos vía **vistas**, nunca como número suelto a sincronizar a mano.

## Tablas existentes

| Tabla | Notas |
| --- | --- |
| `usuario` | PK `id_usuario` FK → `auth.users`. Campos: nombre, apellido, fecha_nacimiento, `dni_usuario` (unique, check > 0), telefono, mail (check email), `rol_usuario` enum (`Empleado Deposito`, `Empleado Ventas`, `Empleado Compras`, `Gerente`), `creado`, `editado`. |
| `marca` | A-02 listo a nivel tabla. `nombre_marca` unique, no vacío + auditoría. |
| `deposito` | S-01 listo a nivel tabla. `nombre_deposito` unique, `direccion_deposito`, `activo` bool default true + auditoría. |
| `producto` | Catálogo (A-05). FK `id_marca`. Tiene nombre, descripción, `precio_producto`, `codigo_producto` unique. **Faltan** FKs/columnas a `unidad_medida`, rubro y/o categoría. |
| `lote` | Identidad del lote (producto, usuario que cargó, número, fechas, `cantidad_inicial`, `precio_costo`). **Sin** cantidad actual. |
| `lote_deposito` | Stock real: `cantidad_actual` por lote×depósito. `UNIQUE(id_lote, id_deposito)`. |

### Relaciones clave

- `producto` → `marca`
- `lote` → `producto`, `usuario`
- `lote_deposito` → `lote`, `deposito`
- `usuario.id_usuario` → `auth.users.id`

## Vistas existentes

Todas con `security_invoker = true` (respetan RLS del consultante):

- `vista_stock_producto` — stock total por producto (todos los depósitos) + próximo vencimiento.
- `vista_stock_producto_deposito` — stock por producto desglosado por depósito.
- `vista_lote_detalle` — lote×depósito con `estado_lote` (`Vigente` / `Por vencer` ≤15 días / `Vencido` / `Agotado`).

## Pendiente conocido (no bloqueante)

- Falta trigger que valide que la suma de `lote_deposito.cantidad_actual` de un lote no supere `lote.cantidad_inicial` (cruza tablas; no se resuelve con un `CHECK` simple).
- RLS por `rol_usuario` pendiente (otro compañero).

## Backlog Sprint 1 — estado respecto a la base

### Oleada 1 (en paralelo)

| Ítem | Estado |
| --- | --- |
| A-01 Unidades de medida | Falta tabla `unidad_medida` |
| A-02 Marcas | Tabla `marca` lista → armar back/CRUD |
| A-03 Rubros | Falta tabla `rubro` |
| S-01 Depósitos | Tabla `deposito` lista → armar back/CRUD |
| S-04 Tipos de movimiento | Falta tabla `tipo_movimiento` |

### Oleada 2 (cuando A-03 esté lista)

| Ítem | Estado |
| --- | --- |
| A-04 Categorías | Falta tabla `categoria` (probablemente FK → `rubro`) |

### Oleada 3 (cuando estén A-01..A-04)

| Ítem | Estado |
| --- | --- |
| A-05 Registrar artículo | `producto` existe; faltan columnas/FKs a unidad, rubro y/o categoría |

### Oleada 4 (al final, con A-05 + S-01)

| Ítem | Estado |
| --- | --- |
| S-03 Consultar stock | Datos OK vía vistas; falta pantalla/endpoint |
| S-05 Movimiento de stock | Falta tabla `movimiento_stock` (auditoría de cambios sobre `lote_deposito`) |

## Al generar código / SQL

1. Respetar convenciones de arriba al pie.
2. No inventar tablas de stock ni columnas de stock sincronizadas a mano.
3. No implementar RLS por rol hasta que el compañero a cargo lo haga; usar las 4 políticas abiertas de `authenticated`.
4. Extender el modelo existente (`lote` / `lote_deposito` / vistas) en lugar de reemplazarlo.

---

# Tarea: Login + Autenticación por Roles con Supabase (Next.js / React)

## Contexto del proyecto

- **Framework**: Next.js (App Router), React
- **Backend**: Supabase (proyecto `ERP-ElPalacioDeLasGolosinas`, región `sa-east-1`)
- **Estructura relevante actual**:

```
src/
  app/
    (auth)/
      login/
        page.jsx        <- ya existe, hay que implementarla
    favicon.ico
    globals.css
    layout.js
    page.js
  lib/                   <- acá van los clientes de Supabase y helpers de auth
middleware.js             <- acá va la protección de rutas por sesión/rol
```

## Estructura de la tabla `usuario` (Supabase)

| Columna | Tipo | Notas |
|---|---|---|
| `id_usuario` | uuid (PK) | FK 1:1 con `auth.users.id` |
| `nombre_usuario` | text | |
| `apellido_usuario` | text | |
| `fecha_nacimiento_usuario` | date | |
| `dni_usuario` | integer | único, > 0 |
| `telefono_usuario` | text | |
| `mail_usuario` | text | validado con regex de email |
| `rol_usuario` | enum `rol_usuario_enum` | `Empleado Deposito`, `Empleado Ventas`, `Empleado Compras`, `Gerente` |
| `creado` / `editado` | timestamptz | |

Como `id_usuario` es la misma PK que `auth.users.id`, el patrón estándar de Supabase (join directo por `auth.uid()`) aplica sin tablas intermedias.

## ⚠️ Prerrequisito de seguridad (bloqueante)

Actualmente **RLS está deshabilitado** en `usuario`, `marca`, `producto`, `lote`, `deposito` y `lote_deposito`. Cualquiera con la anon key puede leer/escribir esas tablas sin restricción. Antes de exponer el login en producción hay que:

1. Habilitar RLS en esas tablas.
2. Crear políticas mínimas (ver sección 5).

No hacer esto deja los roles de negocio como una capa puramente visual, sin protección real a nivel de datos.

---

## 1. Clientes de Supabase (`src/lib/supabase/`)

Crear tres archivos usando `@supabase/ssr`:

- **`client.ts`** — cliente para Client Components (browser), vía `createBrowserClient`.
- **`server.ts`** — cliente para Server Components y Server Actions, vía `createServerClient` leyendo/escribiendo cookies con las utilidades de `next/headers`.
- **`middleware.ts`** — helper de cliente específico para usar dentro de `middleware.js`, que refresca la sesión y sincroniza cookies en la response.

Variables de entorno necesarias (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 2. `middleware.js` (protección de rutas)

Responsabilidades:

1. Refrescar la sesión de Supabase en cada request (`supabase.auth.getUser()`).
2. Si no hay sesión y la ruta no es `/login` (ni assets públicos) → redirigir a `/login`.
3. Si hay sesión → resolver el rol del usuario (join `usuario.id_usuario = auth.uid()`).
4. Aplicar reglas de acceso por rol a nivel de ruta, por ejemplo:
   - `/compras/*` → solo `Empleado Compras` y `Gerente`
   - `/ventas/*` → solo `Empleado Ventas` y `Gerente`
   - `/deposito/*` → solo `Empleado Deposito` y `Gerente`
   - `/gerencia/*` → solo `Gerente`
5. Configurar el `matcher` del middleware para que corra en todas las rutas excepto estáticos (`_next/static`, `_next/image`, `favicon.ico`, etc.).

> Nota de performance: resolver el rol en cada request implica una consulta extra. Evaluar cachearlo en una cookie firmada de corta duración o en un JWT custom claim (Supabase permite agregar custom claims vía Auth Hooks) para no pegarle a la DB en cada navegación.

## 3. `src/app/(auth)/login/page.jsx`

- Formulario controlado: email + password (Client Component).
- Envía los datos a una **Server Action** (`src/app/(auth)/login/actions.js` o similar) que:
  1. Llama a `supabase.auth.signInWithPassword({ email, password })`.
  2. Si falla, retorna el error al formulario (credenciales inválidas, etc.).
  3. Si tiene éxito, consulta `usuario.rol_usuario` del usuario logueado.
  4. Redirige (`redirect()`) al dashboard correspondiente según el rol, o a un dashboard único que internamente renderiza distinto según rol.
- Manejo de estados: loading, error, "recordarme" (opcional), link de "olvidé mi contraseña" (opcional, usa `supabase.auth.resetPasswordForEmail`).

## 4. Lógica de roles (`src/lib/auth/roles.js`)

- **`getUserWithRole()`**: función server-side que combina `supabase.auth.getUser()` con la fila de `usuario` (trae rol, nombre, etc.). Usarla en Server Components y Server Actions para no repetir la query.
- **Mapa de permisos por rol**, por ejemplo:

```js
export const PERMISOS = {
  "Gerente": ["ver_todo", "editar_todo", "gestionar_usuarios"],
  "Empleado Compras": ["ver_compras", "crear_compra"],
  "Empleado Ventas": ["ver_ventas", "crear_venta"],
  "Empleado Deposito": ["ver_stock", "editar_stock"],
};
```

- Helper `hasPermission(rol, permiso)` para usar tanto en middleware como en componentes (mostrar/ocultar botones, bloquear acciones).

## 5. Row Level Security (Supabase)

Habilitar RLS y políticas base:

```sql
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;

-- Un usuario puede ver su propia fila
CREATE POLICY "usuario ve su propio registro"
ON public.usuario FOR SELECT
USING (auth.uid() = id_usuario);

-- Gerente puede ver todos los usuarios
CREATE POLICY "gerente ve todos los usuarios"
ON public.usuario FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario u
    WHERE u.id_usuario = auth.uid() AND u.rol_usuario = 'Gerente'
  )
);
```

Repetir el patrón (ajustado a cada caso de negocio) para `producto`, `marca`, `lote`, `deposito`, `lote_deposito`: definir qué rol puede `SELECT`/`INSERT`/`UPDATE`/`DELETE` en cada una.

---

## Checklist de implementación

- [ ] Instalar `@supabase/ssr` y `@supabase/supabase-js`
- [ ] Variables de entorno configuradas
- [ ] `lib/supabase/client.ts`, `server.ts`, `middleware.ts`
- [ ] `middleware.js` con refresco de sesión + protección por ruta/rol
- [ ] `lib/auth/roles.js` con `getUserWithRole()` y mapa de permisos
- [ ] `app/(auth)/login/page.jsx` + Server Action de login
- [ ] Redirección post-login según rol
- [ ] RLS habilitado + políticas por tabla y por rol
- [ ] (Opcional) recuperación de contraseña
- [ ] (Opcional) custom claims en JWT para evitar query de rol en cada request

---

# Logout + Persistencia de Sesión + Auto-logout por Inactividad

Sobre la base de autenticación (login con Supabase SSR + middleware por roles), se agregó:

## Archivos

| Archivo | Propósito |
|---|---|
| `src/app/(auth)/logout/actions.js` | Server Action `logout()`: `supabase.auth.signOut()` en servidor + `redirect("/login")`. |
| `src/components/auth/LogoutButton.jsx` | Client Component reutilizable. `<form action={logout}>` con botón que usa `useFormStatus` para mostrar "Cerrando...". Recibe `className` para integrarse en cualquier navbar/sidebar. |
| `src/components/auth/InactivityProvider.jsx` | Envuelve `children` en `RootLayout`. Detecta inactividad solo en el cliente y cierra sesión automáticamente. |

## Flujo de logout manual

1. `<LogoutButton />` se coloca en cualquier navbar/sidebar.
2. Al hacer submit, corre la Server Action `logout()`, que invalida la sesión en el servidor (cookies) y redirige a `/login`.

## Flujo de auto-logout por inactividad

`InactivityProvider` (montado en `src/app/layout.js`, envolviendo toda la app):

- Se suscribe a `supabase.auth.onAuthStateChange` (cliente browser) para saber si hay sesión activa. Sin sesión, no registra listeners ni corre lógica.
- Con sesión activa, escucha `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click` en `window` para reiniciar el timer de actividad.
- Un chequeo cada 30s evalúa el tiempo inactivo:
  - A los **24 minutos** de inactividad → modal de aviso con countdown en tiempo real.
  - A los **25 minutos** → logout automático (`supabase.auth.signOut()` client-side + `router.push("/login")`).
- El modal tiene un botón "Seguir conectado" que reinicia el timer sin cerrar sesión.
- Timeout único de 25 min para todos los roles; la lógica vive enteramente en el cliente, sin sincronización server-side.

## Persistencia de sesión

Las cookies de sesión de Supabase son httpOnly y se refrescan en cada request vía `updateSession` (`src/lib/supabase/middleware.js`, invocado desde `src/proxy.js`). Recargar la página no cierra la sesión; solo el logout manual o el auto-logout por inactividad la invalidan.

## Cómo usar `<LogoutButton>`

```jsx
import { LogoutButton } from "@/components/auth/LogoutButton";

<LogoutButton className="rounded px-3 py-2 text-sm font-medium hover:bg-black/5" />
```
