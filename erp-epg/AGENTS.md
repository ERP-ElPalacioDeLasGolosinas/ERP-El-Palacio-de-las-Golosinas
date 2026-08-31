# El Palacio de las Golosinas — Contexto ERP (actualizado desde la base real)

Sistema de gestión para "El Palacio de las Golosinas". Backend: **Supabase** (Postgres 17 + Auth + RLS), proyecto `ERP-ElPalacioDeLasGolosinas`, región `sa-east-1`.

Este documento reemplaza al doc de contexto anterior para todo lo referido al **modelo de datos**: fue generado relevando directamente el esquema real de la base (`information_schema`, `pg_catalog`), no a partir de un diseño planeado. El doc anterior (basado en `lote` / `lote_deposito` / vistas de stock) **no coincide** con lo que existe hoy — ver sección de discrepancias al final.

---

## Convenciones observadas en la base real

- **PK**: `uuid`, default `gen_random_uuid()` (excepto `usuario.id_usuario`, que es FK 1:1 a `auth.users.id` sin default propio).
- **Nombres de columnas** en español, mayormente con sufijo de la entidad (`nombre_marca`, `nombre_producto`, `nombre_deposito`), aunque hay excepciones (`unidad_medida.nombre`, `tipo_movimiento.nombre`, sin sufijo).
- Columnas de **texto obligatorias** casi siempre llevan `check (length(trim(columna)) > 0)`.
- **Auditoría**: la mayoría de las tablas tiene `creado` / `editado` (`timestamptz default now()`) y `creado_por` (`uuid default auth.uid()`). Las tablas de tipo "detalle" (`compra`, `compra_producto`, `inventario`, `inventario_producto`) usan además `editado_por` y `fecha_registro`.
- **Cantidades**: `numeric` (no `integer`) con `check (>= 0)` o `check (> 0)` según el caso. **Precios/costos**: `numeric` con `check (>= 0)`, default `0`.
- **El stock SÍ es una tabla suelta**: `stock(id_producto, id_deposito, cantidad)`, con `UNIQUE(id_producto, id_deposito)`. No se calcula desde lotes vía vistas — es un valor sincronizado directamente, con `movimiento_stock` como registro de auditoría de los cambios.
- **RLS**: habilitado en las 16 tablas de `public`, pero **no todas tienen políticas** (ver sección RLS).
- Casi toda la lógica de negocio (altas, bajas, habilitar/inhabilitar, listados) está implementada como **funciones RPC** en Postgres (`fn_*`), no como acceso directo a tablas desde el frontend.

---

## Tablas existentes

