<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# El Palacio de las Golosinas — Contexto ERP

Sistema de gestión para "El Palacio de las Golosinas". Frontend: **Next.js 16 (App Router) + React 19**. Backend: **Supabase** (proyecto `ERP-ElPalacioDeLasGolosinas`, ref `tpibycxcmfasnvleyelz`, región `sa-east-1`, Postgres 17). Este documento es la fuente de verdad del estado actual de la base y del frontend. Está reconstruido a partir del código en `src/` y de una inspección directa del proyecto Supabase (no asumir que coincide con documentación previa ni con `supabase/migrations/` del repo, que está muy desactualizado — ver sección "Migraciones" más abajo).

## Convenciones de la base (obligatorias en TODO lo nuevo)

- **PK**: `uuid`, default `gen_random_uuid()`.
- **Nombres de columnas** en español, con sufijo de la entidad (`nombre_marca`, `nombre_producto`), no genéricos (`nombre`). Excepción heredada: `unidad_medida` y `tipo_movimiento` usan `nombre` a secas — no lo repitas en tablas nuevas.
- Toda columna de **texto obligatoria** lleva `check (length(trim(columna)) > 0)` — no basta con `NOT NULL`.
- **Auditoría**: la mayoría de las tablas tiene `creado` / `editado` (`timestamptz default now()`) + `creado_por uuid default auth.uid()` (algunas además tienen `editado_por`). Tablas con flujo de aprobación/edición posterior (`compra`, `compra_producto`, `inventario`, `inventario_producto`) usan `fecha_registro` en vez de `creado`/`editado`.
- **Trigger** `BEFORE UPDATE` por tabla (patrón `set_editado_<tabla>()`) que actualiza `editado` y evita que se pisen `creado` / `creado_por`. La función debe llevar `set search_path = public`.
- **RLS habilitado en todas las tablas** (ya no son políticas abiertas `using (true)` genéricas). El patrón actual por tabla de catálogo/operación es 4 políticas para `authenticated` (`SELECT`/`INSERT`/`UPDATE`/`DELETE`); `usuario` tiene políticas más finas (ver abajo). El control de acceso por `rol_usuario` a nivel de RLS **sigue sin implementarse** salvo lo que ya existe en `usuario` — no bloquea el resto del desarrollo pero no asumas que ya está resuelto en otras tablas.
- **Cantidades**: `numeric` (no `integer`) con `check (>= 0)` o `(> 0)` según el caso — se migró de `integer` a `numeric` para soportar fraccionamiento (ver `producto.numero_medida`, `inventario_producto.cantidad_inventario`, `movimiento_stock.cantidad`, etc.). **Precios/costos**: `numeric` con `check (>= 0)`, default `0`.
- **Nada de tablas de stock sueltas actualizadas a mano desde el cliente**: el stock vive en `stock` (por producto×depósito) y se mueve exclusivamente vía funciones (`fn_movimiento_stock_registrar`, `fn_aplicar_stock_compra`) que registran también en `movimiento_stock` / `movimiento_stock_detalle`. No hacer `UPDATE` directo de `stock.cantidad` desde el frontend.
- **Patrón de escritura preferido: RPC (`supabase.rpc(...)`), no `insert`/`update` directo desde Server Actions.** Casi toda la lógica de negocio (validaciones cruzadas, mensajes de error en español, side-effects) vive en funciones `plpgsql` (`fn_<entidad>_crear/modificar/eliminar/habilitar/inhabilitar/listar`). Las Server Actions en `src/lib/**/actions.js` son capas finas que arman el payload, llaman al RPC y traducen errores — replicar ese patrón para módulos nuevos.

## Inventario de tablas (estado real en Supabase, no en migraciones)

