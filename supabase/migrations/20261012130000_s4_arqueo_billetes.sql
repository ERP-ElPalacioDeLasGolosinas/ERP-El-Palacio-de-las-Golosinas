-- El arqueo guarda el conteo por billete y el saldo fisico es la suma de ese conteo.

alter table public.arqueo_caja
  add column if not exists detalle_billetes jsonb not null default '[]'::jsonb;

drop function if exists public.fn_caja_arqueo_realizar(uuid, numeric, text, uuid);

create function public.fn_caja_arqueo_realizar(
  p_id_caja uuid,
  p_saldo_fisico numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_detalle_billetes jsonb default '[]'::jsonb
)
returns public.arqueo_caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja    public.caja;
  v_resumen jsonb;
  v_arqueo  public.arqueo_caja;
  v_fisico  numeric;
  v_invalido boolean;
begin
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja esta cerrada' using errcode = 'CAJ04';
  end if;

  if p_detalle_billetes is null or jsonb_typeof(p_detalle_billetes) <> 'array' then
    raise exception 'El conteo de billetes es invalido' using errcode = 'CAJ11';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_detalle_billetes) e
    where coalesce((e.value->>'denominacion')::numeric, -1) not in (10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000)
       or coalesce((e.value->>'cantidad')::numeric, -1) < 0
       or (e.value->>'cantidad')::numeric <> trunc((e.value->>'cantidad')::numeric)
  ) into v_invalido;

  if v_invalido then
    raise exception 'El conteo de billetes es invalido' using errcode = 'CAJ11';
  end if;

  select round(coalesce(sum((e.value->>'denominacion')::numeric * (e.value->>'cantidad')::numeric), 0), 2)
    into v_fisico
  from jsonb_array_elements(p_detalle_billetes) e
  where coalesce((e.value->>'cantidad')::numeric, 0) > 0;

  v_resumen := public.fn_caja_resumen(p_id_caja);

  insert into public.arqueo_caja (
    id_caja, saldo_teorico, saldo_fisico, detalle_medios, detalle_billetes, observaciones, creado_por
  ) values (
    p_id_caja,
    (v_resumen->'efectivo'->>'saldo_teorico')::numeric,
    v_fisico,
    v_resumen->'medios',
    p_detalle_billetes,
    nullif(btrim(p_observaciones), ''),
    coalesce(p_creado_por, auth.uid())
  )
  returning * into v_arqueo;

  return v_arqueo;
end;
$$;

revoke execute on function public.fn_caja_arqueo_realizar(uuid, numeric, text, uuid, jsonb) from public, anon;
grant execute on function public.fn_caja_arqueo_realizar(uuid, numeric, text, uuid, jsonb) to authenticated, service_role;

create or replace function public.fn_caja_obtener(p_id_caja uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'caja', jsonb_build_object(
      'id_caja', c.id_caja,
      'punto_venta', c.punto_venta,
      'id_deposito', c.id_deposito,
      'nombre_deposito', d.nombre_deposito,
      'estado', c.estado,
      'monto_inicial', c.monto_inicial,
      'fecha_apertura', c.fecha_apertura,
      'abierta_por', c.abierta_por,
      'abierta_por_nombre', coalesce(ua.nombre_completo, 'Usuario no disponible'),
      'observaciones_apertura', c.observaciones_apertura,
      'fecha_cierre', c.fecha_cierre,
      'cerrada_por', c.cerrada_por,
      'cerrada_por_nombre', uc.nombre_completo,
      'observaciones_cierre', c.observaciones_cierre,
      'total_ingresos', c.total_ingresos,
      'total_egresos', c.total_egresos,
      'saldo_teorico_efectivo', c.saldo_teorico_efectivo,
      'saldo_fisico_efectivo', c.saldo_fisico_efectivo,
      'diferencia_efectivo', c.diferencia_efectivo,
      'resumen_cierre', c.resumen_cierre
    ),
    'resumen', public.fn_caja_resumen(c.id_caja),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', m.id_movimiento_caja,
        'tipo', m.tipo,
        'id_medio_pago', m.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', m.importe,
        'motivo', m.motivo,
        'referencia', m.referencia,
        'id_comprobante', m.id_comprobante,
        'comprobante', case when v.id_comprobante is null then null
          else tc.nombre_tipo_comprobante || ' ' || lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') end,
        'creado', m.creado,
        'creado_por_nombre', coalesce(um.nombre_completo, 'Usuario no disponible')
      ) order by m.creado desc)
      from public.movimiento_caja m
      join public.medio_pago mp on mp.id_medio_pago = m.id_medio_pago
      left join public.comprobante_venta v on v.id_comprobante = m.id_comprobante
      left join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
      left join public.vw_usuario_resumen um on um.id_usuario = m.creado_por
      where m.id_caja = c.id_caja
    ), '[]'::jsonb),
    'arqueos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_arqueo', a.id_arqueo,
        'saldo_teorico', a.saldo_teorico,
        'saldo_fisico', a.saldo_fisico,
        'diferencia', a.diferencia,
        'detalle_medios', a.detalle_medios,
        'detalle_billetes', a.detalle_billetes,
        'observaciones', a.observaciones,
        'creado', a.creado,
        'creado_por_nombre', coalesce(uq.nombre_completo, 'Usuario no disponible')
      ) order by a.creado desc)
      from public.arqueo_caja a
      left join public.vw_usuario_resumen uq on uq.id_usuario = a.creado_por
      where a.id_caja = c.id_caja
    ), '[]'::jsonb)
  )
  from public.caja c
  left join public.deposito d on d.id_deposito = c.id_deposito
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  where c.id_caja = p_id_caja;
$$;

notify pgrst, 'reload schema';
