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
- **RLS**: habilitado en las tablas de `public`, pero **no todas tienen políticas** (ver sección RLS).
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
| `proveedor` | Proveedores | `id_proveedor` | `nombre_proveedor`, `rs_proveedor` (enum `tipo_razon_social`), `cuit_proveedor` (unique, check formato XX-XXXXXXXX-X), `telefono_proveedor` (bigint, rango 100000–999999999999999), `mail_proveedor` (unique, check regex), `activo`, `creado`/`editado` (`timestamptz`), `registrado_por` (uuid → `usuario`) |
| `medio_pago` | Catálogo compartido de medios de pago (Ventas/Caja y Tesorería) | `id_medio_pago` | `nombre_medio_pago` (unique), `requiere_referencia` (bool, default `false` — si es `true`, la operación debe pedir nro. de referencia), `activo`, `creado`/`editado` (`timestamptz`), `creado_por` (uuid → `usuario`) |
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
| `vw_usuario_resumen` | Vista blindada de usuarios: `id_usuario` + `nombre_completo` (`nombre_usuario \|\| ' ' \|\| apellido_usuario`). `security_invoker = false` (default) → corre con privilegios del owner, así que sigue resolviendo el nombre aunque a futuro se cierre/restrinja el RLS de `usuario`. Expone solo id + nombre (nada de dni, mail, teléfono, rol). Pensada para resolver `creado_por` / `registrado_por` → nombre dentro de los `fn_*_listar` vía `LEFT JOIN` + `COALESCE`. `SELECT` concedido a `authenticated`, `service_role`. **Ya la usan:** `fn_unidad_medida_listar`, `fn_rubro_listar`, `fn_categoria_listar`, `fn_marca_listar`, `fn_producto_listar`, `fn_proveedor_listar`, `fn_medio_pago_listar`. **Falta aplicarla en:** `fn_deposito_listar` (y las tablas "detalle" con `editado_por`, con un 2º `LEFT JOIN` de alias distinto) |

> No existen `vista_stock_producto`, `vista_stock_producto_deposito` ni `vista_lote_detalle` mencionadas en el doc anterior.

## Enums

| Enum | Valores |
|---|---|
| `rol_usuario_enum` | `Empleado Deposito`, `Empleado Ventas`, `Empleado Compras`, `Gerente` |
| `estado_compra` | `Pendiente`, `Enviada`, `Recibida`, `Cancelada` |
| `tipo_razon_social` | `S.A.`, `S.R.L.`, `S.A.U.`, `S.A.S.`, `S.H.`, `Responsable Inscripto`, `Monotributista` |

---

## Row Level Security (RLS)

RLS está **habilitado** en las tablas de `public`. El estado de políticas es dispar:

### Con políticas abiertas para `authenticated` (`using (true)` / `with check (true)`)

`categoria`, `marca`, `rubro`, `deposito`, `producto`, `stock`, `tipo_movimiento`, `unidad_medida`, `medio_pago` → tienen las 4 políticas (`SELECT`/`INSERT`/`UPDATE`/`DELETE`).

`movimiento_stock`, `movimiento_stock_detalle` → solo `SELECT` e `INSERT` (no `UPDATE`/`DELETE`, tiene sentido tratándose de una tabla de auditoría).

### Con políticas por rol (ya implementado, a diferencia de lo que decía el doc anterior)

`usuario`:
- `SELECT`: cualquier `authenticated` puede ver todos los usuarios.
- `UPDATE`: un usuario puede editar su propia fila, o un `Gerente` puede editar cualquiera.
- No hay políticas de `INSERT`/`DELETE` (probablemente se gestiona vía Auth / triggers, o está pendiente).

### ⚠️ Sin ninguna política (RLS habilitado = acceso denegado por completo)

`compra`, `compra_producto`, `inventario`, `inventario_producto`, `proveedor` → **RLS bloquea todo acceso directo** (ni siquiera lectura) para cualquier rol. El acceso operativo a `proveedor` va por las funciones `fn_proveedor_*` (ver sección Proveedor). Ojo: esas 6 funciones son **`SECURITY INVOKER`** (respetan RLS), a diferencia de `fn_proveedor_listar_min` / `fn_aplicar_stock_compra` / etc. que son `SECURITY DEFINER`. Si `proveedor` sigue sin políticas, las RPC INVOKER pueden fallar hasta que se agreguen políticas o se pasen a DEFINER — confirmar con el equipo.

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

### Proveedor
`fn_proveedor_crear(p_nombre_proveedor, p_rs_proveedor, p_cuit_proveedor, p_telefono_proveedor, p_mail_proveedor, p_registrado_por)`, `fn_proveedor_modificar(p_id_proveedor, …mismos que crear sin p_registrado_por)`, `fn_proveedor_listar(p_incluir_inactivos)`, `fn_proveedor_habilitar(p_id_proveedor)`, `fn_proveedor_inhabilitar(p_id_proveedor)`, `fn_proveedor_eliminar(p_id_proveedor)`, `fn_proveedor_listar_min()` (ya existía; combo liviano).