| Tabla | Filas | Notas |
| --- | --- | --- |
| `usuario` | 6 | PK `id_usuario` FK → `auth.users`. `rol_usuario` enum (`Empleado Deposito`, `Empleado Ventas`, `Empleado Compras`, `Gerente`). RLS: cualquier `authenticated` puede `SELECT` todos; `UPDATE` solo su propia fila o si es `Gerente`. Sin `DELETE`/`INSERT` por política explícita de tabla (el alta ocurre vía `auth.users` + trigger/flujo de registro). |
| `marca` | 0 | `nombre_marca` unique + `activo` + auditoría completa (`creado_por`). |
| `rubro` | 0 | A-03, primer nivel de clasificación del catálogo. |
| `categoria` | 0 | A-04, FK obligatoria a `rubro` (`id_rubro` not null). Bloquea `DELETE` si tiene artículos activos (`fn_categoria_bloquear_delete_con_articulos`). |
| `unidad_medida` | 0 | A-01. `abreviatura` con `check` de regex (3 letras minúsculas). |
| `producto` | 0 | Catálogo (A-05). FK a `marca`, `unidad_medida`, `rubro` (nullable), `categoria` (nullable). Tiene `precio_producto`, `costo_producto`, `precio_mayorista_producto`, `precio_minorista_producto`, `numero_medida`, `codigo_producto` unique. |
| `deposito` | 1 | S-01, **único módulo con CRUD de frontend terminado**. Campos: `nombre_deposito` unique, `direccion_deposito`, `telefono_deposito`, `horario_apertura`/`horario_cierre` (`time`), `id_responsable` (FK a `usuario`, nullable), `activo`, `esta_lleno`. |
| `proveedor` | 0 | `cuit_proveedor` unique con check de formato `XX-XXXXXXXX-X`, `mail_proveedor` unique, `rs_proveedor` enum de razón social. |
| `tipo_movimiento` | 0 | S-04. `signo` (`1`/`-1`), `requiere_control_stock` bool. |
| `compra` | 0 | Orden de compra a proveedor. `total` es columna generada (`sub_total + impuesto_total - descuento_total`). `estado` enum (`Pendiente`, `Enviada`, `Recibida`, `Cancelada`), con trigger `validar_cambio_estado_compra`. `stock_aplicado` evita doble aplicación de stock. |
| `compra_producto` | 0 | Detalle de `compra`. `subtotal_producto` y `total_producto` son columnas generadas. |
| `inventario` | 0 | Lote de recepción de mercadería, opcionalmente ligado a una `compra` (`id_compra` unique/nullable → ingreso manual si es null). |
| `inventario_producto` | 0 | Detalle de `inventario`: producto, marca, cantidad, vencimiento/fabricación, `stock_disponible`. |
| `stock` | 0 | Stock real por producto×depósito (`id_producto`, `id_deposito`, `cantidad`). Se actualiza solo vía funciones, nunca a mano. |
| `movimiento_stock` | 0 | Auditoría de movimientos de stock (S-05). Guarda `stock_anterior`/`stock_nuevo`, FK a `tipo_movimiento`. |
| `movimiento_stock_detalle` | 0 | Liga un movimiento con el/los `inventario_producto` (lote) que afectó, con `cantidad_aplicada`. |

**Ya no existen** `lote` ni `lote_deposito` (mencionadas en versiones previas de este documento) — fueron reemplazadas por el par `inventario`/`inventario_producto` (identidad del lote) + `stock` (cantidad real por depósito) + `movimiento_stock*` (auditoría de movimientos). No reintroducir el modelo viejo.

## Vistas

- `vista_diferencias_recepcion` — compara lo pedido en `compra_producto` contra lo efectivamente recibido en `inventario_producto` (agrupado por compra/producto/marca), para detectar faltantes/sobrantes en la recepción de compras.

Las vistas de stock mencionadas en versiones previas (`vista_stock_producto`, `vista_stock_producto_deposito`, `vista_lote_detalle`) **ya no existen**. Consultar stock hoy pasa por la función `fn_stock_consultar` y/o la tabla `stock` directamente.

## Funciones (RPC) relevantes por módulo

Convención de nombres en uso: `fn_<entidad>_<accion>` (crear/modificar/eliminar/habilitar/inhabilitar/listar), más algunas funciones sueltas de triggers y validaciones (`set_editado_*`, `validar_*`, `fn_*_bloquear_delete_*`).