| Tabla | Rol | PK | Notas clave |
|---|---|---|---|
| `usuario` | Usuarios del sistema | `id_usuario` (uuid, FK → `auth.users.id`) | `nombre_usuario`, `apellido_usuario`, `fecha_nacimiento_usuario`, `dni_usuario` (unique, >0), `telefono_usuario`, `mail_usuario` (check regex), `rol_usuario` (enum `rol_usuario_enum`) |
| `marca` | Marcas de producto | `id_marca` | `nombre_marca`, `activo` |
| `rubro` | Rubro de producto | `id_rubro` | `nombre_rubro`, `activo` |
| `categoria` | Categoría de producto | `id_categoria` | `nombre_categoria`, `activo`, FK → `rubro` |
| `unidad_medida` | Unidades (peso/medida específica del producto) | `id_unidad_medida` | `nombre`, `abreviatura` (check: 3 letras minúsculas), `activo` |
| `deposito` | Depósitos físicos | `id_deposito` | `nombre_deposito` (no unique a nivel constraint, ojo), `direccion_deposito`, `telefono_deposito`, `horario_apertura`/`horario_cierre` (check cierre > apertura), `activo`, `esta_lleno`, `id_responsable` (FK → `usuario`) |
| `producto` | Catálogo de artículos | `id_producto` | `nombre_producto`, `descripcion_producto`, `codigo_producto` (**unique**), `precio_producto`, `costo_producto`, `precio_mayorista_producto`, `precio_minorista_producto`, `numero_medida` (>0), FK → `marca`, `unidad_medida`, `categoria` (nullable), `rubro` (nullable, sincronizado desde `categoria` por trigger) |
| `proveedor` | Proveedores | `id_proveedor` | `nombre_proveedor`, `rs_proveedor` (enum `tipo_razon_social`), `cuit_proveedor` (unique, check formato XX-XXXXXXXX-X), `telefono_proveedor` (bigint), `mail_proveedor` (unique, check regex) |
| `compra` | Cabecera de compra a proveedor | `id_compra` | FK → `proveedor`; `sub_total`, `descuento_total`, `impuesto_total`, `total` (checks de consistencia); `estado` (enum `estado_compra`); `stock_aplicado` (bool) |
| `compra_producto` | Detalle de productos de una compra | `id_compra_producto` | FK → `compra`, `producto`, `marca`; `cantidad_producto` (>0), `total_unit_prod`, `descuento_producto`, `impuesto_producto`, `subtotal_producto`, `total_producto` |
| `inventario` | Cabecera de recepción/lote de mercadería | `id_lote` | FK → `proveedor`, `deposito`, `compra` (**unique**, 1:1 con `compra`); `detalle_lote` |
| `inventario_producto` | Detalle por producto de un `inventario` (lote) | `id_inventario_producto` | FK → `inventario`, `producto`, `marca`; `cantidad_inventario` (≥0), `fecha_vencimiento`/`fecha_fabricacion` (check vencimiento > fabricación), `stock_disponible` (≥0), `observaciones` |
| `stock` | **Stock actual por producto × depósito** | `id_stock` | FK → `producto`, `deposito`; `cantidad` (numeric, default 0); `UNIQUE(id_producto, id_deposito)` |
| `tipo_movimiento` | Tipos de movimiento de stock | `id_tipo_movimiento` | `nombre`, `signo` (check: solo `1` o `-1`), `requiere_control_stock`, `activo` |
| `movimiento_stock` | Auditoría de movimientos sobre `stock` | `id_movimiento` | FK → `tipo_movimiento`, `producto`, `deposito`; `cantidad` (>0), `stock_anterior`, `stock_nuevo`, `fecha_movimiento`, `remito` |
| `movimiento_stock_detalle` | Detalle de qué lote (`inventario_producto`) aportó a un movimiento | `id_detalle` | FK → `movimiento_stock`, `inventario_producto`; `cantidad_aplicada` (>0) |

## Vistas existentes

| Vista | Contenido |
|---|---|
| `vista_diferencias_recepcion` | Compara `cantidad_pedida` (de `compra_producto`) vs `cantidad_recibida` (de `inventario_producto`) por compra/producto/marca, con `diferencia` calculada |
| `vw_usuario_resumen` | Vista blindada de usuarios: `id_usuario` + `nombre_completo` (`nombre_usuario \|\| ' ' \|\| apellido_usuario`). `security_invoker = false` (default) → corre con privilegios del owner, así que sigue resolviendo el nombre aunque a futuro se cierre/restrinja el RLS de `usuario`. Expone solo id + nombre (nada de dni, mail, teléfono, rol). Pensada para resolver `creado_por` → nombre dentro de los `fn_*_listar` vía `LEFT JOIN` + `COALESCE`. `SELECT` concedido a `authenticated`, `service_role`. **Ya la usan:** `fn_unidad_medida_listar`, `fn_rubro_listar`, `fn_categoria_listar`, `fn_marca_listar`, `fn_producto_listar`. **Falta aplicarla en:** `fn_deposito_listar` (y las tablas "detalle" con `editado_por`, con un 2º `LEFT JOIN` de alias distinto) |

> No existen `vista_stock_producto`, `vista_stock_producto_deposito` ni `vista_lote_detalle` mencionadas en el doc anterior.

## Enums

| Enum | Valores |
|---|---|
| `rol_usuario_enum` | `Empleado Deposito`, `Empleado Ventas`, `Empleado Compras`, `Gerente` |
| `estado_compra` | `Pendiente`, `Enviada`, `Recibida`, `Cancelada` |
| `tipo_razon_social` | `S.A.`, `S.R.L.`, `S.A.U.`, `S.A.S.`, `S.H.`, `Responsable Inscripto`, `Monotributista` |

---

## Row Level Security (RLS)

RLS está **habilitado en las 16 tablas** de `public`. El estado de políticas es dispar:

### Con políticas abiertas para `authenticated` (`using (true)` / `with check (true)`)