- **Regla de oro frontend:** solo juntar parámetros e invocar RPC — nada de queries directas a `proveedor`. Mostrar `error.message` tal cual (mensajes ya en español).
- **`fn_proveedor_crear`**: todos los parámetros obligatorios. `p_rs_proveedor` = enum `tipo_razon_social` (`S.A.`, `S.R.L.`, `S.A.U.`, `S.A.S.`, `S.H.`, `Responsable Inscripto`, `Monotributista`). `p_cuit_proveedor` formato `XX-XXXXXXXX-X`. `p_telefono_proveedor` bigint entre `100000` y `999999999999999`. `p_mail_proveedor` email válido. `p_registrado_por` = `user.id` del logueado (`supabase.auth.getUser()`). Completa `creado`/`editado` con `DEFAULT now()`.
- **`fn_proveedor_modificar`**: igual que crear + `p_id_proveedor`, **sin** `p_registrado_por`. Setea `editado = now()`. Duplicados CUIT/mail excluyen el propio registro.
- **`fn_proveedor_habilitar` / `fn_proveedor_inhabilitar`**: setean `activo` y `editado = now()`.
- **`fn_proveedor_eliminar`**: `void`. Bloquea si tiene compras y/o lotes de inventario asociados (`PRV08`, sugiere inhabilitar).
- **`fn_proveedor_listar(p_incluir_inactivos boolean default true)`** → `TABLE(id_proveedor, nombre_proveedor, rs_proveedor, cuit_proveedor, telefono_proveedor, mail_proveedor, activo, creado, editado, registrado_por, registrado_por_nombre)`. `registrado_por_nombre` vía `LEFT JOIN vw_usuario_resumen` + `COALESCE(..., 'Usuario no disponible')`. Usar esta para la grilla de gestión.
- **`fn_proveedor_listar_min()`** → `TABLE(id_proveedor, nombre_proveedor)`. Sin parámetros. Pensada para combos (alta de lote / compra). `SECURITY DEFINER`. No reemplaza a `fn_proveedor_listar`.
- Códigos de error (ERRCODE custom): `PRV01` nombre vacío, `PRV02` CUIT vacío/inválido, `PRV03` mail vacío/inválido, `PRV04` CUIT duplicado, `PRV05` proveedor inexistente, `PRV06` razón social no informada, `PRV07` teléfono vacío/fuera de rango, `PRV08` no se puede eliminar (tiene compras/lotes), `PRV09` mail duplicado.
- **Trigger:** `trg_set_editado_proveedor` (`BEFORE UPDATE`) fuerza `editado = now()` y protege `creado`/`registrado_por` de pisarse. Mismo patrón que `deposito`.
- **Security:** las 6 funciones nuevas son `SECURITY INVOKER` (respetan RLS). Ver nota RLS de `proveedor` más arriba.
- **Frontend ABMC (C-01)** implementado en `app/(main)/compras/proveedores/page.js`, `lib/proveedores/{actions,errores}.js`, `components/proveedores/{ProveedorFormModal,ProveedoresTable}.js`. Mismo patrón que marcas/unidades: server actions solo invocan `fn_proveedor_*`, validación de formato en el front (nombre, razón social, CUIT `XX-XXXXXXXX-X`, teléfono 6–15 dígitos, mail), errores por campo bajo el input + banner para el resto, listado con búsqueda / incluir inactivos / habilitar-inhabilitar / eliminar. Mapeo en `lib/proveedores/errores.js` (`mapErrorProveedor`).

### Medio de pago
`fn_medio_pago_crear(p_nombre_medio_pago, p_requiere_referencia, p_creado_por)`, `fn_medio_pago_modificar(p_id_medio_pago, p_nombre_medio_pago, p_requiere_referencia)`, `fn_medio_pago_listar(p_incluir_inactivos)`, `fn_medio_pago_habilitar(p_id_medio_pago)`, `fn_medio_pago_inhabilitar(p_id_medio_pago)`.