- **Depósito**: hay **dos generaciones de funciones conviviendo** — `crear_deposito` / `actualizar_deposito` / `set_activo_deposito` / `set_esta_lleno_deposito` / `eliminar_deposito` (las que llama hoy `src/lib/depositos/actions.js`) y una segunda tanda más nueva `fn_deposito_crear` / `fn_deposito_modificar` / `fn_deposito_eliminar` / `fn_deposito_habilitar` / `fn_deposito_inhabilitar` / `fn_deposito_marcar_lleno` / `fn_deposito_desmarcar_lleno` / `fn_deposito_listar` que parece venir de otra rama/refactor y **no está siendo usada por el frontend actual**. Antes de tocar el módulo de depósitos, confirmar cuál set es el vigente y no duplicar lógica — probablemente haya que migrar `actions.js` al set `fn_deposito_*` y eliminar el viejo, pero no asumirlo sin confirmar con el equipo.
- **Marca**: `fn_marca_crear/modificar/habilitar/inhabilitar/listar` + `validar_marca_producto`.
- **Rubro**: `fn_rubro_crear/modificar/eliminar/habilitar/inhabilitar/listar`, `fn_rubro_bloquear_delete_con_articulos`, `rubro_tiene_articulos_activos`, `rubro_motivo_bloqueo_delete`.
- **Categoría**: `fn_categoria_bloquear_delete_con_articulos`, `categoria_motivo_bloqueo_delete` (el resto del CRUD de categoría parece manejarse por trigger/validación, no se ven `fn_categoria_crear/modificar` explícitos — confirmar antes de asumir que existen).
- **Unidad de medida**: `fn_unidad_medida_crear/modificar/eliminar/habilitar/inhabilitar/listar`.
- **Producto**: `fn_producto_crear/modificar/eliminar/listar`, `fn_producto_validar_codigo_unico`, `fn_producto_sync_id_rubro` (sincroniza `id_rubro` a partir de `id_categoria`), `_fn_producto_validar_referencias`.
- **Tipo de movimiento**: `fn_tipo_movimiento_crear/modificar/habilitar/inhabilitar/listar`, `fn_tipo_movimiento_signo_inmutable` (el `signo` no se puede modificar una vez creado).
- **Stock / movimientos**: `fn_stock_consultar`, `fn_movimiento_stock_registrar`, `fn_movimiento_stock_listar`, `fn_movimiento_stock_validar_stock_disponible`.
- **Compras**: `fn_items_esperados_compra`, `fn_aplicar_stock_compra`, `validar_y_marcar_stock_aplicado`, `revertir_stock_aplicado`, `validar_cambio_estado_compra`.
- **Inventario (recepción)**: `fn_inventario_producto_init_stock_disponible`.

## Migraciones (⚠️ desincronizadas del estado real)

`supabase/migrations/` en la raíz del repo (fuera de `erp-epg/`) solo tiene **una** migración (`20260820000001_a01_unidad_medida.sql`). Todo el resto del esquema descripto arriba (rubro, categoría, proveedor, compra*, inventario*, stock, movimiento_stock*, y buena parte de las funciones) existe en la base pero no está versionado como migración en el repo — se aplicó directo contra el proyecto Supabase. Antes de asumir que `supabase/migrations` refleja el estado de la base, verificar contra el proyecto real (`list_tables` / `execute_sql` vía MCP de Supabase). Si se retoma disciplina de migraciones, hay que generar el backlog de migraciones faltante para no perder la trazabilidad.

## Frontend — estado actual (`src/`)

```
src/
  app/
    (auth)/
      login/           page.jsx + actions.js — login con email/password (Supabase Auth)
      logout/          actions.js — Server Action de logout
    (main)/
      layout.js         — envuelve con AppShell + getUserWithRole()
      page.js           — dashboard, tarjetas a todos los módulos (implementados y placeholder)
      deposito/
        page.js          — redirect de compatibilidad → /inventario/depositos
      inventario/
        depositos/
          page.js          — listado
          nuevo/page.js     — alta
          [id]/editar/page.js — edición
        productos/page.js    — placeholder (A-05)
        marcas/page.js        — placeholder (A-02)
        stock/page.js         — placeholder (S-03)
        movimientos/
          page.js            — placeholder historial (S-05)
          nuevo/page.js       — placeholder registrar movimiento
          tipos/page.js       — placeholder tipos de movimiento (S-04)
      catalogo/
        unidades-medida/page.js — placeholder (A-01)
        rubros/page.js           — placeholder (A-03)
        categorias/page.js       — placeholder (A-04)
    layout.js            — RootLayout, envuelve todo en <InactivityProvider>
    globals.css
  components/
    auth/
      LogoutButton.jsx        — botón reutilizable con useFormStatus
      InactivityProvider.jsx  — auto-logout a los 25 min de inactividad, aviso a los 24
    depositos/
      DepositoForm.js
      DepositosTable.js
    layout/
      AppShell.js         — header + sidebar; NAV con 3 secciones (Inicio / Inventario / Catálogo), "Movimientos" es un submenú colapsable
      PageHeader.js
      PlaceholderModule.js — card genérica "módulo sin pantalla todavía", usada por los placeholders de inventario/catálogo
  lib/
    auth/roles.js       — getUserWithRole(), PERMISOS, hasPermission()
    depositos/actions.js — Server Actions CRUD de depósito (ver nota de funciones duplicadas arriba)
    supabase/
      client.js server.js middleware.js requests.http
  proxy.js               — invoca updateSession() del middleware de Supabase
```

