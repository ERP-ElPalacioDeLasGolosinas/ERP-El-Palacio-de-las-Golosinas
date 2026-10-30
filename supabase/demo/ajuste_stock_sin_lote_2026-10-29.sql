-- Ajuste de stock sin lote (29/10/2026).
--
-- El "Ingreso inicial (demo)" del 16/10 cargó stock sin crear lotes, de antes de que el ERP
-- manejara lotes. Este ajuste baja el stock de cada producto/depósito a lo disponible en sus
-- lotes con un movimiento "Ajuste - Corrección (resta)", sin tocar los lotes, así el
-- historial sigue sumando igual que el stock.
--
-- Es idempotente: solo actúa donde el stock supera lo disponible en lotes.
-- Autor: el gerente que registró el ingreso inicial.

begin;

with lotes as (
  select ip.id_producto, i.id_deposito, sum(ip.stock_disponible) as disponible
  from public.inventario_producto ip
  join public.inventario i on i.id_lote = ip.id_inventario
  group by 1, 2
),
diferencias as (
  select s.id_stock, s.id_producto, s.id_deposito,
         s.cantidad as stock_anterior,
         coalesce(l.disponible, 0) as stock_nuevo
  from public.stock s
  left join lotes l using (id_producto, id_deposito)
  where s.cantidad > coalesce(l.disponible, 0)
),
movimientos as (
  insert into public.movimiento_stock (
    id_tipo_movimiento, id_producto, id_deposito, cantidad,
    fecha_movimiento, remito, stock_anterior, stock_nuevo, creado_por
  )
  select (select id_tipo_movimiento from public.tipo_movimiento where nombre = 'Ajuste - Corrección (resta)'),
         d.id_producto, d.id_deposito, d.stock_anterior - d.stock_nuevo,
         current_date, 'Ajuste: stock sin lote', d.stock_anterior, d.stock_nuevo,
         (select u.id_usuario from public.usuario u where u.mail_usuario = 'samuelarzelan18@gmail.com')
  from diferencias d
  returning id_movimiento
)
update public.stock s
set cantidad = d.stock_nuevo, editado = now()
from diferencias d
where s.id_stock = d.id_stock;

commit;
