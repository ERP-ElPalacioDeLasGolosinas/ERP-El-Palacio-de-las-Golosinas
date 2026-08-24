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
| `rubro` | A-03 listo a nivel tabla + CRUD (`feat/A-03-gestionar-rubros`). `nombre_rubro` unique case-insensitive, `activo`, auditoría. Baja física bloqueada si hay categorías o artículos activos asociados. |
| `categoria` | A-04 listo a nivel tabla + CRUD (`feat/A-04-gestionar-categorias`, encima de A-03). FK obligatoria `id_rubro` → `rubro` (`ON DELETE RESTRICT`). Unique `(id_rubro, lower(trim(nombre_categoria)))`. `activo` + auditoría. Baja física bloqueada si hay artículos asociados (vía `id_categoria` cuando exista en A-05). |
| `deposito` | S-01 listo a nivel tabla. `nombre_deposito` unique, `direccion_deposito`, `activo` bool default true + auditoría. |
| `producto` | Catálogo (A-05). FK `id_marca`. Tiene nombre, descripción, `precio_producto`, `codigo_producto` unique. **Faltan** FKs/columnas a `unidad_medida`, rubro y/o categoría. |
| `lote` | Identidad del lote (producto, usuario que cargó, número, fechas, `cantidad_inicial`, `precio_costo`). **Sin** cantidad actual. |
| `lote_deposito` | Stock real: `cantidad_actual` por lote×depósito. `UNIQUE(id_lote, id_deposito)`. |

### Relaciones clave

- `producto` → `marca`
- `categoria` → `rubro` (A-04)
- `producto` → `categoria` (futura, A-05)
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
| A-03 Rubros | Tabla `rubro` lista + CRUD en `feat/A-03-gestionar-rubros` (RLS por rol pendiente) |
| S-01 Depósitos | Tabla `deposito` lista → armar back/CRUD |
| S-04 Tipos de movimiento | Falta tabla `tipo_movimiento` |

### Oleada 2 (cuando A-03 esté lista)

| Ítem | Estado |
| --- | --- |
| A-04 Categorías | Tabla `categoria` lista + CRUD en `feat/A-04-gestionar-categorias` (depende de A-03; RLS por rol pendiente) |

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