`categoria`, `marca`, `rubro`, `deposito`, `producto`, `stock`, `tipo_movimiento`, `unidad_medida` → tienen las 4 políticas (`SELECT`/`INSERT`/`UPDATE`/`DELETE`).

`movimiento_stock`, `movimiento_stock_detalle` → solo `SELECT` e `INSERT` (no `UPDATE`/`DELETE`, tiene sentido tratándose de una tabla de auditoría).

### Con políticas por rol (ya implementado, a diferencia de lo que decía el doc anterior)

`usuario`:
- `SELECT`: cualquier `authenticated` puede ver todos los usuarios.
- `UPDATE`: un usuario puede editar su propia fila, o un `Gerente` puede editar cualquiera.
- No hay políticas de `INSERT`/`DELETE` (probablemente se gestiona vía Auth / triggers, o está pendiente).

### ⚠️ Sin ninguna política (RLS habilitado = acceso denegado por completo)

`compra`, `compra_producto`, `inventario`, `inventario_producto`, `proveedor` → **RLS bloquea todo acceso** (ni siquiera lectura) para cualquier rol, salvo que se acceda a través de una función `SECURITY DEFINER` (ninguna de las funciones relevadas tiene `security_definer = true`, así que hoy **nadie puede leer ni escribir estas tablas directamente**, ni siquiera vía RPC estándar). Esto es probablemente un pendiente a resolver antes de que las pantallas de compras/proveedores/recepción de mercadería funcionen.

---

## Funciones RPC disponibles (`public.fn_*` y afines)

### Marca
`fn_marca_crear(p_nombre_marca, p_creado_por)`, `fn_marca_modificar(p_id_marca, p_nombre_marca)`, `fn_marca_listar(p_incluir_inactivas)`, `fn_marca_habilitar(p_id_marca)`, `fn_marca_inhabilitar(p_id_marca)`

- **`fn_marca_listar(p_incluir_inactivas boolean default true)`** → `TABLE(id_marca, nombre_marca, activo, creado, editado, creado_por, creado_por_nombre)`, `creado_por_nombre` vía `LEFT JOIN vw_usuario_resumen` + `COALESCE`.

### Rubro
`fn_rubro_crear(p_nombre_rubro, p_creado_por)`, `fn_rubro_modificar(p_id_rubro, p_nombre_rubro)`, `fn_rubro_listar(p_incluir_inactivos)`, `fn_rubro_habilitar(p_id_rubro)`, `fn_rubro_inhabilitar(p_id_rubro)`, `fn_rubro_eliminar(p_id_rubro)`, `rubro_tiene_articulos_activos(p_id_rubro)`, `rubro_motivo_bloqueo_delete(p_id_rubro)`

- **`fn_rubro_listar(p_incluir_inactivos boolean default true)`** → `TABLE(id_rubro, nombre_rubro, activo, creado, editado, creado_por, creado_por_nombre)`, `ORDER BY nombre_rubro`. `creado_por_nombre` sale de `LEFT JOIN vw_usuario_resumen` + `COALESCE(..., 'Usuario no disponible')`. Filtra por `activo` salvo que `p_incluir_inactivos` sea `true`. (Migración `rubro_listar_con_creado_por`, versión `20260827221035`; antes devolvía `SETOF rubro`.)
- Validaciones server-side con mensajes en español (ERRCODE custom): `crear`/`modificar` → `RUB01` nombre vacío, `RUB02` nombre duplicado (case-insensitive); `modificar`/`habilitar`/`inhabilitar`/`eliminar` → `RUB03` si el rubro no existe. `habilitar`/`inhabilitar` setean `editado = now()` explícitamente.
- **`fn_rubro_eliminar`**: `RUB04` si el rubro tiene productos **activos** asociados (vía `categoria` → `producto`), `RUB05` si tiene categorías asociadas (sin productos activos); ambos mensajes incluyen la cantidad. Si no hay categorías, hace `DELETE` directo.
- **`rubro_motivo_bloqueo_delete(p_id_rubro)`** → `text` con el motivo de bloqueo ("...tiene artículos activos asociados." / "...tiene categorías asociadas.") o `null` si se puede eliminar. Pensada para el chequeo previo de UX; la validación real la hace igual `fn_rubro_eliminar`. `rubro_tiene_articulos_activos` es un wrapper booleano sobre el primer caso.