- **Catálogo compartido** entre Ventas/Caja y Tesorería: combos de ambos módulos deben consumir la misma RPC (`fn_medio_pago_listar`) — no duplicar listados por módulo.
- **Regla de oro frontend:** solo juntar parámetros e invocar RPC — nada de queries directas a `medio_pago`. Mostrar `error.message` tal cual (mensajes ya en español).
- **No hay `fn_medio_pago_eliminar`** — mismo criterio que `marca`: solo baja lógica (`habilitar`/`inhabilitar`). Cuando existan `orden_pago`/`pago` que referencien `medio_pago`, un delete físico sería peligroso.
- **`fn_medio_pago_crear`**: `p_nombre_medio_pago` obligatorio; `p_requiere_referencia` opcional (default `false`); `p_creado_por` = `user.id` del logueado (`supabase.auth.getUser()`).
- **`fn_medio_pago_modificar`**: `p_id_medio_pago` + `p_nombre_medio_pago` obligatorios; `p_requiere_referencia` opcional (si no se manda, mantiene el valor actual).
- **`fn_medio_pago_habilitar` / `fn_medio_pago_inhabilitar`**: setean `activo`. Validación `MDP03` si no existe.
- **`fn_medio_pago_listar(p_incluir_inactivos boolean default true)`** → `TABLE(id_medio_pago, nombre_medio_pago, requiere_referencia, activo, creado, editado, creado_por, creado_por_nombre)`. `creado_por_nombre` vía `LEFT JOIN vw_usuario_resumen` + `COALESCE(..., 'Usuario no disponible')`. Los inactivos no deben ofrecerse al registrar nuevas operaciones.
- Códigos de error (ERRCODE custom): `MDP01` nombre vacío, `MDP02` nombre duplicado, `MDP03` medio de pago inexistente.
- **Trigger:** `trg_set_editado_medio_pago` (`BEFORE UPDATE`) fuerza `editado = now()` y protege `creado`/`creado_por`.
- **Uso de `requiere_referencia` en formularios de operación** (venta, pago a proveedor, etc.): si el medio elegido tiene `requiere_referencia = true`, mostrar el campo de número de referencia; si no, ocultarlo.
- **Frontend ABMC (V-03)** implementado en `app/(main)/tesoreria/medios-de-pago/page.js`, `lib/medios-pago/{actions,errores}.js`, `components/medios-pago/{MedioPagoFormModal,MediosPagoTable}.js`. Mismo patrón que marcas: server actions solo invocan `fn_medio_pago_*`, modal con nombre + checkbox `requiere_referencia`, errores por campo + banner, listado con búsqueda / incluir inactivos / Editar / Habilitar-Inhabilitar (**sin Eliminar**). Mapeo en `lib/medios-pago/errores.js` (`mapErrorMedioPago`).

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
- `fn_proveedor_listar_min()` → `TABLE(id_proveedor, nombre_proveedor)`. `SECURITY DEFINER` (`proveedor` tiene RLS sin políticas de acceso directo); expone solo id + nombre. `EXECUTE` solo `authenticated`/`service_role`. Para combos livianos (alta de lote). La grilla de gestión usa `fn_proveedor_listar` (ver sección Proveedor).

**Movimientos son inmutables**: no hay `fn_movimiento_stock_modificar`/`_eliminar`. Un error de carga se corrige con un movimiento inverso (tipos seed `Ajuste - Corrección (suma)`/`(resta)`, signo `+1`/`-1`) referenciado vía `movimiento_stock.id_movimiento_referencia`. `fn_movimiento_stock_listar` devuelve también `id_movimiento_referencia`, `referencia_tipo_movimiento_nombre`, `referencia_fecha_movimiento`.

**Frontend implementado:**
- **Movimientos** (`app/(main)/inventario/movimientos/{page,nuevo/page}.js`, `components/movimientos/{MovimientoForm,MovimientosTable}.js`, `lib/movimientos/actions.js`): listado con filtros (producto/depósito/concepto/rango de fechas) mapeados 1:1 a los parámetros de `fn_movimiento_stock_listar`, columna "Valor" coloreada (verde `+`/rojo `-`) según `signo`, alta vía `fn_movimiento_stock_registrar`, validación de stock disponible antes de confirmar un egreso. Códigos de error `MOV01`-`MOV07` mapeados a mensajes en español.
- **Consultar stock** (`app/(main)/inventario/stock/page.js`, `components/stock/StockResumenTable.js`, `lib/stock/actions.js`): listado con **una fila por producto** (total sumado entre depósitos) vía `consultarStockResumen` → `fn_stock_resumen_por_producto`. Buscador que escribe `?q=` en la URL con debounce y re-llama el RPC con `p_busqueda` (no filtra local). Cada fila navega a `inventario/stock/[id_producto]/page.js`, pantalla de detalle con: (1) descripción del producto (`obtenerProductoDetalle` → `fn_producto_listar` con `p_id_producto`) + desglose por depósito (`obtenerStockPorDeposito` → `fn_stock_por_producto_por_deposito`), y (2) lotes agrupados en una tabla por depósito (`obtenerUltimosLotes` → `fn_inventario_producto_listar_por_producto`, `SECURITY DEFINER`, orden por vencimiento más próximo; se particiona por `id_deposito` en el render, secciones en el orden del desglose de stock, columnas Código · Producto · Fecha de elaboración `fecha_fabricacion` · Stock `disponible/total`). `consultarStock` (`fn_stock_consultar`, producto × depósito) queda como fallback. Sin paginación.
- **Lotes** (`app/(main)/inventario/stock/lotes/{page,nuevo/page}.js`, `components/stock/{LotesRecientesTable,LoteForm}.js`, `lib/stock/{actions,errores}.js`): `/lotes` es el historial de lotes recientes (`listarLotesRecientes` → `fn_inventario_producto_listar_recientes`, filtro de Depósito opcional vía `?deposito=`). `/lotes/nuevo` registra un lote con datos generales una vez (Depósito, Proveedor vía `listarProveedoresMin` → `fn_proveedor_listar_min`, Detalle) y varios productos con patrón "carrito", enviados juntos vía `registrarLote` → `fn_lote_registrar_completo`. Errores `LOT01`/`LOT02` en `lib/stock/errores.js` (`mapErrorLote`). Accesos "Ver lotes" / "Registrar lote" en el header de `/inventario/stock`.
- **Umbral y alertas (S-02, S-11)** — `stock_umbral` por artículo y depósito (mínimo y máximo opcionales, mínimo ≤ máximo). `fn_stock_umbral_guardar` / `fn_stock_umbral_listar` en el detalle de stock. `fn_stock_alertas_listar` lista stock actual ≤ mínimo (sin fila de stock cuenta como 0). Pantallas: `/inventario/stock/alertas` y `/compras/alertas-stock`. Errores `STU01`–`STU04`.

