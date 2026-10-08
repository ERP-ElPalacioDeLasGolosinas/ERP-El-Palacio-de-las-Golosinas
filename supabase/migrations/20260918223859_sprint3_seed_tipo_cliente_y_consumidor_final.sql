-- Versionada en el repo el 2026-10-07 (S4-1) a partir de supabase_migrations.schema_migrations.
-- Ya aplicada en la nube con esta misma version; no reaplicar.

-- Tipos de cliente iniciales
insert into public.tipo_cliente (nombre_tipo_cliente, lista_precio, creado_por)
select v.nombre, v.lista::public.tipo_lista_precio,
       (select id_usuario from public.usuario where rol_usuario = 'Gerente' order by creado limit 1)
from (values
  ('Consumidor final', 'Minorista'),
  ('Minorista',        'Minorista'),
  ('Mayorista',        'Mayorista')
) as v(nombre, lista)
where not exists (
  select 1 from public.tipo_cliente t
  where lower(btrim(t.nombre_tipo_cliente)) = lower(v.nombre)
);

-- Cliente genérico por defecto de las ventas
insert into public.cliente (nombre_cliente, id_tipo_cliente, es_consumidor_final, creado_por)
select 'Consumidor Final',
       (select id_tipo_cliente from public.tipo_cliente where lower(nombre_tipo_cliente) = 'consumidor final'),
       true,
       (select id_usuario from public.usuario where rol_usuario = 'Gerente' order by creado limit 1)
where not exists (select 1 from public.cliente where es_consumidor_final);