### Categoría
`fn_categoria_crear(p_nombre_categoria, p_id_rubro, p_creado_por)`, `fn_categoria_modificar(p_id_categoria, p_nombre_categoria, p_id_rubro)`, `fn_categoria_listar(p_incluir_inactivos)`, `fn_categoria_habilitar(p_id_categoria)`, `fn_categoria_inhabilitar(p_id_categoria)`, `fn_categoria_eliminar(p_id_categoria)`, `categoria_tiene_articulos_activos(p_id_categoria)`, `categoria_motivo_bloqueo_delete(p_id_categoria)` — CRUD completo (migración `categoria_crud_rpc`, 27/08/2026).

- **`fn_categoria_listar(p_incluir_inactivos boolean default true)`** → `TABLE(id_categoria, nombre_categoria, activo, id_rubro, nombre_rubro, creado, editado, creado_por, creado_por_nombre)`, `ORDER BY nombre_categoria`. `nombre_rubro` sale de `JOIN rubro` (inner — `categoria.id_rubro` es `NOT NULL`); `creado_por_nombre` de `LEFT JOIN vw_usuario_resumen` + `COALESCE`.
- `categoria.id_rubro` es **obligatorio** (`NOT NULL`, FK `ON UPDATE CASCADE ON DELETE RESTRICT`). No se puede "desasociar", solo reasociar a otro rubro vía `fn_categoria_modificar`.
- **`fn_categoria_modificar`**: si cambia `p_id_rubro`, además del `UPDATE` de la categoría hace `UPDATE producto SET id_rubro = p_id_rubro WHERE id_categoria = ... AND id_rubro IS DISTINCT FROM ...` en la misma transacción — resincroniza los productos ya cargados (el trigger `trg_producto_sync_id_rubro` solo actúa sobre `INSERT/UPDATE` de `producto`, no cuando cambia la categoría).
- Códigos de error (ERRCODE custom, mensajes en español): `CAT01` nombre vacío, `CAT02` nombre duplicado **dentro del mismo rubro** (unicidad por rubro, no global; no hay constraint `UNIQUE` en la tabla), `CAT03` categoría no existe, `CAT04` bloqueada por borrado (tiene productos asociados), `CAT06` rubro faltante / inexistente / inactivo. `crear`/`modificar` exigen que el rubro destino esté `activo = true`. `modificar`/`habilitar`/`inhabilitar` setean `editado = now()` explícitamente.
- **`categoria_motivo_bloqueo_delete`** → `text` con el motivo o `null`. **Criterio distinto al de Rubro**: bloquea con *cualquier* producto asociado a la categoría, activo o inactivo (no filtra `p.activo`). `categoria_tiene_articulos_activos` es el wrapper booleano (`... IS NOT NULL`).
- Existen dos funciones trigger escritas pero **sin enganchar** en `categoria`: `fn_categoria_bloquear_delete_con_articulos` y `set_editado_categoria` (la lógica vive inline en los `fn_categoria_*`, mismo patrón que Rubro).

### Unidad de medida
`fn_unidad_medida_crear(p_nombre, p_abreviatura, p_creado_por)`, `fn_unidad_medida_modificar(p_id_unidad_medida, p_nombre, p_abreviatura)`, `fn_unidad_medida_listar(p_incluir_inactivas)`, `fn_unidad_medida_habilitar(p_id_unidad_medida)`, `fn_unidad_medida_inhabilitar(p_id_unidad_medida)`, `fn_unidad_medida_eliminar(p_id_unidad_medida)`

- **`fn_unidad_medida_listar(p_incluir_inactivas boolean default true)`** → `TABLE(id_unidad_medida, nombre, abreviatura, activo, creado, editado, creado_por, creado_por_nombre)`, `ORDER BY nombre`. `creado_por_nombre` sale de `LEFT JOIN vw_usuario_resumen` + `COALESCE(..., 'Usuario no disponible')`, así que una fila con `creado_por` huérfano/nulo igual aparece. Filtra por `activo` salvo que `p_incluir_inactivas` sea `true`. (Migración `unidad_medida_listar_con_creado_por`; antes devolvía `SETOF unidad_medida`.)
- Validaciones server-side ya resueltas (mensajes en español, no errores crudos de Postgres): `crear`/`modificar` validan nombre no vacío (`UMD01`), abreviatura `^[a-z]{3}$` (`UMD06`) y unicidad de nombre/abreviatura (`UMD02`/`UMD03`). `eliminar` cuenta `producto.id_unidad_medida` y bloquea con `UMD05` si hay artículos asociados ("Solo puede inhabilitarse"). `modificar`/`habilitar`/`inhabilitar` setean `editado = now()` explícitamente (la columna `editado` es confiable acá). El alta nace `activo = true` por el default de la tabla.

