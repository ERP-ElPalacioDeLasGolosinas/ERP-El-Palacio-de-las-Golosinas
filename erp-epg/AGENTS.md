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
| `vw_usuario_resumen` | Vista blindada de usuarios: `id_usuario` + `nombre_completo` (`nombre_usuario \|\| ' ' \|\| apellido_usuario`). `security_invoker = false` (default) → corre con privilegios del owner, así que sigue resolviendo el nombre aunque a futuro se cierre/restrinja el RLS de `usuario`. Expone solo id + nombre (nada de dni, mail, teléfono, rol). Pensada para resolver `creado_por` → nombre dentro de los `fn_*_listar` vía `LEFT JOIN` + `COALESCE`. `SELECT` concedido a `authenticated`, `service_role` |

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
`fn_marca_crear`, `fn_marca_modificar`, `fn_marca_listar(p_incluir_inactivas)`, `fn_marca_habilitar`, `fn_marca_inhabilitar`

### Rubro
`fn_rubro_crear`, `fn_rubro_modificar`, `fn_rubro_listar(p_incluir_inactivos)`, `fn_rubro_habilitar`, `fn_rubro_inhabilitar`, `fn_rubro_eliminar`, `rubro_tiene_articulos_activos`, `rubro_motivo_bloqueo_delete`

### Categoría
`categoria_motivo_bloqueo_delete` (no se ve `fn_categoria_crear/modificar/listar` — posible faltante o no relevado como función `fn_`, revisar si el CRUD de categoría está resuelto directo contra la tabla)

### Unidad de medida
`fn_unidad_medida_crear(p_nombre, p_abreviatura, p_creado_por)`, `fn_unidad_medida_modificar(p_id_unidad_medida, p_nombre, p_abreviatura)`, `fn_unidad_medida_listar(p_incluir_inactivas)`, `fn_unidad_medida_habilitar(p_id_unidad_medida)`, `fn_unidad_medida_inhabilitar(p_id_unidad_medida)`, `fn_unidad_medida_eliminar(p_id_unidad_medida)`

- **`fn_unidad_medida_listar(p_incluir_inactivas boolean default true)`** → `TABLE(id_unidad_medida, nombre, abreviatura, activo, creado, editado, creado_por, creado_por_nombre)`, `ORDER BY nombre`. `creado_por_nombre` sale de `LEFT JOIN vw_usuario_resumen` + `COALESCE(..., 'Usuario no disponible')`, así que una fila con `creado_por` huérfano/nulo igual aparece. Filtra por `activo` salvo que `p_incluir_inactivas` sea `true`. (Migración `unidad_medida_listar_con_creado_por`; antes devolvía `SETOF unidad_medida`.)
- Validaciones server-side ya resueltas (mensajes en español, no errores crudos de Postgres): `crear`/`modificar` validan nombre no vacío (`UMD01`), abreviatura `^[a-z]{3}$` (`UMD06`) y unicidad de nombre/abreviatura (`UMD02`/`UMD03`). `eliminar` cuenta `producto.id_unidad_medida` y bloquea con `UMD05` si hay artículos asociados ("Solo puede inhabilitarse"). `modificar`/`habilitar`/`inhabilitar` setean `editado = now()` explícitamente (la columna `editado` es confiable acá). El alta nace `activo = true` por el default de la tabla.

### Depósito
`fn_deposito_crear`, `fn_deposito_modificar`, `fn_deposito_listar(p_incluir_inactivos)`, `fn_deposito_habilitar`, `fn_deposito_inhabilitar`, `fn_deposito_eliminar`, `fn_deposito_marcar_lleno`, `fn_deposito_desmarcar_lleno`, `set_activo_deposito`, `set_esta_lleno_deposito`, `eliminar_deposito`

### Producto
`fn_producto_crear`, `fn_producto_modificar`, `fn_producto_listar(p_incluir_inactivos, p_id_marca, p_id_categoria, p_id_rubro, p_busqueda)`, `fn_producto_eliminar`, `fn_producto_validar_codigo_unico`, `_fn_producto_validar_referencias` (interna)

### Tipo de movimiento
`fn_tipo_movimiento_crear`, `fn_tipo_movimiento_modificar`, `fn_tipo_movimiento_listar(p_incluir_inactivos)`, `fn_tipo_movimiento_habilitar`, `fn_tipo_movimiento_inhabilitar`

### Stock y movimientos
- **`fn_stock_consultar(p_id_producto, p_id_deposito)`** → `TABLE(id_stock, id_producto, codigo_producto, producto, id_unidad_medida, unidad_medida, id_deposito, nombre_deposito, cantidad, editado)`. Filtra `cantidad > 0`. **Esta es la función que usamos para la vista de listado de stock.**
- `fn_movimiento_stock_registrar(p_id_tipo_movimiento, p_id_producto, p_id_deposito, p_cantidad, p_creado_por, p_fecha_movimiento, p_remito)` → alta de movimiento (impacta `stock`)
- `fn_movimiento_stock_listar(p_id_producto, p_id_deposito, p_id_tipo_movimiento, p_fecha_desde, p_fecha_hasta)` → histórico de movimientos
- `fn_movimiento_stock_validar_stock_disponible(p_id_producto, p_id_deposito, p_cantidad)` → `TABLE(stock_actual, alcanza)`
- `fn_aplicar_stock_compra(p_id_compra, p_id_deposito, p_detalle_lote, p_items)` → aplica stock desde una recepción de compra

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