### Compras / inventario (recepción de mercadería)
`fn_items_esperados_compra(p_id_compra)` — el resto de la lógica de compras parece resolverse por triggers (`validar_cambio_estado_compra`, `validar_y_marcar_stock_aplicado`, `revertir_stock_aplicado`) más que por funciones `fn_*` explícitas de CRUD.

**Frontend Sprint 2 (estructura + C-01 + V-03):**
- Navegación: secciones `COMPRAS` y `TESORERÍA` en el sidebar (`AppShell`), dashboard con 4 recuadros (Inventario / Catálogo / Compras / Tesorería). Placeholders para comprobantes (historial/registrar), cuentas, órdenes y tipos de comprobante (en Tesorería).
- **Proveedores (C-01)** — implementado (ver sección Proveedor arriba).
- **Medios de pago (V-03)** — implementado en `/tesoreria/medios-de-pago` (ver sección Medio de pago arriba).

### Órdenes de compra (Sprint 4 — C-03, C-04)
`orden_compra` + `orden_compra_detalle`. Número interno `OC-000001`. Estados `Pendiente` / `Recibida parcial` / `Recibida total` / `Cancelada` (solo se cancela en Pendiente, sin facturas ni mercadería recibida). `fn_orden_compra_registrar` (cabecera + detalle juntos), `fn_orden_compra_listar`, `fn_orden_compra_obtener`, `fn_orden_compra_cancelar`. Errores `OCO01`–`OCO08`.

Una factura nueva exige `comprobante_proveedor.id_orden_compra` (`CMP11`). Los artículos de la factura tienen que estar en la orden y la cantidad facturada (sumando facturas no anuladas) no puede pasar la solicitada (`CMP12`, `CMP13`). Las facturas anteriores quedan sin orden. Notas y remitos no se vinculan.

La recepción (`fn_lote_registrar_desde_comprobante` / `fn_lote_eliminar`) actualiza `cantidad_recibida` con el trigger `trg_orden_compra_sync_recepcion`. No se puede recibir de más (`OCO12`) ni un artículo que no está en la orden (`OCO11`). Si la factura no tiene orden, la recepción sigue como hasta ahora.

**Frontend:** Compras → Órdenes de compra (`/compras/ordenes`, `/nuevo`, `/[id]`). En el alta de factura el selector de orden aparece solo para la clase factura y se filtra por el proveedor. El detalle del comprobante muestra el vínculo. y cobranzas (Sprint 3 — migración `20260923170000_s3_ventas_mayoristas`; precio y descuento cambiaron en Sprint 4, ver abajo)

**Modelo:** una sola tabla para venta + comprobante (mismo criterio que compras), sin tabla `venta` aparte.

| Tabla | Notas clave |
|---|---|
| `comprobante_venta` | FK → `cliente`, `tipo_comprobante`; `punto_venta` (default 1) + `numero` autonumerado por tipo (`UNIQUE(tipo, pv, numero)`); `fecha_comprobante`, `canal` (`canal_venta`, default `Presencial`), `tipo_venta` (enum `tipo_venta`, default `Mayorista`; S4-cajas), `id_caja` (FK → `caja`, null en mayoristas), `id_lista_precio` (FK, null en ventas previas a S4-6), `descuento_porcentaje` (0–100), `subtotal`, `descuento_total`, `importe_total` (>0, = subtotal − descuento), `saldo_pendiente`, `estado` (enum `estado_venta`: `En preparación` → `Despachado` → `Pagado`), `fecha_despacho`, `observaciones`, auditoría |
| `comprobante_venta_detalle` | `nro_linea`, FK → `producto`, `deposito`; `cantidad`, `precio_unitario` (se toma de la lista de precios vigente al registrar; S4-6), `descuento` (columna heredada, ya no se carga), `importe_linea` (generada), `id_movimiento` → `movimiento_stock` (la salida generada) |
| `cobro` | 1:1 con la venta (`id_comprobante` UNIQUE), `id_cliente`, `fecha_cobro`, `importe_total`, `observaciones`, auditoría. Inmutable (RLS solo SELECT/INSERT) |
| `cobro_medio` | FK → `cobro`, `medio_pago`, `cuenta_tesoreria`; `importe`, `referencia` |
| `movimiento_tesoreria.id_cobro` | FK nueva: los ingresos generados por un cobro |