### Depósito
`fn_deposito_crear`, `fn_deposito_modificar`, `fn_deposito_listar(p_incluir_inactivos)`, `fn_deposito_habilitar`, `fn_deposito_inhabilitar`, `fn_deposito_eliminar`, `fn_deposito_marcar_lleno`, `fn_deposito_desmarcar_lleno`, `set_activo_deposito`, `set_esta_lleno_deposito`, `eliminar_deposito`

### Producto
`fn_producto_crear(p_id_marca, p_nombre_producto, p_descripcion_producto, p_codigo_producto, p_id_unidad_medida, p_numero_medida, p_creado_por, p_id_categoria?, p_precio_producto?, p_costo_producto?, p_precio_mayorista_producto?, p_precio_minorista_producto?)`, `fn_producto_modificar(p_id_producto, ...mismos que crear sin p_creado_por)`, `fn_producto_listar(p_incluir_inactivos, p_id_marca, p_id_categoria, p_id_rubro, p_busqueda)`, `fn_producto_habilitar(p_id_producto)`, `fn_producto_inhabilitar(p_id_producto)`, `fn_producto_eliminar(p_id_producto)`, `fn_producto_validar_codigo_unico(p_codigo_producto, p_id_producto?)`, `_fn_producto_validar_referencias` (interna)

- **`fn_producto_listar(p_incluir_inactivos boolean default true, p_id_marca uuid default null, p_id_categoria uuid default null, p_id_rubro uuid default null, p_busqueda text default null)`** → `TABLE(id_producto, codigo_producto, nombre_producto, descripcion_producto, nombre_completo, id_marca, nombre_marca, id_unidad_medida, nombre_unidad_medida, abreviatura_unidad_medida, numero_medida, id_categoria, nombre_categoria, id_rubro, nombre_rubro, precio_producto, costo_producto, precio_mayorista_producto, precio_minorista_producto, activo, creado, editado, creado_por, creado_por_nombre)`. `nombre_completo` viene armado: `nombre_producto || ' - ' || nombre_marca || ' (' || numero_medida || ' ' || abreviatura_unidad_medida || ')'`. JOIN a `marca` y `unidad_medida`, LEFT JOIN a `categoria`/`rubro` (nullable) y a `vw_usuario_resumen` (`COALESCE(..., 'Usuario no disponible')`). (Migración que reescribió la función; antes devolvía `SETOF producto` sin joins.)
- **`fn_producto_habilitar` / `fn_producto_inhabilitar`**: se crearon aparte (antes `producto` no tenía el par estándar). `PRD04` si el id no existe; setean `editado = now()`.
- Códigos de error (ERRCODE custom, mensajes en español): `PRD01` nombre vacío, `PRD02` código vacío, `PRD03` código duplicado, `PRD04` producto no encontrado, `PRD05` marca inexistente/inhabilitada, `PRD06` categoría inexistente/inhabilitada, `PRD07` unidad de medida inexistente/inhabilitada, `PRD08` `numero_medida <= 0`, `PRD09` no se puede eliminar (tiene compras o inventario asociado → usar inhabilitar).
- `fn_producto_validar_codigo_unico` → `boolean` (`true` = disponible). Para validación en vivo del form; `p_id_producto` opcional para excluirse a sí mismo al editar.
- **Nota costo/precio**: no hay costo promedio calculado (sin costeo por lote/PEPS/ponderado). `costo_producto` es un campo simple editable. `producto` no tiene `editado_por`. El frontend de A-05 dejó de exponer `precio_producto` en el form (manda `0` fijo) y usa `costo_producto` / `precio_mayorista_producto` / `precio_minorista_producto`.
- `producto.id_rubro` se sincroniza desde `id_categoria` vía trigger `trg_producto_sync_id_rubro` (INSERT/UPDATE de `producto`); al reasignar una categoría a otro rubro, `fn_categoria_modificar` resincroniza los productos ya cargados en la misma transacción.

