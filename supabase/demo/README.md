# Datos de demo: operaciones enero–octubre 2026

Simula diez meses de operación de la distribuidora usando las RPC reales del ERP. No es una migración: se ejecuta a mano, en la base que se quiera usar para la demo.

| Archivo | Qué hace |
|---|---|
| `demo_2026_carga.sql` | Crea el esquema `demo_seed` con las funciones de carga (no carga nada por sí solo) |
| `demo_2026_revertir.sql` | Crea `demo_seed.revertir()`, que deshace toda la carga |

## Ejecutar

Primero se corren los dos archivos (crean las funciones). Después, cada línea en su propia transacción y en orden:

```sql
select demo_seed.preparar();
select demo_seed.cargar_mes(1);   -- ... hasta
select demo_seed.cargar_mes(10);  -- octubre se carga hasta ayer
select * from demo_seed.resumen(); -- dashboard mensual + chequeos de consistencia
```

`cargar_mes` no vuelve a cargar un mes ya cargado y exige el orden. Si un mes falla, no deja nada a medias.

## Qué genera

- **Compras:** órdenes de compra semanales por depósito según el stock mínimo. Cada una genera su factura del proveedor (vinculada a la OC) y la recepción en lote con vencimiento. A veces hay faltantes (OC "Recibida parcial") y alguna cancelación.
- **Ventas mayoristas:** a los clientes mayoristas, con lista de precios del período y descuento según el cliente. Se despachan y se cobran por transferencia o cheque de terceros, según los días de pago de cada cliente.
- **Cajas** (del 08/10 al 22/10): un turno por día. El gerente levanta la caja, la empleada de ventas atiende el mostrador, hace el arqueo y pide el cierre, y el gerente cierra.
- **Pagos a proveedores:** los viernes, con orden de pago y pago desde la cuenta con más saldo (transferencia o cheque propio). Hay algún pago parcial y órdenes pendientes a fin de octubre.
- **Otros:** notas de crédito (bonificación, error de facturación, devolución con salida de stock), notas de débito (flete, intereses), transferencias entre depósitos y mermas.
- **Estacionalidad:** compra anticipada en febrero (Pascua) y julio (Día del Niño), picos de venta en marzo y agosto, verano flojo.

Datos creados porque no existían: 10 listas de precios históricas (vencidas), 7 clientes mayoristas y los tipos de movimiento "Merma por rotura o vencimiento" y "Devolución a proveedor".

## Cosas a saber

- Las ventas de caja se registran con la fecha del día (regla VTA04) y después se re-fechan; por eso solo hay cajas desde el 08/10, cuando empieza la lista minorista vigente.
- Las marcas de auditoría (`creado`, `fecha_movimiento`, `fecha_despacho`, aperturas y cierres de caja) se re-fechan a la fecha simulada. Para eso se apagan los triggers de usuario de cada tabla solo durante ese UPDATE.
- Los números internos (ventas, OC) siguen la numeración existente, así que una venta de enero puede tener un número más alto que una de septiembre cargada antes.
- El saldo anterior y el nuevo de los movimientos de stock y de tesorería se calculan en el orden de la carga, no intercalados con las operaciones que ya existían.
- La carga sigue las mismas reglas y volúmenes cada vez, pero no es idéntica fila a fila entre bases distintas: el azar depende del estado inicial.

## Revertir

```sql
select * from demo_seed.revertir();  -- muestra el stock y los saldos contra la foto previa
drop schema demo_seed cascade;       -- opcional
```