**Funciones (INVOKER, EXECUTE solo `authenticated`/`service_role`):**
- `fn_venta_registrar(p_id_cliente, p_id_tipo_comprobante, p_fecha_comprobante, p_observaciones, p_detalle jsonb [{id_producto, id_deposito, cantidad}], p_descuento_porcentaje, p_creado_por, p_tipo_venta default 'Mayorista', p_medios jsonb default null)` → `comprobante_venta`. El precio sale de `lista_precio_detalle` de la lista vigente según el tipo (Mayorista → Mayorista, el resto → Minorista; D-024); el descuento es un % sobre el subtotal. Cliente según tipo (ver sección Cajas); tipo factura de venta activo; valida stock agregado por producto×depósito; por cada línea llama `fn_movimiento_stock_registrar` con el tipo **"Salida por venta"** (remito `Venta 00001-0000000N`). La mayorista nace `En preparación`; minorista y consumidor final se cobran en la caja abierta (`fn_caja_registrar_cobro_venta`) y nacen `Pagado`.
- `fn_venta_despachar(p_id_comprobante)` → solo desde `En preparación` (las cobradas en caja nunca pasan por ahí).
- `fn_venta_listar(p_id_cliente, p_desde, p_hasta, p_estado, p_tipo_venta)` (incluye `tipo_venta`, `id_caja`, `numero_formateado`, `cantidad_articulos`, `id_cobro`, `creado_por_nombre`), `fn_venta_obtener(p_id)` → jsonb `{venta, detalle[], cobro|null, cobro_caja[]|null}`; `venta` suma `tipo_venta`, `id_caja`, `descuento_porcentaje`, `id_lista_precio`, `nombre_lista_precio`.
- `fn_cobro_registrar(p_id_comprobante, p_fecha_cobro, p_observaciones, p_medios jsonb [{id_medio_pago, id_cuenta_tesoreria, importe, referencia?}], p_creado_por)`: solo ventas `Despachado`; **cobro total** (suma de medios = saldo); cuenta debe estar vinculada al medio (`medio_pago_cuenta`); rechaza `Cheque propio`. Genera un `movimiento_tesoreria` `Ingreso` por medio (suma `saldo_actual`) y pasa la venta a `Pagado` con saldo 0.
- `fn_cobro_listar(p_id_cliente, p_desde, p_hasta)`, `fn_cobro_obtener(p_id_cobro)` → jsonb `{cobro, medios[], movimientos[]}`.
- `fn_movimiento_stock_listar` ahora resuelve `documento_ligado` = `Venta <tipo> <nro>` para salidas por venta.
- Errores: `VTA01` cliente inexistente/inactivo, `VTA02` el cliente no corresponde al tipo de venta, `VTA03` tipo inválido, `VTA04` fecha nula/futura (o distinta de hoy si se cobra en caja), `VTA05` líneas inválidas / descuento > importe, `VTA06` producto, `VTA07` depósito, `VTA08` stock insuficiente, `VTA09` venta inexistente, `VTA10` estado no permite despachar, `VTA11` total ≤ 0, `VTA12` falta tipo "Salida por venta", `VTA13` sin lista de precios vigente, `VTA14` artículo sin precio en la lista, `VTA15` la venta mayorista no se cobra en caja. `COB01` venta inexistente, `COB02` ya pagada / no despachada, `COB03` medios vacíos o suma ≠ saldo, `COB04` medio/cuenta inválidos o no vinculados, `COB05` falta referencia, `COB06` cheque propio, `COB07` fecha futura.

**Frontend:**
- Ventas (V-21, formulario único): `/ventas/ordenes/nuevo` (`components/ventas/VentaForm.js`; selector de tipo de venta, precios de la lista correspondiente vía `obtenerListaVigenteVenta(tipoLista)`, banner si falta alguna lista, combo solo con artículos con precio, "Descuento %" en totales; minorista/consumidor final suman la sección de medios y se bloquean si no hay caja abierta), `/ventas/ordenes` (`VentasTable`, filtros cliente/tipo/estado/fechas), `/ventas/ordenes/[id]` (`VentaDetalle`: despacho y cobro de Tesorería solo para mayoristas; card "Cobro en caja" con `cobro_caja` para el resto). Lib: `lib/ventas/{actions,errores,estado}.js` (`TIPOS_VENTA`, `seCobraEnCaja`, `listaDeTipoVenta`).
- Cobranzas (Tesorería): `/tesoreria/cobranzas/nuevo?venta=<id>` (`components/cobros/CobroForm.js`; sin `?venta` lista las ventas despachadas), `/tesoreria/cobranzas` (`CobrosTable`), `/tesoreria/cobranzas/[id]` (`CobroDetalle`). Lib: `lib/cobros/{actions,errores}.js`.
- **Efectivo en Tesorería:** cobros y pagos tratan `Efectivo` igual que cualquier medio (exigen cuenta vinculada en `medio_pago_cuenta`), así que hoy no se puede cobrar ni pagar en efectivo desde Tesorería. En la caja el efectivo y Mercado Pago no tocan ninguna cuenta. Transferencia y Cheque de terceros de una venta de caja sí acreditan una cuenta vinculada (ver Cajas).

### Listas de precios (Sprint 4 — migraciones `20261008031703_s4_a11_lista_precio`, `…032146_s4_a11_fn_lista_precio`, `…040000_s4_v21_venta_lista_descuento`; D-024)

| Tabla | Notas clave |
|---|---|
| `lista_precio` | `nombre_lista_precio` (único), `tipo_lista` (`tipo_lista_precio`: `Mayorista` / `Minorista`), `fecha_inicio`, `fecha_fin` (null = abierta), `observaciones`, auditoría. Exclusion constraint `(tipo_lista =, daterange(inicio, fin, '[]') &&)` con `btree_gist`: a lo sumo una vigente por tipo (`23P01` → `LPR03`) |
| `lista_precio_detalle` | PK `(id_lista_precio, id_producto)`, `precio numeric(12,2) >= 0`, FK con `on delete cascade`. La lista no tiene que cubrir todo el catálogo |