### Tipo de movimiento
`fn_tipo_movimiento_crear(p_nombre, p_signo, p_creado_por, p_requiere_control_stock)`, `fn_tipo_movimiento_modificar(p_id_tipo_movimiento, p_nombre, p_signo, p_requiere_control_stock)`, `fn_tipo_movimiento_listar(p_incluir_inactivos)` → `SETOF tipo_movimiento` (sin `creado_por_nombre`, no usa `vw_usuario_resumen`), `fn_tipo_movimiento_habilitar(p_id_tipo_movimiento)`, `fn_tipo_movimiento_inhabilitar(p_id_tipo_movimiento)`.

- Frontend ABMC implementado en `feat/S-04` (`app/(main)/inventario/movimientos/tipos/page.js`, `lib/tipos-movimiento/{actions,errores}.js`, `components/tipos-movimiento/{TipoMovimientoFormModal,TiposMovimientoTable}.js`), siguiendo el mismo patrón de `marcas`/`unidad_medida`: server actions que solo invocan los `fn_tipo_movimiento_*` de arriba (nada de queries directas desde el cliente), validación de formato en el frontend (nombre no vacío, signo obligatorio `1`/`-1`), y reutilización de las clases `.palacio-*` de `globals.css`.
- Códigos de error mapeados en `lib/tipos-movimiento/errores.js`: `TMV01` nombre vacío, `TMV02` nombre duplicado (case-insensitive, con índice único `lower(btrim(nombre))` en base), `TMV03` tipo de movimiento inexistente, `TMV04` signo inválido (no es `1`/`-1`), `TMV05` signo obligatorio.
- **Gaps conocidos y no resueltos en esta iteración** (relevados en `CONTEXTO_SUPABASE_tipo_movimiento.md`, señalados al usuario, pendientes de decisión de negocio):
  - No existe columna `descripcion` pese a que el Sprint 1 la pide explícitamente ("ABMC de tipos de movimiento con descripción y signo"). Ninguna función `fn_tipo_movimiento_*` la recibe ni persiste — el frontend tampoco la expone porque no hay dónde guardarla.
  - El `signo` **no es inmutable** en la implementación real: `fn_tipo_movimiento_modificar` permite cambiarlo libremente. Existe una función trigger `fn_tipo_movimiento_signo_inmutable` pensada para bloquear esto, pero (a) no está enganchada como trigger a la tabla, y (b) referencia una columna inexistente (`signo_tipo_movimiento` en vez de `signo`), por lo que fallaría en runtime si se adjuntara tal cual.
  - `set_editado_tipo_movimiento` (función trigger) tampoco está enganchada a la tabla — hoy `editado` solo se actualiza porque las funciones `fn_tipo_movimiento_modificar/habilitar/inhabilitar` lo setean explícitamente en su `UPDATE`, no por una barrera a nivel de base.
  - La política RLS de `DELETE` sobre `tipo_movimiento` está abierta a `authenticated` aunque el ABMC solo expone baja lógica (`activo`) — un `DELETE` directo saltándose las funciones es posible hoy.