**Único módulo de negocio con CRUD real: Depósitos (S-01)**, ahora en `/inventario/depositos` (la ruta vieja `/deposito` quedó como redirect de compatibilidad). El resto de las entidades (marca, rubro, categoría, unidad de medida, producto, proveedor, compras, movimientos de stock) tiene ruta y entrada en el sidebar bajo `/inventario/*` y `/catalogo/*`, pero cada página es un placeholder (`PlaceholderModule`) — la base y las funciones RPC ya existen, falta la pantalla real.

**`REGLAS_POR_RUTA` en `middleware.js` está vacío a propósito (decisión de dev, 2026-08-27)**: cualquier usuario autenticado, sin importar `rol_usuario`, puede ver todas las rutas bajo `(main)` (`/inventario/*`, `/catalogo/*`) — solo se exige sesión iniciada, no rol. Antes de producción hay que reintroducir reglas por prefijo (el código para hacerlo ya está, solo falta llenar el array) y decidir qué rol corresponde a cada módulo.

`AppShell` (`src/components/layout/AppShell.js`) tiene el array `NAV` con 3 secciones: "INICIO" (dashboard), "INVENTARIO" (productos, marcas, stock, movimientos —submenú colapsable con historial/registrar/tipos—, depósitos) y "CATÁLOGO" (unidades de medida, rubros, categorías). Al agregar un módulo nuevo con pantalla real, sumar su entrada ahí (y sacar el placeholder correspondiente).

## Ramas remotas activas (no mergeadas a `main` al momento de este documento)

- `feat/A-01-unidad-medida`
- `feat/A-03-gestionar-rubros`
- `feat/A-04-gestionar-categorias`
- `feat/S-04` (tipos de movimiento)
- `feature/crud-marcas`
- `feature/Autenticacion`

Antes de empezar un módulo nuevo, chequear si ya hay una rama remota con ese trabajo en curso para no duplicar.

## Pendiente conocido

- Definir y unificar qué set de funciones de depósito es el vigente (`crear_deposito`/... vs `fn_deposito_*`), eliminar el que quede obsoleto.
- RLS por `rol_usuario` a nivel de política (hoy solo aplicado parcialmente en `usuario`) — pendiente para el resto de las tablas.
- Falta un trigger que valide que la suma de `stock.cantidad` movida no deje números negativos fuera de los casos ya cubiertos por `fn_movimiento_stock_validar_stock_disponible` / `requiere_control_stock` — confirmar cobertura real antes de asumir que está resuelto.
- Migraciones sin versionar para la mayor parte del esquema (ver sección "Migraciones").
- Módulos con base de datos lista pero sin pantalla: marca, rubro, categoría, unidad de medida, producto, proveedor, compras, movimientos de stock/consulta de stock.
- Hay un `package.json`/`node_modules` sueltos en la raíz del repo (fuera de `erp-epg/`, con la única dependencia `claude`) que no forman parte de la app Next.js — probablemente un `npm install` corrido por error en el directorio equivocado; no confundirlos con `erp-epg/package.json`, que es el real.
- `REGLAS_POR_RUTA` de `middleware.js` está vacío (sin restricción por rol) por decisión de dev — reintroducir antes de ir a producción (ver sección de Login más abajo).

## Al generar código / SQL

1. Respetar las convenciones de arriba.
2. Nueva lógica de escritura → función `plpgsql` con el prefijo `fn_<entidad>_<accion>`, invocada desde una Server Action delgada en `src/lib/<entidad>/actions.js` (seguir el patrón de `src/lib/depositos/actions.js`: parseo de payload, validación de campos obligatorios, `supabase.rpc(...)`, traducción de errores de Postgres a mensajes en español).
3. No reintroducir tablas de stock sueltas ni escribir `stock.cantidad` directo desde el cliente — pasar por `fn_movimiento_stock_registrar` / `fn_aplicar_stock_compra`.
4. No implementar RLS por rol de forma parcial/adivinada — si se necesita, coordinar con quien está a cargo de esa capa; mientras tanto usar el patrón de 4 políticas abiertas para `authenticated` que ya tienen la mayoría de las tablas.
5. Si se agrega una pantalla nueva bajo un route group (`(modulo)/`), sumar su entrada al `NAV` de `AppShell.js` y, si corresponde, una regla en `REGLAS_POR_RUTA` de `middleware.js`.
6. Verificar el estado real de la base con las herramientas de Supabase (`list_tables`, `execute_sql`) antes de asumir que este documento o `supabase/migrations/` están al día — el histórico muestra que la base avanza más rápido que ambos.