Vigente = hoy dentro de `[inicio, fin]`. Vencida = solo lectura; futura y vigente se editan (el inicio, solo en futuras). Seed: "Lista Mayorista inicial" y "Lista Minorista inicial" (22 artículos, desde 2026-10-08). RLS `authenticated` (el detalle suma `delete`).

**Funciones (INVOKER, EXECUTE solo `authenticated`/`service_role`):** `fn_lista_precio_crear(p_nombre_lista_precio, p_tipo_lista, p_fecha_inicio, p_fecha_fin, p_observaciones, p_id_lista_origen, p_ajuste_porcentaje)` (copia otra lista con ajuste %), `_modificar(p_id_lista_precio, p_nombre_lista_precio, p_fecha_inicio, p_fecha_fin, p_observaciones)`, `_precios_guardar(p_id_lista_precio, p_precios jsonb [{id_producto, precio}])`, `_precio_quitar(p_id_lista_precio, p_id_producto)`, `_listar(p_tipo_lista, p_estado)` (con "por vencer": vigente que vence en ≤ 7 días sin sucesora), `_obtener(p_id_lista_precio)` → jsonb con `precios[]`, `fn_lista_precio_vigente(p_tipo_lista, p_fecha)` → `setof lista_precio` (solo cabecera; vacío si no hay). Errores `LPR01` nombre, `LPR02` tipo/fechas, `LPR03` vigencia superpuesta, `LPR04` lista inexistente, `LPR05` lista vencida, `LPR06` precios/ajuste inválidos.

**Frontend:** `/ventas/listas-de-precios` (`ListasPrecioTable`, filtros tipo/estado en la URL), `/nuevo` (`ListaPrecioForm`), `/[id]` (`ListaPrecioDetalle`: cabecera editable, grilla con edición inline). Lib: `lib/listas-precio/{actions,errores,constantes}.js`. El artículo (`/inventario/productos`, detalle de stock) ya no muestra ni edita precios; `producto.precio_*` quedan sin uso hasta TEC-5, y `actualizarProducto` los reenvía porque `fn_producto_modificar` los pisa con 0 si no llegan.

### Cajas (Sprint 4 — migraciones `20261008100000_s4_v15_tipo_medio_mercado_pago`, `20261008100100_s4_cajas`; V-14, V-15, V-17, V-18, V-21)

**Modelo:** el comprobante sigue numerándose en el punto de venta 1. Una sucursal (`deposito`) puede tener varias cajas abiertas; cada caja vende solo el stock de su depósito. La caja no crea un `cobro`. Efectivo y Mercado Pago quedan solo en la caja. Transferencia y Cheque de terceros de una venta de caja acreditan **una** cuenta activa de `medio_pago_cuenta`: si hay una sola se elige sola; si hay varias el medio trae `id_cuenta_tesoreria`; si no hay ninguna, `CAJ15`. El ingreso es un `movimiento_tesoreria` ligado por `id_movimiento_caja`.

| Tabla | Notas clave |
|---|---|
| `caja` | `punto_venta` (default 1, numeración), `id_deposito` (FK, la sucursal), `estado` (enum `estado_caja`: `Abierta`/`Cerrada`), `monto_inicial` (≥0), apertura (`fecha_apertura`, `abierta_por`, `observaciones_apertura`) y cierre (`fecha_cierre`, `cerrada_por`, `observaciones_cierre`, `id_arqueo_cierre`), totales copiados al cerrar (`total_ingresos`, `total_egresos`, `saldo_teorico_efectivo`, `saldo_fisico_efectivo`, `diferencia_efectivo`, `resumen_cierre` jsonb). No hay tope de cajas abiertas por depósito |
| `movimiento_caja` | `tipo` (`tipo_movimiento_tesoreria`: Ingreso/Egreso), FK → `medio_pago`, `importe` (>0), `motivo`, `referencia`, `id_comprobante` (null si es manual). Inmutable. `movimiento_tesoreria.id_movimiento_caja` (único, null en cobros y pagos) apunta al ingreso de caja que acreditó la cuenta |
| `arqueo_caja` | `saldo_teorico`, `saldo_fisico` (≥0), `diferencia` generada (físico − teórico), `detalle_medios` jsonb, `observaciones`. Inmutable |

**Reglas:** trigger `fn_caja_validar_registro` bloquea movimientos y arqueos sobre una caja que no esté abierta y cualquier update/delete (inmutables). `fn_caja_proteger` bloquea editar una caja cerrada y las columnas de apertura. RLS `authenticated`: caja SELECT/INSERT/UPDATE; movimiento y arqueo SELECT/INSERT.

**Saldo teórico de efectivo** = `monto_inicial` + ingresos − egresos en medios tipo `Efectivo`. Es lo único que se compara contra el conteo; los demás medios se muestran por separado con su propio saldo (ingresos − egresos).