### Stock y movimientos
- **`fn_stock_consultar(p_id_producto, p_id_deposito)`** → `TABLE(id_stock, id_producto, codigo_producto, producto, id_unidad_medida, unidad_medida, id_deposito, nombre_deposito, cantidad, editado)`. Filtra `cantidad > 0`. **Esta es la función que usamos para la vista de listado de stock.**
- `fn_movimiento_stock_registrar(p_id_tipo_movimiento, p_id_producto, p_id_deposito, p_cantidad, p_creado_por, p_fecha_movimiento, p_remito, p_id_movimiento_referencia?)` → alta de movimiento (impacta `stock`). El 8º parámetro es opcional: si se pasa, marca el movimiento como corrección de otro (ver más abajo).
- `fn_movimiento_stock_listar(p_id_producto, p_id_deposito, p_id_tipo_movimiento, p_fecha_desde, p_fecha_hasta)` → histórico de movimientos, enriquecido con joins (`tipo_movimiento`, `producto`→`marca`/`unidad_medida`, `deposito`, `vw_usuario_resumen`) y `valor` ya firmado (`signo * cantidad`)
- `fn_movimiento_stock_validar_stock_disponible(p_id_producto, p_id_deposito, p_cantidad)` → `TABLE(stock_actual, alcanza)`
- `fn_aplicar_stock_compra(p_id_compra, p_id_deposito, p_detalle_lote, p_items)` → aplica `inventario`/`inventario_producto` desde una recepción de compra. **Ojo: no toca `stock`** — usar `fn_lote_registrar_completo` para el flujo completo.
- `fn_lote_registrar_completo(p_id_deposito, p_id_proveedor, p_detalle_lote, p_creado_por, p_productos jsonb)` → `TABLE(lote_id, compra_id, movimientos jsonb)`. Registra un lote con N productos en una operación atómica: crea compra de soporte (`Recibida`) + `compra_producto` por ítem (resuelve `id_marca` solo), llama `fn_aplicar_stock_compra` y además registra un movimiento "ingreso por compra" por producto para reflejar `stock`. `p_productos`: `[{ id_producto, cantidad, costo_unitario?, fecha_elaboracion, fecha_vencimiento, observaciones? }]`. Errores `LOT01` (sin productos), `LOT02` (`id_producto` inexistente).
- `fn_inventario_producto_listar_recientes(p_id_deposito?, p_limite default 50)` → últimos lotes ingresados (cualquier producto), orden `fecha_registro desc`. `SECURITY DEFINER` (`inventario`/`inventario_producto` sin políticas RLS), `EXECUTE` solo `authenticated`/`service_role`.
- `fn_proveedor_listar_min()` → `TABLE(id_proveedor, nombre_proveedor)`. `SECURITY DEFINER` (`proveedor` tiene RLS sin políticas); expone solo id + nombre. `EXECUTE` solo `authenticated`/`service_role`. Es el único modo de listar proveedores desde el frontend hoy.

**Movimientos son inmutables**: no hay `fn_movimiento_stock_modificar`/`_eliminar`. Un error de carga se corrige con un movimiento inverso (tipos seed `Ajuste - Corrección (suma)`/`(resta)`, signo `+1`/`-1`) referenciado vía `movimiento_stock.id_movimiento_referencia`. `fn_movimiento_stock_listar` devuelve también `id_movimiento_referencia`, `referencia_tipo_movimiento_nombre`, `referencia_fecha_movimiento`.

**Frontend implementado:**
- **Movimientos** (`app/(main)/inventario/movimientos/{page,nuevo/page}.js`, `components/movimientos/{MovimientoForm,MovimientosTable}.js`, `lib/movimientos/actions.js`): listado con filtros (producto/depósito/concepto/rango de fechas) mapeados 1:1 a los parámetros de `fn_movimiento_stock_listar`, columna "Valor" coloreada (verde `+`/rojo `-`) según `signo`, alta vía `fn_movimiento_stock_registrar`, validación de stock disponible antes de confirmar un egreso. Códigos de error `MOV01`-`MOV07` mapeados a mensajes en español.
- **Consultar stock** (`app/(main)/inventario/stock/page.js`, `components/stock/StockResumenTable.js`, `lib/stock/actions.js`): listado con **una fila por producto** (total sumado entre depósitos) vía `consultarStockResumen` → `fn_stock_resumen_por_producto`. Buscador que escribe `?q=` en la URL con debounce y re-llama el RPC con `p_busqueda` (no filtra local). Cada fila navega a `inventario/stock/[id_producto]/page.js`, pantalla de detalle con: (1) descripción del producto (`obtenerProductoDetalle` → `fn_producto_listar` con `p_id_producto`) + desglose por depósito (`obtenerStockPorDeposito` → `fn_stock_por_producto_por_deposito`), y (2) lotes agrupados en una tabla por depósito (`obtenerUltimosLotes` → `fn_inventario_producto_listar_por_producto`, `SECURITY DEFINER`, orden por vencimiento más próximo; se particiona por `id_deposito` en el render, secciones en el orden del desglose de stock, columnas Código · Producto · Fecha de elaboración `fecha_fabricacion` · Stock `disponible/total`). `consultarStock` (`fn_stock_consultar`, producto × depósito) queda como fallback. Sin paginación.
- **Lotes** (`app/(main)/inventario/stock/lotes/{page,nuevo/page}.js`, `components/stock/{LotesRecientesTable,LoteForm}.js`, `lib/stock/{actions,errores}.js`): `/lotes` es el historial de lotes recientes (`listarLotesRecientes` → `fn_inventario_producto_listar_recientes`, filtro de Depósito opcional vía `?deposito=`). `/lotes/nuevo` registra un lote con datos generales una vez (Depósito, Proveedor vía `listarProveedoresMin` → `fn_proveedor_listar_min`, Detalle) y varios productos con patrón "carrito", enviados juntos vía `registrarLote` → `fn_lote_registrar_completo`. Errores `LOT01`/`LOT02` en `lib/stock/errores.js` (`mapErrorLote`). Accesos "Ver lotes" / "Registrar lote" en el header de `/inventario/stock`.