---

# Login + Autenticación por Roles con Supabase (implementado)

- **Framework**: Next.js (App Router), React.
- **Backend**: Supabase (proyecto `ERP-ElPalacioDeLasGolosinas`, región `sa-east-1`).

## Clientes de Supabase (`src/lib/supabase/`)

- **`client.js`** — cliente para Client Components (browser), vía `createBrowserClient`.
- **`server.js`** — cliente para Server Components y Server Actions, vía `createServerClient` leyendo/escribiendo cookies con las utilidades de `next/headers`.
- **`middleware.js`** — `updateSession(request)`: refresca la sesión, redirige a `/login` si no hay sesión (salvo rutas públicas), redirige a `/` si hay sesión y se pide `/login`, y aplicaría `REGLAS_POR_RUTA` (prefijo → roles permitidos) de estar poblado — **hoy está vacío a propósito** (ver nota de dev más abajo), así que ningún prefijo restringe por rol.

Variables de entorno (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## `src/proxy.js`

Invoca `updateSession()` en cada request (reemplaza al histórico `middleware.js` en la raíz de Next — el nombre del archivo es específico de esta versión de Next.js, no cambiarlo sin revisar `node_modules/next/dist/docs/`).

## `src/app/(auth)/login/page.jsx`

Formulario controlado (email + password) que llama a una Server Action que hace `supabase.auth.signInWithPassword`, consulta `usuario.rol_usuario` y redirige.

## `src/lib/auth/roles.js`

- `getUserWithRole()` — combina `supabase.auth.getUser()` con la fila de `usuario` (id, nombre, apellido, rol). Devuelve `null` si no hay sesión o no hay fila de `usuario` asociada.
- `PERMISOS` — mapa de permisos por rol.
- `hasPermission(rol, permiso)`.

## Row Level Security

Ver sección "Inventario de tablas" arriba para el estado real de RLS por tabla — ya no está deshabilitado (a diferencia de lo que decía una versión previa de este documento): todas las tablas de negocio tienen RLS habilitado con políticas para `authenticated`.

---

# Logout + Persistencia de Sesión + Auto-logout por Inactividad (implementado)

## Archivos

| Archivo | Propósito |
|---|---|
| `src/app/(auth)/logout/actions.js` | Server Action `logout()`: `supabase.auth.signOut()` en servidor + `redirect("/login")`. |
| `src/components/auth/LogoutButton.jsx` | Client Component reutilizable. `<form action={logout}>` con botón que usa `useFormStatus` para mostrar "Cerrando...". Recibe `className`. |
| `src/components/auth/InactivityProvider.jsx` | Envuelve `children` en `RootLayout` (`src/app/layout.js`). Detecta inactividad solo en el cliente y cierra sesión automáticamente. |

## Flujo de logout manual

`<LogoutButton />` en el navbar (`AppShell.js`) dispara la Server Action `logout()`, que invalida la sesión en el servidor (cookies) y redirige a `/login`.

## Flujo de auto-logout por inactividad

`InactivityProvider`:

- Se suscribe a `supabase.auth.onAuthStateChange`. Sin sesión, no registra listeners.
- Con sesión activa, escucha `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click` en `window` para reiniciar el timer.
- Chequeo cada 30 s del tiempo inactivo:
  - A los **24 minutos** → modal de aviso con countdown.
  - A los **25 minutos** → logout automático (`supabase.auth.signOut()` client-side + `router.push("/login")`).
- Botón "Seguir conectado" reinicia el timer sin cerrar sesión.
- Timeout único de 25 min para todos los roles; lógica enteramente client-side.

## Persistencia de sesión

Cookies httpOnly de Supabase, refrescadas en cada request vía `updateSession` (invocado desde `src/proxy.js`). Recargar la página no cierra sesión; solo logout manual o auto-logout por inactividad la invalidan.

## Uso de `<LogoutButton>`

```jsx
import { LogoutButton } from "@/components/auth/LogoutButton";

<LogoutButton className="rounded px-3 py-2 text-sm font-medium hover:bg-black/5" />
```