**Funciones (INVOKER, EXECUTE solo `authenticated`/`service_role`):**
- `fn_caja_abrir(p_monto_inicial, p_observaciones, p_creado_por, p_id_deposito)` → `caja`. `fn_caja_asignar_deposito(p_id_caja, p_id_deposito)` carga el depósito una sola vez si la caja se abrió sin uno.
- `fn_caja_obtener_abierta(p_punto_venta default 1)` y `fn_caja_obtener(p_id_caja)` → jsonb `{caja, resumen, movimientos[], arqueos[]}` (null si no hay abierta).
- `fn_caja_listar(p_desde, p_hasta, p_estado)` → filas con totales y `cantidad_movimientos`.
- `fn_caja_movimiento_registrar(p_id_caja, p_tipo, p_id_medio_pago, p_importe, p_motivo, p_referencia, p_creado_por)`: un egreso no puede superar el saldo del medio (efectivo = saldo teórico).
- `fn_caja_registrar_cobro_venta(p_id_comprobante, p_medios jsonb [{id_medio_pago, importe, referencia?, id_cuenta_tesoreria?}], p_creado_por, p_id_caja)`: la suma tiene que ser igual al total y las líneas tienen que ser del depósito de esa caja (`VTA16`); deja la venta `Pagado` con saldo 0 e `id_caja`. Transferencia y Cheque de terceros suman el importe a una cuenta vinculada (`CAJ15` si falta, sobra sin elegir, o no está habilitada).
- `fn_caja_resumen(p_id_caja)` → jsonb `{monto_inicial, total_ingresos, total_egresos, cantidad_movimientos, efectivo{…, saldo_teorico}, medios[{…, saldo, simulado}], ultimo_movimiento, ultimo_arqueo|null, arqueo_al_dia}`.
- `fn_caja_arqueo_realizar(p_id_caja, p_saldo_fisico, p_observaciones, p_creado_por)`: guarda el teórico del momento y la foto de los medios.
- `fn_caja_cerrar(p_id_caja, p_observaciones, p_creado_por)`: exige un arqueo posterior al último movimiento; copia totales y resumen.
- `_fn_caja_medio_validar`: rechaza medio inexistente, inactivo o `Cheque propio`; a `Mercado Pago` le genera la referencia `MP-SIM-XXXXXXXXXX` si no viene una.
- Errores `CAJ02` monto inicial inválido, `CAJ03` caja inexistente, `CAJ04` caja cerrada / falta elegirla, `CAJ05` tipo/importe/motivo inválido, `CAJ06` medio inválido, `CAJ07` falta referencia, `CAJ08` egreso mayor al saldo, `CAJ09` medios vacíos o suma ≠ total, `CAJ10` la venta no se cobra en caja, `CAJ11` efectivo contado inválido, `CAJ12` cierre sin arqueo al día, `CAJ13` movimiento/arqueo inmutable, `CAJ14` depósito inválido o ya asignado, `CAJ15` transferencia o cheque sin cuenta de tesorería válida. `CAJ01` quedó sin uso.

**Tipo de venta (V-21), dentro de `fn_venta_registrar`:**
- `Mayorista`: cliente mayorista, lista Mayorista, nace `En preparación`, se despacha y se cobra en Tesorería. Mandar medios → `VTA15`.
- `Minorista`: cliente minorista registrado (no consumidor final), lista Minorista.
- `Consumidor final`: cliente opcional (si no viene, el genérico `es_consumidor_final`; si viene, tiene que estar en la lista Minorista), lista Minorista.
- Minorista y consumidor final exigen una caja abierta (`p_id_caja`), fecha del día y medios; las líneas salen solo del depósito de esa caja; quedan `Pagado`.

**Frontend:** `/ventas/cajas` lista las abiertas y permite abrir otra (`AbrirCajaForm`, con depósito). `/ventas/cajas/[id]` opera la caja (`ResumenCaja`, movimientos, arqueo, cierre) o muestra el resumen si está cerrada; si se abrió sin depósito, `AsignarDepositoForm` lo pide una vez. `/ventas/cajas/historial` (`CajasTable`). En la venta minorista o a consumidor final el formulario pide la caja y no deja elegir otro depósito. Lib: `lib/cajas/{actions,errores,constantes}.js`. `UMBRAL_DIFERENCIA_ARQUEO` ($500) es una constante de frontend: por encima avisa, no bloquea el cierre.

**Desvíos respecto del backlog:** no existe el rol Cajero (U-04 no está hecho), así que no hay control por rol; el umbral de diferencia del arqueo es la constante de frontend y no un parámetro configurable; consumidor final usa la lista Minorista (solo hay dos listas); las ventas cobradas en caja tienen que ser del día.

**Medio "Mercado Pago (simulado)":** seed de la migración, tipo `Mercado Pago` (nuevo valor del enum `tipo_medio_pago`, también en `TIPOS_MEDIO_PAGO` del frontend). No mueve plata real: la referencia simulada la genera la base.

### Cuentas corrientes (Sprint 4 — migración `20261008160000_s4_cuentas_corrientes`; T-06, T-07)

No hay asientos manuales. El saldo sale de los comprobantes.

| Lado | Suma | Resta | Lectura del saldo |
|---|---|---|---|
| Proveedor | Factura y nota de débito | Nota de crédito y pago | Positivo: le debemos (en contra). Negativo: saldo a nuestro favor |
| Cliente | Venta mayorista | Cobro | Positivo: nos debe (a favor). Minorista, consumidor final y notas de venta no entran |