### Compras / inventario (recepción de mercadería)
`fn_items_esperados_compra(p_id_compra)` — el resto de la lógica de compras parece resolverse por triggers (`validar_cambio_estado_compra`, `validar_y_marcar_stock_aplicado`, `revertir_stock_aplicado`) más que por funciones `fn_*` explícitas de CRUD.

---

## Triggers relevantes

| Tabla | Trigger | Qué hace |
|---|---|---|
| `usuario` | `trigger_actualizar_editado_usuario` | Actualiza `editado` en cada `UPDATE` |
| `marca` | `trg_set_editado_marca` | Ídem |
| `deposito` | `trg_set_editado_deposito` | Ídem |
| `producto` | `trg_producto_sync_id_rubro` | Sincroniza `id_rubro` del producto a partir de `id_categoria` (INSERT/UPDATE) |
| `compra` | `trg_compra_set_editado_por`, `trg_compra_validar_estado` | Auditoría + valida transición de `estado` |
| `compra_producto` | `trg_cprod_set_editado_por`, `trg_cprod_validar_marca` | Auditoría + valida que la marca coincida con la del producto |
| `inventario` | `trg_inventario_set_editado_por`, `trg_inventario_validar_compra`, `trg_inventario_revertir_stock` | Auditoría + valida/marca `stock_aplicado` en `compra` + revierte stock si se borra el lote |
| `inventario_producto` | `trg_inventario_producto_init_stock_disponible`, `trg_iprod_set_editado_por`, `trg_iprod_validar_marca` | Inicializa `stock_disponible` + auditoría + valida marca |

> Nota: existen funciones `set_editado_categoria`, `set_editado_tipo_movimiento` pero **no aparecen triggers que las invoquen** sobre `categoria` ni `tipo_movimiento` — posible pendiente (esas tablas podrían no estar actualizando `editado` automáticamente).

---

## ⚠️ Discrepancias con el documento de contexto anterior

El doc anterior (el que traía la sección de login/roles con Next.js) describe un modelo que **no es el que está implementado**:

| Doc anterior decía | Realidad en la base |
|---|---|
| Tablas `lote` / `lote_deposito` | No existen. El equivalente real es `inventario` / `inventario_producto` (para lotes con vencimiento) + `stock` (para el total disponible por depósito) |
| Vistas `vista_stock_producto`, `vista_stock_producto_deposito`, `vista_lote_detalle` | No existen. Solo existe `vista_diferencias_recepcion` |
| "Nada de tablas de stock sueltas, se calcula vía vistas" | Falso en la práctica: `stock` es una tabla con `cantidad` sincronizada directamente, mantenida por `movimiento_stock` + triggers |
| RLS deshabilitado en `usuario`, `marca`, `producto`, `deposito`, etc. | RLS está **habilitado** en las 16 tablas, con políticas ya definidas en la mayoría |
| "RLS por rol no implementado todavía" | Parcialmente falso: `usuario` ya tiene una política que distingue `Gerente` del resto |
| No se menciona nada de `compra`, `compra_producto`, `inventario`, `inventario_producto`, `proveedor`, `rubro`, `categoria`, `tipo_movimiento` | Estas tablas existen y tienen bastante desarrollo (funciones, triggers), pero 5 de ellas (`compra`, `compra_producto`, `inventario`, `inventario_producto`, `proveedor`) están **sin políticas RLS**, por lo que hoy nadie puede leerlas ni escribirlas |

**Recomendación:** confirmar con el equipo si el doc anterior es de un sprint/diseño descartado, o si describe un rediseño pendiente de migrar. Mientras tanto, todo el trabajo de backend/frontend debería apoyarse en el esquema real documentado arriba, no en el doc de `lote`/`lote_deposito`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