Anulados y remitos no entran. Al registrar una nota de crédito, `fn_nota_credito_aplicar_factura` descuenta el saldo libre de la factura (saldo menos lo imputado en una orden `Borrador` / `Pendiente de pago` / `Pagada parcial`) y guarda esa parte en `nota_credito_proveedor.importe_aplicado`. Lo que no entra en la factura queda a favor en la cuenta. La nota queda en estado `Confirmada` (no recorre Pendiente / Pagado); si se anula, pasa a `Anulado`. La suma de notas de una factura no puede superar su total (`NCR10`). Anular la nota devuelve `importe_aplicado` al saldo de la factura.

**Funciones:** `fn_cuenta_corriente_proveedor_listar()`, `_movimientos(p_id_proveedor, p_desde, p_hasta)`, y el par de cliente. Las de líneas `_fn_cc_*_lineas` arman el detalle.

**Frontend:** Tesorería → Cuentas corrientes → Proveedores / Clientes. `/tesoreria/cuentas-corrientes/proveedores` y `/clientes`, con historial en `[id]`. Lib: `lib/cuentas-corrientes/{actions,posicion}.js`.

---

## Triggers relevantes

| Tabla | Trigger | Qué hace |
|---|---|---|
| `usuario` | `trigger_actualizar_editado_usuario` | Actualiza `editado` en cada `UPDATE` |
| `marca` | `trg_set_editado_marca` | Ídem |
| `proveedor` | `trg_set_editado_proveedor` | Actualiza `editado` en cada `UPDATE` y protege `creado`/`registrado_por` |
| `medio_pago` | `trg_set_editado_medio_pago` | Actualiza `editado` en cada `UPDATE` y protege `creado`/`creado_por` |
| `deposito` | `trg_set_editado_deposito` | Ídem |
| `producto` | `trg_producto_sync_id_rubro` | Sincroniza `id_rubro` del producto a partir de `id_categoria` (INSERT/UPDATE) |
| `compra` | `trg_compra_set_editado_por`, `trg_compra_validar_estado` | Auditoría + valida transición de `estado` |
| `compra_producto` | `trg_cprod_set_editado_por`, `trg_cprod_validar_marca` | Auditoría + valida que la marca coincida con la del producto |
| `inventario` | `trg_inventario_set_editado_por`, `trg_inventario_validar_compra`, `trg_inventario_revertir_stock` | Auditoría + valida/marca `stock_aplicado` en `compra` + revierte stock si se borra el lote |
| `inventario_producto` | `trg_inventario_producto_init_stock_disponible`, `trg_iprod_set_editado_por`, `trg_iprod_validar_marca` | Inicializa `stock_disponible` + auditoría + valida marca |
| `caja` | `trg_caja_proteger` | Bloquea editar una caja cerrada (`CAJ04`) y las columnas de apertura; setea `editado` |
| `movimiento_caja`, `arqueo_caja` | `trg_movimiento_caja_validar`, `trg_arqueo_caja_validar` | Solo permiten INSERT sobre una caja abierta; inmutables (`CAJ13`) |

> Nota: existen funciones `set_editado_categoria`, `set_editado_tipo_movimiento` pero **no aparecen triggers que las invoquen** sobre `categoria` ni `tipo_movimiento` — posible pendiente (esas tablas podrían no estar actualizando `editado` automáticamente).

---

## ⚠️ Discrepancias con el documento de contexto anterior

El doc anterior (el que traía la sección de login/roles con Next.js) describe un modelo que **no es el que está implementado**:

| Doc anterior decía | Realidad en la base |
|---|---|
| Tablas `lote` / `lote_deposito` | No existen. El equivalente real es `inventario` / `inventario_producto` (para lotes con vencimiento) + `stock` (para el total disponible por depósito) |
| Vistas `vista_stock_producto`, `vista_stock_producto_deposito`, `vista_lote_detalle` | No existen. Solo existe `vista_diferencias_recepcion` |
| "Nada de tablas de stock sueltas, se calcula vía vistas" | Falso en la práctica: `stock` es una tabla con `cantidad` sincronizada directamente, mantenida por `movimiento_stock` + triggers |
| RLS deshabilitado en `usuario`, `marca`, `producto`, `deposito`, etc. | RLS está **habilitado** en las tablas de `public`, con políticas ya definidas en la mayoría |
| "RLS por rol no implementado todavía" | Parcialmente falso: `usuario` ya tiene una política que distingue `Gerente` del resto |
| No se menciona nada de `compra`, `compra_producto`, `inventario`, `inventario_producto`, `proveedor`, `medio_pago`, `rubro`, `categoria`, `tipo_movimiento` | Estas tablas existen y tienen bastante desarrollo (funciones, triggers). `compra`/`compra_producto`/`inventario`/`inventario_producto` siguen sin políticas RLS. `proveedor` ya tiene CRUD vía `fn_proveedor_*` (+ trigger) y pantalla ABMC; `medio_pago` tiene las 4 políticas RLS + `fn_medio_pago_*` (+ trigger) y pantalla ABMC en Tesorería |

**Recomendación:** confirmar con el equipo si el doc anterior es de un sprint/diseño descartado, o si describe un rediseño pendiente de migrar. Mientras tanto, todo el trabajo de backend/frontend debería apoyarse en el esquema real documentado arriba, no en el doc de `lote`/`lote_deposito`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
