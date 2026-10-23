-- =====================================================================
-- Carga de operaciones de demo: enero a octubre de 2026
-- El Palacio de las Golosinas
--
-- Crea el esquema demo_seed con las funciones que simulan la operación
-- diaria de la distribuidora. Todas las operaciones pasan por las RPC
-- reales del ERP (fn_venta_registrar, fn_comprobante_registrar,
-- fn_lote_registrar_desde_comprobante, fn_cobro_registrar, fn_pago_registrar,
-- cajas, notas, etc.), así que validan stock, estados, saldos y vínculos
-- igual que desde la aplicación. Después de cada mes se re-fechan las marcas
-- de auditoría (creado, fecha_movimiento, fecha_despacho...) con la fecha
-- simulada de cada operación.
--
-- No modifica registros existentes: solo agrega filas nuevas. El stock y los
-- saldos de las cuentas de tesorería cambian como consecuencia de las
-- operaciones. Cada fila creada queda anotada en demo_seed.registro, que usa
-- demo_2026_revertir.sql para deshacer la carga.
--
-- Uso (cada línea en su propia transacción, en este orden):
--   select demo_seed.preparar();
--   select demo_seed.cargar_mes(1);  ...  select demo_seed.cargar_mes(10);
--   select * from demo_seed.resumen();
-- =====================================================================

create schema if not exists demo_seed;
revoke all on schema demo_seed from public;
do $$ begin
  execute 'revoke all on schema demo_seed from anon, authenticated';
exception when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Tablas de control
-- ---------------------------------------------------------------------
create table if not exists demo_seed.parametro (
  clave text primary key,
  id    uuid not null
);

-- Toda fila creada por la carga, con la fecha y hora simulada.
create table if not exists demo_seed.registro (
  tabla    text not null,
  id       uuid not null,
  ts       timestamptz not null,
  aplicado boolean not null default false,
  primary key (tabla, id)
);

-- Tareas diferidas: despachar, cobrar, facturar una orden, pagar...
create table if not exists demo_seed.pendiente (
  id    bigserial primary key,
  tipo  text not null,
  fecha date not null,
  ref   uuid not null,
  extra jsonb not null default '{}'::jsonb,
  hecho boolean not null default false
);
create index if not exists pendiente_tipo_fecha on demo_seed.pendiente (tipo, fecha) where not hecho;

create table if not exists demo_seed.mes_cargado (
  mes    int primary key,
  cargado timestamptz not null default now()
);

-- Qué proveedor abastece cada marca, plazo de pago y punto de venta de sus facturas.
create table if not exists demo_seed.proveedor_marca (
  id_marca     uuid primary key,
  id_proveedor uuid not null
);
create table if not exists demo_seed.proveedor_perfil (
  id_proveedor uuid primary key,
  punto_venta  int not null,
  plazo_pago   int not null
);

-- Comportamiento de cada cliente mayorista.
create table if not exists demo_seed.cliente_perfil (
  id_cliente  uuid primary key,
  peso        numeric not null,
  id_deposito uuid not null,
  dias_min    int not null,
  dias_max    int not null,
  descuento   numeric not null default 0,
  escolar     boolean not null default false
);

-- Foto previa a la carga, para verificar la reversión.
create table if not exists demo_seed.snapshot_stock (
  id_producto uuid, id_deposito uuid, cantidad numeric,
  primary key (id_producto, id_deposito)
);
create table if not exists demo_seed.snapshot_cuenta (
  id_cuenta uuid primary key, saldo_actual numeric
);

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function demo_seed._p(p_clave text)
returns uuid language sql stable as $$
  select id from demo_seed.parametro where clave = p_clave;
$$;

-- Ejecuta lo que sigue como si lo hiciera ese usuario (auth.uid()).
create or replace function demo_seed._como(p_uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_uid::text, true),
         set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Fecha y hora local (Argentina) al azar entre dos horas del día.
create or replace function demo_seed._ts(p_fecha date, p_desde numeric, p_hasta numeric)
returns timestamptz language sql volatile as $$
  select (p_fecha + make_interval(secs => ((p_desde + random()::numeric * (p_hasta - p_desde)) * 3600)::int))
         ::timestamp at time zone 'America/Argentina/Buenos_Aires';
$$;

create or replace function demo_seed._local(p_ts timestamptz)
returns date language sql immutable as $$
  select (p_ts at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

create or replace function demo_seed._reg(p_tabla text, p_id uuid, p_ts timestamptz)
returns void language sql as $$
  insert into demo_seed.registro (tabla, id, ts) values (p_tabla, p_id, p_ts)
  on conflict (tabla, id) do update set ts = excluded.ts, aplicado = false;
$$;

create or replace function demo_seed._pendiente(p_tipo text, p_fecha date, p_ref uuid, p_extra jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into demo_seed.pendiente (tipo, fecha, ref, extra) values (p_tipo, p_fecha, p_ref, p_extra);
$$;

create or replace function demo_seed._es_feriado(p_fecha date)
returns boolean language sql immutable as $$
  select p_fecha in (
    date '2026-01-01', date '2026-02-16', date '2026-02-17', date '2026-03-23', date '2026-03-24',
    date '2026-04-02', date '2026-04-03', date '2026-05-01', date '2026-05-25', date '2026-06-15',
    date '2026-06-20', date '2026-07-09', date '2026-07-10', date '2026-08-17', date '2026-10-12'
  );
$$;

create or replace function demo_seed._es_habil(p_fecha date)
returns boolean language sql immutable as $$
  select extract(isodow from p_fecha) < 7 and not demo_seed._es_feriado(p_fecha);
$$;

-- Ritmo de ventas por mes (1 = normal).
create or replace function demo_seed._demanda(p_mes int)
returns numeric language sql immutable as $$
  select (array[0.70, 0.85, 1.15, 1.05, 0.82, 0.95, 1.10, 1.38, 1.00, 1.12])[p_mes];
$$;

-- Nivel de reposición por mes: se compra de más antes de Pascua y del Día del Niño.
create or replace function demo_seed._reposicion_factor(p_mes int)
returns numeric language sql immutable as $$
  select (array[0.90, 1.35, 1.10, 0.85, 0.95, 1.10, 1.45, 1.00, 1.00, 1.05])[p_mes];
$$;

-- Precio relativo a la lista de octubre (inflación acumulada).
create or replace function demo_seed._precio_factor(p_fecha date)
returns numeric language sql immutable as $$
  select case
    when p_fecha < date '2026-03-01' then 0.80
    when p_fecha < date '2026-05-01' then 0.85
    when p_fecha < date '2026-07-01' then 0.89
    when p_fecha < date '2026-09-01' then 0.94
    when p_fecha < date '2026-10-08' then 0.97
    else 1.00
  end;
$$;

-- Estacionalidad por categoría.
create or replace function demo_seed._peso_categoria(p_mes int, p_categoria text)
returns numeric language sql immutable as $$
  select case
    when p_categoria in ('Chocolates', 'Bombones y bocaditos') then
      (array[0.6, 1.3, 1.9, 1.3, 1.1, 1.3, 1.3, 1.2, 1.0, 1.4])[p_mes]
    when p_categoria in ('Gaseosas', 'Papas fritas', 'Chicles', 'Pastillas') then
      (array[1.9, 1.7, 1.0, 0.8, 0.7, 0.6, 0.7, 0.8, 1.0, 1.2])[p_mes]
    when p_categoria in ('Chupetines', 'Caramelos', 'Gomitas', 'Otras golosinas') then
      (array[1.0, 1.0, 1.1, 1.0, 0.9, 1.0, 1.4, 2.2, 1.0, 1.0])[p_mes]
    when p_categoria = 'Alfajores' then
      (array[0.8, 0.9, 1.4, 1.2, 1.2, 1.3, 1.3, 1.1, 1.1, 1.0])[p_mes]
    else 1.0
  end;
$$;

-- Siguiente número de comprobante del proveedor en su punto de venta.
create or replace function demo_seed._numero_proveedor(p_id_proveedor uuid, p_id_tipo uuid, p_pv int)
returns int language sql stable as $$
  select coalesce(max(numero), 4800 + p_pv * 37) + 1
  from public.comprobante_proveedor
  where id_proveedor = p_id_proveedor and id_tipo_comprobante = p_id_tipo and punto_venta = p_pv;
$$;

create or replace function demo_seed._referencia(p_prefijo text, p_fecha date)
returns text language sql volatile as $$
  select p_prefijo || to_char(p_fecha, 'YYMMDD') || lpad((floor(random()::numeric * 1000000))::int::text, 6, '0');
$$;

-- Activa o desactiva los triggers de usuario de una tabla (solo para re-fechar).
create or replace function demo_seed._triggers(p_tabla text, p_activos boolean)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I %s trigger user', p_tabla,
                 case when p_activos then 'enable' else 'disable' end);
end;
$$;

-- ---------------------------------------------------------------------
-- preparar(): parámetros, listas de precios históricas, clientes nuevos,
-- tipos de movimiento que faltan y perfiles de proveedores/clientes.
-- ---------------------------------------------------------------------
create or replace function demo_seed.preparar()
returns text language plpgsql as $$
declare
  v_gerente   uuid;
  v_deposito  uuid[];
  v_lista     public.lista_precio;
  v_base      uuid;
  v_cli       public.cliente;
  v_tm        public.tipo_movimiento;
  v_ts        timestamptz;
  r           record;
  i           int := 0;
begin
  if exists (select 1 from demo_seed.parametro) then
    return 'demo_seed ya estaba preparado';
  end if;

  perform setseed(0.2026);

  -- Usuarios por rol
  insert into demo_seed.parametro
  select 'gerente', id_usuario from public.usuario where rol_usuario = 'Gerente' order by creado limit 1;
  insert into demo_seed.parametro
  select 'gerente2', id_usuario from public.usuario where rol_usuario = 'Gerente' order by creado offset 1 limit 1;
  insert into demo_seed.parametro
  select 'ventas', id_usuario from public.usuario where rol_usuario = 'Empleado Ventas' order by creado limit 1;
  insert into demo_seed.parametro
  select 'compras', id_usuario from public.usuario where rol_usuario = 'Empleado Compras' order by creado limit 1;
  insert into demo_seed.parametro
  select 'deposito', id_usuario from public.usuario where rol_usuario = 'Empleado Deposito' order by creado limit 1;
  if (select count(*) from demo_seed.parametro) < 5 then
    raise exception 'Faltan usuarios: hacen falta 2 gerentes y un empleado de ventas, compras y deposito';
  end if;

  -- Comprobantes, medios y cuentas
  insert into demo_seed.parametro
  select k, id from (values
    ('fa',  (select id_tipo_comprobante from public.tipo_comprobante where nombre_tipo_comprobante = 'Factura A' and activo)),
    ('fb',  (select id_tipo_comprobante from public.tipo_comprobante where nombre_tipo_comprobante = 'Factura B' and activo)),
    ('nca', (select id_tipo_comprobante from public.tipo_comprobante where clase = 'nota_credito' and aplica_compra and activo order by creado limit 1)),
    ('nda', (select id_tipo_comprobante from public.tipo_comprobante where clase = 'nota_debito' and aplica_compra and activo order by creado limit 1)),
    ('efectivo',        (select id_medio_pago from public.medio_pago where tipo = 'Efectivo' and activo order by creado limit 1)),
    ('transferencia',   (select id_medio_pago from public.medio_pago where tipo = 'Transferencia' and activo order by creado limit 1)),
    ('cheque_propio',   (select id_medio_pago from public.medio_pago where tipo = 'Cheque propio' and activo order by creado limit 1)),
    ('cheque_terceros', (select id_medio_pago from public.medio_pago where tipo = 'Cheque de terceros' and activo order by creado limit 1)),
    ('mercado_pago',    (select id_medio_pago from public.medio_pago where tipo = 'Mercado Pago' and activo order by creado limit 1)),
    ('credito',         (select id_medio_pago from public.medio_pago where tipo = 'Tarjeta de crédito' and activo order by creado limit 1)),
    ('debito',          (select id_medio_pago from public.medio_pago where tipo = 'Tarjeta de débito' and activo order by creado limit 1)),
    ('banco_nacion',  (select id_cuenta from public.cuenta_tesoreria where nombre_cuenta = 'Banco Nacion')),
    ('banco_galicia', (select id_cuenta from public.cuenta_tesoreria where nombre_cuenta = 'Banco Galicia')),
    ('banco_macro',   (select id_cuenta from public.cuenta_tesoreria where nombre_cuenta = 'Banco Macro')),
    ('tc_mayorista',  (select id_tipo_cliente from public.tipo_cliente where nombre_tipo_cliente = 'Mayorista')),
    ('tc_minorista',  (select id_tipo_cliente from public.tipo_cliente where nombre_tipo_cliente = 'Minorista')),
    ('tm_salida_venta', (select id_tipo_movimiento from public.tipo_movimiento where lower(nombre) = 'salida por venta'))
  ) t(k, id);
  -- (insert falla por NOT NULL si algún catálogo no existe)

  v_gerente := demo_seed._p('gerente');
  perform demo_seed._como(v_gerente);

  -- Foto previa
  insert into demo_seed.snapshot_stock select id_producto, id_deposito, cantidad from public.stock;
  insert into demo_seed.snapshot_cuenta select id_cuenta, saldo_actual from public.cuenta_tesoreria;

  -- Listas de precios históricas (vencidas): la RPC no crea listas vencidas,
  -- así que se insertan con las mismas columnas que fn_lista_precio_crear.
  for r in
    select * from (values
      ('Ene-Feb 2026', date '2026-01-01', date '2026-02-28', 0.80, date '2025-12-29'),
      ('Mar-Abr 2026', date '2026-03-01', date '2026-04-30', 0.85, date '2026-02-25'),
      ('May-Jun 2026', date '2026-05-01', date '2026-06-30', 0.89, date '2026-04-28'),
      ('Jul-Ago 2026', date '2026-07-01', date '2026-08-31', 0.94, date '2026-06-29'),
      ('Sep-Oct 2026', date '2026-09-01', date '2026-10-07', 0.97, date '2026-08-28')
    ) t(nombre, inicio, fin, factor, alta)
  loop
    for i in 1 .. 2 loop
      select id_lista_precio into v_base
      from public.fn_lista_precio_vigente(
        (case when i = 1 then 'Mayorista' else 'Minorista' end)::public.tipo_lista_precio, date '2026-10-08');
      if v_base is null then
        raise exception 'No hay lista % vigente al 08/10/2026 para tomar de base',
          case when i = 1 then 'Mayorista' else 'Minorista' end;
      end if;

      insert into public.lista_precio (nombre_lista_precio, tipo_lista, fecha_inicio, fecha_fin, observaciones)
      values ('Lista ' || case when i = 1 then 'Mayorista ' else 'Minorista ' end || r.nombre,
              (case when i = 1 then 'Mayorista' else 'Minorista' end)::public.tipo_lista_precio,
              r.inicio, r.fin, 'Actualización bimestral de precios')
      returning * into v_lista;

      insert into public.lista_precio_detalle (id_lista_precio, id_producto, precio)
      select v_lista.id_lista_precio, d.id_producto, greatest(round(d.precio * r.factor / 10) * 10, 10)
      from public.lista_precio_detalle d
      where d.id_lista_precio = v_base;

      perform demo_seed._reg('lista_precio', v_lista.id_lista_precio, demo_seed._ts(r.alta, 10, 17));
    end loop;
  end loop;

  -- Tipos de movimiento que el ERP no trae y la operación necesita
  if not exists (select 1 from public.tipo_movimiento where lower(nombre) = lower('Merma por rotura o vencimiento')) then
    v_tm := public.fn_tipo_movimiento_crear('Merma por rotura o vencimiento', (-1)::smallint, v_gerente, true,
                                            'Baja de mercaderia rota, dañada o vencida');
    perform demo_seed._reg('tipo_movimiento', v_tm.id_tipo_movimiento, demo_seed._ts(date '2026-01-05', 9, 11));
  end if;
  if not exists (select 1 from public.tipo_movimiento where lower(nombre) = lower('Devolución a proveedor')) then
    v_tm := public.fn_tipo_movimiento_crear('Devolución a proveedor', (-1)::smallint, v_gerente, true,
                                            'Salida de mercaderia devuelta al proveedor contra nota de credito');
    perform demo_seed._reg('tipo_movimiento', v_tm.id_tipo_movimiento, demo_seed._ts(date '2026-01-05', 9, 11));
  end if;
  insert into demo_seed.parametro
  select 'tm_merma', id_tipo_movimiento from public.tipo_movimiento where lower(nombre) = lower('Merma por rotura o vencimiento');
  insert into demo_seed.parametro
  select 'tm_devolucion', id_tipo_movimiento from public.tipo_movimiento where lower(nombre) = lower('Devolución a proveedor');

  -- Clientes mayoristas nuevos (los existentes no alcanzan para el volumen de una distribuidora)
  for r in
    select * from (values
      ('Autoservicio Los Pinos S.R.L.',        '30-71566778-3', '3814602101', 'compras@autoservicioslospinos.com.ar', 'Av. Mate de Luna 2450', date '2026-01-05'),
      ('Maxikiosco 24 Horas Centro',           '20-28765432-1', '3814602102', 'maxi24centro@gmail.com',               '25 de Mayo 410',        date '2026-01-07'),
      ('Cotillón Arcoíris',                    '27-31222333-4', '3814602103', 'arcoiris.cotillon@gmail.com',          'San Juan 875',          date '2026-01-12'),
      ('Autoservicio El Sol',                  '30-71655443-2', '3814602104', 'autoservicioelsol@hotmail.com',        'Av. Alem 1320',         date '2026-01-19'),
      ('Almacén Doña Rosa',                    '27-25444555-6', '3814602105', 'donarosa.almacen@gmail.com',           'Lamadrid 233',          date '2026-02-02'),
      ('Kiosco Escolar San Martín',            '20-36111222-5', '3814602106', 'cantina.sanmartin@gmail.com',          'Bolívar 760',           date '2026-02-23'),
      ('Golosinas Yerba Buena S.A.S.',         '30-71788990-7', '3814602107', 'pedidos@golosinasyb.com.ar',           'Av. Aconquija 3100',    date '2026-01-08')
    ) t(nombre, doc, tel, mail, dir, alta)
  loop
    if not exists (select 1 from public.cliente where documento_cliente = r.doc) then
      v_cli := public.fn_cliente_crear(r.nombre, demo_seed._p('tc_mayorista'), r.doc, r.tel, v_gerente, r.mail, r.dir);
      perform demo_seed._reg('cliente', v_cli.id_cliente, demo_seed._ts(r.alta, 9, 18));
    end if;
  end loop;

  -- Perfiles de clientes mayoristas (existentes + nuevos)
  select array_agg(id_deposito order by nombre_deposito) into v_deposito
  from public.deposito where activo and not esta_lleno;

  i := 0;
  for r in
    select c.id_cliente, c.nombre_cliente
    from public.cliente c
    join public.tipo_cliente tc on tc.id_tipo_cliente = c.id_tipo_cliente
    where c.activo and not c.es_consumidor_final and tc.lista_precio = 'Mayorista'
    order by c.nombre_cliente
  loop
    i := i + 1;
    insert into demo_seed.cliente_perfil (id_cliente, peso, id_deposito, dias_min, dias_max, descuento, escolar)
    values (
      r.id_cliente,
      case
        when r.nombre_cliente ilike 'Distribuidora%' or r.nombre_cliente ilike 'Golosinas Yerba%' then 2.6
        when r.nombre_cliente ilike 'Autoservicio%' then 2.0
        when r.nombre_cliente ilike '%Fiestas%' or r.nombre_cliente ilike 'Cotill%' then 1.3
        when r.nombre_cliente ilike 'Almac%' then 1.0
        else 0.9
      end,
      v_deposito[1 + (i % array_length(v_deposito, 1))],
      case when r.nombre_cliente ilike 'Kiosco La Esquina%' then 35 when r.nombre_cliente ilike 'Distribuidora%' then 20 else 5 end,
      case when r.nombre_cliente ilike 'Kiosco La Esquina%' then 62 when r.nombre_cliente ilike 'Distribuidora%' then 35 else 25 end,
      case
        when r.nombre_cliente ilike 'Distribuidora%' or r.nombre_cliente ilike 'Golosinas Yerba%' then 5
        when r.nombre_cliente ilike 'Autoservicio%' then 3
        else 0
      end,
      r.nombre_cliente ilike '%Escolar%'
    );
  end loop;

  -- Proveedores: perfil y marcas que abastece
  i := 0;
  for r in select id_proveedor, nombre_proveedor from public.proveedor where activo order by nombre_proveedor loop
    i := i + 1;
    insert into demo_seed.proveedor_perfil (id_proveedor, punto_venta, plazo_pago)
    values (r.id_proveedor, 2 + i * 3,
            case
              when r.nombre_proveedor ilike 'Arcor%' or r.nombre_proveedor ilike 'Nestl%' then 30
              when r.nombre_proveedor ilike 'Bebidas%' then 15
              when r.nombre_proveedor ilike 'PepsiCo%' then 21
              else 25
            end);
  end loop;

  insert into demo_seed.proveedor_marca (id_marca, id_proveedor)
  select m.id_marca,
    coalesce(
      case
        when m.nombre_marca in ('Arcor', 'Cofler', 'Bon o Bon', 'Mogul', 'Rocklets', 'Bagley', 'Mr Pops', 'Águila', 'Tofi', 'Butter Toffees')
          then (select id_proveedor from public.proveedor where nombre_proveedor ilike 'Arcor%' and activo limit 1)
        when m.nombre_marca in ('Nestlé', 'Kinder', 'Ferrero Rocher', 'Tic Tac')
          then (select id_proveedor from public.proveedor where nombre_proveedor ilike 'Nestl%' and activo limit 1)
        when m.nombre_marca in ('Lays', 'Toddy', 'Pringles', 'Pepitos')
          then (select id_proveedor from public.proveedor where nombre_proveedor ilike 'PepsiCo%' and activo limit 1)
        when m.nombre_marca in ('Coca-Cola', 'Pepsi', 'Villa del Sur')
          then (select id_proveedor from public.proveedor where nombre_proveedor ilike 'Bebidas%' and activo limit 1)
      end,
      (select id_proveedor from (
         select id_proveedor, row_number() over (order by nombre_proveedor) - 1 as n
         from public.proveedor
         where activo and nombre_proveedor !~* '^(Arcor|Nestl|PepsiCo|Bebidas)'
       ) x
       where x.n = abs(hashtext(m.nombre_marca)) % greatest((select count(*) from public.proveedor
                                                              where activo and nombre_proveedor !~* '^(Arcor|Nestl|PepsiCo|Bebidas)'), 1))
    )
  from public.marca m
  where exists (select 1 from public.producto p where p.id_marca = m.id_marca);

  perform demo_seed._refechar();
  return 'demo_seed preparado';
end;
$$;

-- ---------------------------------------------------------------------
-- Ventas mayoristas del día
-- ---------------------------------------------------------------------
create or replace function demo_seed._ventas_mayoristas(p_fecha date)
returns void language plpgsql as $$
declare
  v_mes      int := extract(month from p_fecha);
  v_n        int;
  v_cli      record;
  v_dep      uuid;
  v_k        int;
  v_detalle  jsonb;
  v_venta    public.comprobante_venta;
  v_ts       timestamptz;
  v_lista    uuid;
  v_vendedor uuid;
  i          int;
begin
  select id_lista_precio into v_lista from public.fn_lista_precio_vigente('Mayorista', p_fecha);
  if v_lista is null then
    return;
  end if;

  v_n := floor(2.0 * demo_seed._demanda(v_mes)
               * case when extract(isodow from p_fecha) = 6 then 0.5 else 1 end
               * (0.45 + random()::numeric * 1.1) + random()::numeric);

  for i in 1 .. v_n loop
    select cp.* into v_cli
    from demo_seed.cliente_perfil cp
    join public.cliente c on c.id_cliente = cp.id_cliente and c.activo
    where not (cp.escolar and v_mes in (1, 2, 7))
    order by -ln(1 - random()::numeric) / cp.peso
    limit 1;
    exit when v_cli.id_cliente is null;

    v_dep := case when random()::numeric < 0.8 then v_cli.id_deposito
                  else (select id_deposito from public.deposito where activo order by random()::numeric limit 1) end;
    v_k := 4 + floor(random()::numeric * 6)::int + floor(v_cli.peso * 2)::int;

    select jsonb_agg(jsonb_build_object('id_producto', x.id_producto, 'id_deposito', v_dep, 'cantidad', x.cantidad))
      into v_detalle
    from (
      select s.id_producto,
             least(floor(s.cantidad / 6) * 6, (1 + floor(random()::numeric * 4)) * 6) as cantidad
      from public.stock s
      join public.producto p on p.id_producto = s.id_producto and p.activo
      left join public.categoria c on c.id_categoria = p.id_categoria
      join public.lista_precio_detalle lpd on lpd.id_lista_precio = v_lista and lpd.id_producto = s.id_producto
      where s.id_deposito = v_dep and s.cantidad >= 6
      order by -ln(1 - random()::numeric) / demo_seed._peso_categoria(v_mes, c.nombre_categoria)
      limit v_k
    ) x;

    continue when v_detalle is null;

    v_vendedor := case when random()::numeric < 0.7 then demo_seed._p('ventas') else demo_seed._p('gerente2') end;
    perform demo_seed._como(v_vendedor);
    v_ts := demo_seed._ts(p_fecha, 8.5, 13);

    v_venta := public.fn_venta_registrar(
      v_cli.id_cliente, demo_seed._p('fa'), p_fecha,
      case when random()::numeric < 0.15 then 'Pedido tomado por telefono' when random()::numeric < 0.1 then 'Entregar por la mañana' end,
      v_detalle, v_cli.descuento, v_vendedor, 'Mayorista', null, null
    );

    perform demo_seed._reg('comprobante_venta', v_venta.id_comprobante, v_ts);
    perform demo_seed._reg('movimiento_stock', d.id_movimiento, v_ts)
    from public.comprobante_venta_detalle d where d.id_comprobante = v_venta.id_comprobante;

    perform demo_seed._pendiente('despacho', p_fecha + case when random()::numeric < 0.6 then 0 else 1 end,
                                 v_venta.id_comprobante);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Despachos y cobros de ventas mayoristas
-- ---------------------------------------------------------------------
create or replace function demo_seed._despachos(p_fecha date)
returns void language plpgsql as $$
declare
  r      record;
  v_cli  demo_seed.cliente_perfil;
begin
  perform demo_seed._como(demo_seed._p('deposito'));
  for r in
    select p.id, p.ref from demo_seed.pendiente p
    where p.tipo = 'despacho' and not p.hecho and p.fecha <= p_fecha
    order by p.id
  loop
    perform public.fn_venta_despachar(r.ref);
    perform demo_seed._reg('despacho', r.ref, demo_seed._ts(p_fecha, 14, 18));

    select cp.* into v_cli
    from demo_seed.cliente_perfil cp
    join public.comprobante_venta v on v.id_cliente = cp.id_cliente
    where v.id_comprobante = r.ref;

    perform demo_seed._pendiente('cobro',
      p_fecha + coalesce(v_cli.dias_min, 7) + floor(random()::numeric * (coalesce(v_cli.dias_max, 25) - coalesce(v_cli.dias_min, 7) + 1))::int,
      r.ref);
    update demo_seed.pendiente set hecho = true where id = r.id;
  end loop;
end;
$$;

create or replace function demo_seed._cobros(p_fecha date)
returns void language plpgsql as $$
declare
  r       record;
  v_venta public.comprobante_venta;
  v_cobro public.cobro;
  v_medios jsonb;
  v_ts    timestamptz;
  v_x     numeric;
  v_parte numeric;
begin
  perform demo_seed._como(demo_seed._p('gerente'));
  for r in
    select p.id, p.ref from demo_seed.pendiente p
    where p.tipo = 'cobro' and not p.hecho and p.fecha <= p_fecha
    order by p.id
  loop
    select * into v_venta from public.comprobante_venta where id_comprobante = r.ref;
    if v_venta.estado <> 'Despachado' or v_venta.saldo_pendiente <= 0 then
      update demo_seed.pendiente set hecho = true where id = r.id;
      continue;
    end if;

    v_x := random()::numeric;
    if v_x < 0.12 and v_venta.saldo_pendiente > 150000 then
      -- Parte en cheque de terceros, parte por transferencia
      v_parte := round(v_venta.saldo_pendiente * (0.4 + random()::numeric * 0.3), -3);
      v_medios := jsonb_build_array(
        jsonb_build_object('id_medio_pago', demo_seed._p('cheque_terceros'), 'id_cuenta_tesoreria', demo_seed._p('banco_nacion'),
                           'importe', v_parte, 'referencia', 'CH ' || lpad((floor(random()::numeric * 90000000) + 10000000)::int::text, 8, '0')),
        jsonb_build_object('id_medio_pago', demo_seed._p('transferencia'), 'id_cuenta_tesoreria', demo_seed._p('banco_macro'),
                           'importe', round(v_venta.saldo_pendiente - v_parte, 2), 'referencia', demo_seed._referencia('TRF', p_fecha)));
    elsif v_x < 0.24 then
      v_medios := jsonb_build_array(
        jsonb_build_object('id_medio_pago', demo_seed._p('cheque_terceros'), 'id_cuenta_tesoreria', demo_seed._p('banco_nacion'),
                           'importe', v_venta.saldo_pendiente, 'referencia', 'CH ' || lpad((floor(random()::numeric * 90000000) + 10000000)::int::text, 8, '0')));
    else
      v_medios := jsonb_build_array(
        jsonb_build_object('id_medio_pago', demo_seed._p('transferencia'),
                           'id_cuenta_tesoreria', case when random()::numeric < 0.5 then demo_seed._p('banco_macro') else demo_seed._p('banco_galicia') end,
                           'importe', v_venta.saldo_pendiente, 'referencia', demo_seed._referencia('TRF', p_fecha)));
    end if;

    v_cobro := public.fn_cobro_registrar(r.ref, p_fecha, null, v_medios, demo_seed._p('gerente'));
    v_ts := demo_seed._ts(p_fecha, 10, 17.5);
    perform demo_seed._reg('cobro', v_cobro.id_cobro, v_ts);
    perform demo_seed._reg('venta_editada', r.ref, v_ts);
    perform demo_seed._reg('movimiento_tesoreria', m.id_movimiento, v_ts)
    from public.movimiento_tesoreria m where m.id_cobro = v_cobro.id_cobro;
    update demo_seed.pendiente set hecho = true where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Reposición: órdenes de compra por depósito y proveedor
-- ---------------------------------------------------------------------
create or replace function demo_seed._reposicion(p_fecha date)
returns void language plpgsql as $$
declare
  v_mes     int := extract(month from p_fecha);
  v_f       numeric := demo_seed._reposicion_factor(extract(month from p_fecha)::int);
  v_precio  numeric := demo_seed._precio_factor(p_fecha);
  v_dep     record;
  v_prov    record;
  v_detalle jsonb;
  v_oc      public.orden_compra;
begin
  perform demo_seed._como(demo_seed._p('compras'));

  for v_dep in select id_deposito, nombre_deposito from public.deposito where activo and not esta_lleno order by nombre_deposito loop
    for v_prov in
      with necesidad as (
        select pm.id_proveedor, p.id_producto, coalesce(s.cantidad, 0) as stock,
               round(case when p.costo_producto > 4000 then 12 else 14 end * v_f
                     * demo_seed._peso_categoria(least(v_mes + 1, 10), c.nombre_categoria)) as objetivo
        from public.producto p
        join demo_seed.proveedor_marca pm on pm.id_marca = p.id_marca
        left join public.categoria c on c.id_categoria = p.id_categoria
        left join public.stock s on s.id_producto = p.id_producto and s.id_deposito = v_dep.id_deposito
        where p.activo
      )
      select id_proveedor, count(*) as n, sum(objetivo - stock) as deficit
      from necesidad
      where stock < objetivo * 0.40
      group by id_proveedor
      having count(*) >= 3
      order by sum(objetivo - stock) desc
      limit 2
    loop
      select jsonb_agg(jsonb_build_object('id_producto', x.id_producto, 'cantidad', x.cantidad, 'precio_estimado', x.precio))
        into v_detalle
      from (
        select p.id_producto,
               ceil((n.objetivo - n.stock) / 6.0) * 6 as cantidad,
               round(p.costo_producto * v_precio * (0.98 + random()::numeric * 0.04), 2) as precio
        from (
          select p.id_producto, coalesce(s.cantidad, 0) as stock,
                 round(case when p.costo_producto > 4000 then 12 else 14 end * v_f
                       * demo_seed._peso_categoria(least(v_mes + 1, 10), c.nombre_categoria)) as objetivo
          from public.producto p
          join demo_seed.proveedor_marca pm on pm.id_marca = p.id_marca and pm.id_proveedor = v_prov.id_proveedor
          left join public.categoria c on c.id_categoria = p.id_categoria
          left join public.stock s on s.id_producto = p.id_producto and s.id_deposito = v_dep.id_deposito
          where p.activo
        ) n
        join public.producto p on p.id_producto = n.id_producto
        where n.stock < n.objetivo * 0.40
        order by n.objetivo - n.stock desc
        limit 28
      ) x;

      continue when v_detalle is null;

      v_oc := public.fn_orden_compra_registrar(
        v_prov.id_proveedor, p_fecha, 'Reposicion ' || v_dep.nombre_deposito, v_detalle, demo_seed._p('compras'));
      perform demo_seed._reg('orden_compra', v_oc.id_orden_compra, demo_seed._ts(p_fecha, 8.5, 11));

      if random()::numeric < 0.04 then
        perform demo_seed._pendiente('cancelar_oc', p_fecha + 1, v_oc.id_orden_compra);
      else
        perform demo_seed._pendiente('facturar', p_fecha + 1 + floor(random()::numeric * 4)::int, v_oc.id_orden_compra,
                                     jsonb_build_object('id_deposito', v_dep.id_deposito));
      end if;
    end loop;
  end loop;
end;
$$;

-- Factura del proveedor + recepción de la mercadería (lote) + plan de pago
create or replace function demo_seed._recepciones(p_fecha date)
returns void language plpgsql as $$
declare
  r          record;
  v_oc       public.orden_compra;
  v_perfil   demo_seed.proveedor_perfil;
  v_detalle  jsonb;
  v_fc       public.comprobante_proveedor;
  v_numero   int;
  v_lote     record;
  v_productos jsonb;
  v_parcial  boolean;
  v_faltante boolean;
  v_ts       timestamptz;
  m          jsonb;
begin
  for r in
    select p.id, p.tipo, p.ref, p.extra from demo_seed.pendiente p
    where p.tipo in ('facturar', 'cancelar_oc') and not p.hecho and p.fecha <= p_fecha
    order by p.id
  loop
    select * into v_oc from public.orden_compra where id_orden_compra = r.ref;

    if r.tipo = 'cancelar_oc' then
      perform demo_seed._como(demo_seed._p('compras'));
      perform public.fn_orden_compra_cancelar(r.ref);
      update demo_seed.pendiente set hecho = true where id = r.id;
      continue;
    end if;

    select * into v_perfil from demo_seed.proveedor_perfil where id_proveedor = v_oc.id_proveedor;

    -- A veces el proveedor factura de menos un renglón (faltante)
    v_faltante := random()::numeric < 0.10;
    select jsonb_agg(jsonb_build_object(
             'id_producto', x.id_producto,
             'cantidad', case when v_faltante and x.n = 1 and x.cantidad_solicitada > 6 then x.cantidad_solicitada - 6
                              else x.cantidad_solicitada end,
             'precio_unitario', round(x.precio * (0.985 + random()::numeric * 0.03), 2),
             'descuento', 0, 'impuesto', 0))
      into v_detalle
    from (
      select d.id_producto, d.cantidad_solicitada, coalesce(d.precio_estimado, p.costo_producto) as precio,
             row_number() over (order by random()::numeric) as n
      from public.orden_compra_detalle d
      join public.producto p on p.id_producto = d.id_producto
      where d.id_orden_compra = r.ref
    ) x;

    perform demo_seed._como(demo_seed._p('compras'));
    v_numero := demo_seed._numero_proveedor(v_oc.id_proveedor, demo_seed._p('fa'), v_perfil.punto_venta);
    v_fc := public.fn_comprobante_registrar(
      v_oc.id_proveedor, demo_seed._p('fa'), v_perfil.punto_venta, v_numero,
      p_fecha, p_fecha + v_perfil.plazo_pago, null, v_detalle, demo_seed._p('compras'), r.ref);
    v_ts := demo_seed._ts(p_fecha, 9, 12);
    perform demo_seed._reg('comprobante_proveedor', v_fc.id_comprobante, v_ts);

    -- Recepción: casi siempre completa; a veces llega de menos un renglón
    v_parcial := random()::numeric < 0.08;
    select jsonb_agg(jsonb_build_object(
             'id_producto', x.id_producto,
             'cantidad', case when v_parcial and x.n = 1 then greatest(x.cantidad - ceil(x.cantidad / 3), 1) else x.cantidad end,
             'fecha_elaboracion', x.elab,
             'fecha_vencimiento', x.elab + (150 + floor(random()::numeric * 270))::int,
             'observaciones', case when v_parcial and x.n = 1 then 'Faltante en la entrega, el proveedor completa en el proximo envio' end))
      into v_productos
    from (
      select d.id_producto, d.cantidad, row_number() over (order by random()::numeric) as n,
             p_fecha - (8 + floor(random()::numeric * 50))::int as elab
      from public.comprobante_proveedor_detalle d
      where d.id_comprobante = v_fc.id_comprobante and d.id_producto is not null
    ) x;

    perform demo_seed._como(demo_seed._p('deposito'));
    select * into v_lote
    from public.fn_lote_registrar_desde_comprobante(
      v_fc.id_comprobante, (r.extra->>'id_deposito')::uuid,
      'Recepcion FC A ' || lpad(v_perfil.punto_venta::text, 4, '0') || '-' || lpad(v_numero::text, 8, '0')
        || ' / OC-' || lpad(v_oc.numero::text, 6, '0'),
      demo_seed._p('deposito'), v_productos);

    v_ts := demo_seed._ts(p_fecha, 12.5, 17);
    perform demo_seed._reg('inventario', v_lote.lote_id, v_ts);
    for m in select * from jsonb_array_elements(v_lote.movimientos) loop
      perform demo_seed._reg('movimiento_stock', (m->>'id_movimiento')::uuid, v_ts);
    end loop;

    perform demo_seed._pendiente('pagar', p_fecha + v_perfil.plazo_pago - 6 + floor(random()::numeric * 12)::int,
                                 v_fc.id_comprobante, jsonb_build_object('id_proveedor', v_oc.id_proveedor));
    update demo_seed.pendiente set hecho = true where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Pagos a proveedores (los viernes): orden de pago + pago
-- ---------------------------------------------------------------------
create or replace function demo_seed._pagos(p_fecha date)
returns void language plpgsql as $$
declare
  v_prov    record;
  v_imput   jsonb;
  v_total   numeric;
  v_medios  jsonb;
  v_aplic   jsonb;
  v_op      public.orden_pago;
  v_pago    public.pago;
  v_ts      timestamptz;
  v_parcial boolean;
  v_solo_op boolean;
  v_cuenta  uuid;
  v_saldo   numeric;
  v_medio   uuid;
  v_cheque  jsonb;
  v_ref     text;
  r         record;
begin
  perform demo_seed._como(demo_seed._p('gerente'));

  -- Saldos de órdenes que quedaron pagadas en parte
  for r in
    select p.id, p.ref from demo_seed.pendiente p
    where p.tipo = 'pagar_resto' and not p.hecho and p.fecha <= p_fecha
  loop
    select jsonb_agg(jsonb_build_object('id_comprobante', opc.id_comprobante, 'importe_aplicado', c.saldo_pendiente)),
           sum(c.saldo_pendiente)
      into v_aplic, v_total
    from public.orden_pago_comprobante opc
    join public.comprobante_proveedor c on c.id_comprobante = opc.id_comprobante
    where opc.id_orden_pago = r.ref and c.saldo_pendiente > 0;

    if v_total > 0 then
      select id_cuenta, saldo_actual into v_cuenta, v_saldo
      from public.cuenta_tesoreria
      where id_cuenta in (demo_seed._p('banco_galicia'), demo_seed._p('banco_macro'))
      order by saldo_actual desc limit 1;
      continue when v_saldo < v_total;

      v_medios := jsonb_build_array(jsonb_build_object(
        'id_medio_pago', demo_seed._p('transferencia'), 'id_cuenta_tesoreria', v_cuenta,
        'importe', v_total, 'referencia', demo_seed._referencia('OP', p_fecha)));
      v_pago := public.fn_pago_registrar(r.ref, p_fecha, v_medios, v_aplic, true, demo_seed._p('gerente'));
      v_ts := demo_seed._ts(p_fecha, 10, 16);
      perform demo_seed._reg('pago', v_pago.id_pago, v_ts);
      perform demo_seed._reg('movimiento_tesoreria', m.id_movimiento, v_ts)
      from public.movimiento_tesoreria m where m.id_pago = v_pago.id_pago;
    end if;
    update demo_seed.pendiente set hecho = true where id = r.id;
  end loop;

  for v_prov in
    select distinct (p.extra->>'id_proveedor')::uuid as id_proveedor
    from demo_seed.pendiente p
    where p.tipo = 'pagar' and not p.hecho and p.fecha <= p_fecha
  loop
    select jsonb_agg(jsonb_build_object('id_comprobante', c.id_comprobante, 'importe_imputado', c.saldo_pendiente)
                     order by c.fecha_comprobante),
           sum(c.saldo_pendiente)
      into v_imput, v_total
    from demo_seed.pendiente p
    join public.comprobante_proveedor c on c.id_comprobante = p.ref
    where p.tipo = 'pagar' and not p.hecho and p.fecha <= p_fecha
      and (p.extra->>'id_proveedor')::uuid = v_prov.id_proveedor
      and not c.anulado and c.saldo_pendiente > 0 and c.estado in ('Pendiente', 'Pagado parcial');

    if coalesce(v_total, 0) > 0 then
      -- Se paga desde la cuenta con más saldo: el Nación con cheque propio, las otras
      -- por transferencia. Si no alcanzan los fondos, el pago queda para otra semana.
      select id_cuenta, saldo_actual into v_cuenta, v_saldo
      from public.cuenta_tesoreria
      where id_cuenta in (demo_seed._p('banco_galicia'), demo_seed._p('banco_macro'), demo_seed._p('banco_nacion'))
      order by saldo_actual desc limit 1;
      continue when v_saldo < v_total;

      if v_cuenta = demo_seed._p('banco_nacion') then
        v_medio := demo_seed._p('cheque_propio');
        v_ref := lpad((31200000 + (select count(*) from public.cheque) + 1)::text, 8, '0');
        v_cheque := jsonb_build_object('numero', v_ref, 'banco', 'Banco de la Nacion Argentina',
                                       'cuenta', 'CC 4410-028871/5', 'fecha_emision', p_fecha,
                                       'fecha_pago', p_fecha + 30);
      else
        v_medio := demo_seed._p('transferencia');
        v_ref := demo_seed._referencia('OP', p_fecha);
        v_cheque := null;
      end if;

      v_solo_op := p_fecha >= date '2026-10-15' and random()::numeric < 0.35;
      v_parcial := not v_solo_op and jsonb_array_length(v_imput) = 1 and random()::numeric < 0.10;

      v_medios := jsonb_build_array(jsonb_build_object(
        'id_medio_pago', v_medio, 'id_cuenta_tesoreria', v_cuenta, 'importe', v_total, 'referencia', v_ref));

      v_op := public.fn_orden_pago_crear(
        v_prov.id_proveedor, p_fecha + case when v_solo_op then 7 else 0 end, v_ref,
        case when v_solo_op then 'Programada para la semana proxima' end,
        v_imput, v_medios, true, demo_seed._p('gerente'));
      v_ts := demo_seed._ts(p_fecha, 9, 11.5);
      perform demo_seed._reg('orden_pago', v_op.id_orden_pago, v_ts);

      if not v_solo_op then
        if v_parcial then
          v_total := round(v_total / 2, 2);
          v_aplic := jsonb_build_array(jsonb_build_object(
            'id_comprobante', v_imput->0->>'id_comprobante', 'importe_aplicado', v_total));
          perform demo_seed._pendiente('pagar_resto', p_fecha + 14, v_op.id_orden_pago);
        else
          select jsonb_agg(jsonb_build_object('id_comprobante', e->>'id_comprobante', 'importe_aplicado', e->'importe_imputado'))
            into v_aplic from jsonb_array_elements(v_imput) e;
        end if;

        v_medios := jsonb_build_array(jsonb_build_object(
          'id_medio_pago', v_medio, 'id_cuenta_tesoreria', v_cuenta, 'importe', v_total, 'referencia', v_ref,
          'cheque', case when v_cheque is not null then v_cheque || jsonb_build_object('importe', v_total) end));

        v_pago := public.fn_pago_registrar(v_op.id_orden_pago, p_fecha, v_medios, v_aplic, v_parcial, demo_seed._p('gerente'));
        v_ts := v_ts + interval '2 hours';
        perform demo_seed._reg('pago', v_pago.id_pago, v_ts);
        perform demo_seed._reg('movimiento_tesoreria', m.id_movimiento, v_ts)
        from public.movimiento_tesoreria m where m.id_pago = v_pago.id_pago;
        perform demo_seed._reg('cheque', ch.id_cheque, v_ts)
        from public.cheque ch join public.pago_medio pm on pm.id = ch.id_pago_medio
        where pm.id_pago = v_pago.id_pago;
      end if;
    end if;

    update demo_seed.pendiente p set hecho = true
    where p.tipo = 'pagar' and not p.hecho and p.fecha <= p_fecha
      and (p.extra->>'id_proveedor')::uuid = v_prov.id_proveedor;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Eventos ocasionales: notas de crédito/débito, transferencias, mermas
-- ---------------------------------------------------------------------
create or replace function demo_seed._eventos(p_fecha date)
returns void language plpgsql as $$
declare
  v_fc      record;
  v_linea   record;
  v_nc      public.comprobante_proveedor;
  v_numero  int;
  v_pv      int;
  v_importe numeric;
  v_mov     public.movimiento_stock;
  v_tr      record;
  v_ts      timestamptz;
  v_dep     uuid;
  r         record;
begin
  -- Nota de crédito (≈ 2 por mes)
  if random()::numeric < 0.085 then
    select c.*, i.id_deposito
      into v_fc
    from public.comprobante_proveedor c
    join demo_seed.registro g on g.tabla = 'comprobante_proveedor' and g.id = c.id_comprobante
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante and tc.clase = 'factura'
    join public.inventario i on i.id_comprobante = c.id_comprobante
    where c.fecha_comprobante between p_fecha - 15 and p_fecha - 2
      and not c.anulado and c.estado = 'Pendiente'
      and not exists (select 1 from public.nota_credito_proveedor n where n.id_comprobante_asociado = c.id_comprobante)
    order by random()::numeric limit 1;

    if v_fc.id_comprobante is not null then
      select punto_venta into v_pv from demo_seed.proveedor_perfil where id_proveedor = v_fc.id_proveedor;
      v_numero := demo_seed._numero_proveedor(v_fc.id_proveedor, demo_seed._p('nca'), v_pv);
      perform demo_seed._como(demo_seed._p('compras'));

      select d.id_detalle, d.id_producto, d.cantidad, d.precio_unitario, s.cantidad as stock
        into v_linea
      from public.comprobante_proveedor_detalle d
      join public.stock s on s.id_producto = d.id_producto and s.id_deposito = v_fc.id_deposito
      where d.id_comprobante = v_fc.id_comprobante and d.id_producto is not null and s.cantidad >= 4
      order by random()::numeric limit 1;

      if random()::numeric < 0.35 and v_linea.id_detalle is not null then
        -- Devolución de mercadería dañada: nota de crédito + salida de stock
        v_importe := least(v_linea.cantidad, v_linea.stock, 2 + floor(random()::numeric * 4));
        v_nc := public.fn_nota_credito_registrar(
          v_fc.id_proveedor, demo_seed._p('nca'), v_pv, v_numero, p_fecha, v_fc.id_comprobante,
          'devolucion_mercaderia', 'Mercaderia con envase dañado',
          jsonb_build_array(jsonb_build_object(
            'id_producto', v_linea.id_producto, 'id_detalle_origen', v_linea.id_detalle,
            'concepto', 'Devolucion por mercaderia dañada', 'cantidad', v_importe,
            'precio_unitario', v_linea.precio_unitario,
            'importe', round(v_importe * v_linea.precio_unitario, 2), 'impuesto', 0)),
          demo_seed._p('compras'));
        v_ts := demo_seed._ts(p_fecha, 10, 16);
        perform demo_seed._reg('comprobante_proveedor', v_nc.id_comprobante, v_ts);

        perform demo_seed._como(demo_seed._p('deposito'));
        v_mov := public.fn_movimiento_stock_registrar(
          demo_seed._p('tm_devolucion'), v_linea.id_producto, v_fc.id_deposito, v_importe,
          demo_seed._p('deposito'), p_fecha,
          'NC A ' || lpad(v_pv::text, 4, '0') || '-' || lpad(v_numero::text, 8, '0'), null);
        perform demo_seed._reg('movimiento_stock', v_mov.id_movimiento, v_ts + interval '20 minutes');
      else
        v_importe := round(v_fc.importe_total * (0.02 + random()::numeric * 0.04), 2);
        v_nc := public.fn_nota_credito_registrar(
          v_fc.id_proveedor, demo_seed._p('nca'), v_pv, v_numero, p_fecha, v_fc.id_comprobante,
          case when random()::numeric < 0.7 then 'bonificacion' else 'error_facturacion' end, null,
          jsonb_build_array(jsonb_build_object(
            'concepto', case when random()::numeric < 0.7 then 'Bonificacion comercial por volumen' else 'Diferencia de precio facturado' end,
            'importe', v_importe, 'impuesto', 0)),
          demo_seed._p('compras'));
        perform demo_seed._reg('comprobante_proveedor', v_nc.id_comprobante, demo_seed._ts(p_fecha, 10, 16));
      end if;
    end if;
  end if;

  -- Nota de débito (≈ 1 por mes): flete o intereses
  if random()::numeric < 0.045 then
    select c.* into v_fc
    from public.comprobante_proveedor c
    join demo_seed.registro g on g.tabla = 'comprobante_proveedor' and g.id = c.id_comprobante
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante and tc.clase = 'factura'
    where c.fecha_comprobante between p_fecha - 25 and p_fecha - 3 and not c.anulado
    order by random()::numeric limit 1;

    if v_fc.id_comprobante is not null then
      select punto_venta into v_pv from demo_seed.proveedor_perfil where id_proveedor = v_fc.id_proveedor;
      v_numero := demo_seed._numero_proveedor(v_fc.id_proveedor, demo_seed._p('nda'), v_pv);
      perform demo_seed._como(demo_seed._p('compras'));
      if random()::numeric < 0.7 then
        v_nc := public.fn_nota_debito_registrar(
          v_fc.id_proveedor, demo_seed._p('nda'), v_pv, v_numero, p_fecha, v_fc.id_comprobante, 'flete', null,
          jsonb_build_array(jsonb_build_object('concepto', 'Flete y acarreo de mercaderia',
                                               'importe', round(6000 + random()::numeric * 22000, -2), 'impuesto', 0)),
          demo_seed._p('compras'));
      else
        v_nc := public.fn_nota_debito_registrar(
          v_fc.id_proveedor, demo_seed._p('nda'), v_pv, v_numero, p_fecha, v_fc.id_comprobante, 'interes_mora', null,
          jsonb_build_array(jsonb_build_object('concepto', 'Intereses por pago fuera de termino',
                                               'importe', round(v_fc.importe_total * 0.015, 2), 'impuesto', 0)),
          demo_seed._p('compras'));
      end if;
      perform demo_seed._reg('comprobante_proveedor', v_nc.id_comprobante, demo_seed._ts(p_fecha, 10, 16));
      perform demo_seed._pendiente('pagar', p_fecha + 15, v_nc.id_comprobante,
                                   jsonb_build_object('id_proveedor', v_fc.id_proveedor));
    end if;
  end if;

  -- Transferencia entre depósitos (≈ 3 por mes)
  if random()::numeric < 0.13 then
    select s1.id_producto, s1.id_deposito as origen, s2.id_deposito as destino,
           least(s1.cantidad - 12, 6 + floor(random()::numeric * 3) * 6) as cantidad
      into v_tr
    from public.stock s1
    join public.stock s2 on s2.id_producto = s1.id_producto and s2.id_deposito <> s1.id_deposito
    join public.deposito d1 on d1.id_deposito = s1.id_deposito and d1.activo
    join public.deposito d2 on d2.id_deposito = s2.id_deposito and d2.activo and not d2.esta_lleno
    where s1.cantidad >= 30 and s2.cantidad <= 6
    order by random()::numeric limit 1;

    if v_tr.id_producto is not null and v_tr.cantidad > 0 then
      perform demo_seed._como(demo_seed._p('deposito'));
      select * into r from public.fn_movimiento_stock_transferir(
        v_tr.id_producto, v_tr.origen, v_tr.destino, v_tr.cantidad, demo_seed._p('deposito'), p_fecha,
        'TR-' || to_char(p_fecha, 'YYYYMMDD') || '-' || lpad((floor(random()::numeric * 900) + 100)::int::text, 3, '0'));
      v_ts := demo_seed._ts(p_fecha, 11, 17);
      perform demo_seed._reg('movimiento_stock', (r.movimiento_salida).id_movimiento, v_ts);
      perform demo_seed._reg('movimiento_stock', (r.movimiento_entrada).id_movimiento, v_ts);
    end if;
  end if;

  -- Merma por rotura o vencimiento (≈ 2 por mes)
  if random()::numeric < 0.085 then
    select s.id_producto, s.id_deposito, s.cantidad into v_tr
    from public.stock s join public.deposito d on d.id_deposito = s.id_deposito and d.activo
    where s.cantidad >= 5 order by random()::numeric limit 1;
    if v_tr.id_producto is not null then
      perform demo_seed._como(demo_seed._p('deposito'));
      v_mov := public.fn_movimiento_stock_registrar(
        demo_seed._p('tm_merma'), v_tr.id_producto, v_tr.id_deposito, 1 + floor(random()::numeric * 3),
        demo_seed._p('deposito'), p_fecha,
        'Acta de merma ' || to_char(p_fecha, 'YYYYMMDD'), null);
      perform demo_seed._reg('movimiento_stock', v_mov.id_movimiento, demo_seed._ts(p_fecha, 17, 18.5));
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Un turno de caja: el gerente levanta la caja, la empleada vende al
-- mostrador, hace el arqueo y pide el cierre, el gerente cierra.
-- Las ventas de caja se registran con la fecha del día (regla VTA04) y
-- después se re-fechan al día simulado; por eso solo se simulan días con
-- la lista minorista actual vigente (desde el 08/10).
-- ---------------------------------------------------------------------
create or replace function demo_seed._caja_dia(p_fecha date)
returns void language plpgsql as $$
declare
  v_reg     public.caja_registradora;
  v_sesion  public.sesion_caja;
  v_empleada uuid := demo_seed._p('ventas');
  v_gerente uuid := demo_seed._p('gerente');
  v_lista   uuid;
  v_n       int;
  v_detalle jsonb;
  v_total   numeric;
  v_medios  jsonb;
  v_venta   public.comprobante_venta;
  v_cli     uuid;
  v_tipo    public.tipo_venta;
  v_mc      public.movimiento_caja;
  v_arqueo  public.arqueo_caja;
  v_ts      timestamptz;
  v_apertura timestamptz;
  v_resumen jsonb;
  v_teorico numeric;
  v_fisico  numeric;
  v_resto   numeric;
  v_billetes jsonb := '[]'::jsonb;
  v_den     numeric;
  v_x       numeric;
  v_parte   numeric;
  i         int;
begin
  select id_lista_precio into v_lista from public.fn_lista_precio_vigente('Minorista', current_date);
  if v_lista is null or v_lista <> (select id_lista_precio from public.fn_lista_precio_vigente('Minorista', p_fecha)) then
    return;
  end if;

  select r.* into v_reg
  from public.caja_registradora r
  join public.deposito d on d.id_deposito = r.id_deposito and d.activo
  where r.activa
  order by r.creado
  offset (p_fecha - date '2026-10-01') % greatest((select count(*) from public.caja_registradora where activa), 1)
  limit 1;
  if v_reg.id_registradora is null then
    return;
  end if;

  v_apertura := (p_fecha + time '08:45')::timestamp at time zone 'America/Argentina/Buenos_Aires';

  perform demo_seed._como(v_gerente);
  v_sesion := public.fn_sesion_caja_levantar(v_reg.id_registradora, v_empleada, 20000, 'Fondo fijo del turno');
  perform demo_seed._reg('caja_apertura', v_sesion.id_caja, v_apertura);
  perform demo_seed._reg('sesion_caja', v_sesion.id_sesion, v_apertura);

  perform demo_seed._como(v_empleada);
  v_n := 16 + floor(random()::numeric * 18)::int + case when extract(isodow from p_fecha) = 6 then 8 else 0 end;
  v_ts := v_apertura + interval '20 minutes';

  for i in 1 .. v_n loop
    v_ts := v_ts + make_interval(secs => (600 + random()::numeric * 1100)::int);

    select jsonb_agg(jsonb_build_object('id_producto', x.id_producto, 'id_deposito', v_reg.id_deposito, 'cantidad', x.cantidad)),
           sum(x.cantidad * x.precio)
      into v_detalle, v_total
    from (
      select s.id_producto, lpd.precio,
             least(s.cantidad, 1 + floor(random()::numeric * case when c.nombre_categoria = 'Gaseosas' then 4 else 3 end)) as cantidad
      from public.stock s
      join public.producto p on p.id_producto = s.id_producto and p.activo
      left join public.categoria c on c.id_categoria = p.id_categoria
      join public.lista_precio_detalle lpd on lpd.id_lista_precio = v_lista and lpd.id_producto = s.id_producto
      where s.id_deposito = v_reg.id_deposito and s.cantidad >= 1
      order by random()::numeric
      limit 1 + floor(random()::numeric * 4)::int
    ) x;
    continue when v_detalle is null;

    if random()::numeric < 0.15 then
      v_tipo := 'Minorista';
      select c.id_cliente into v_cli
      from public.cliente c join public.tipo_cliente tc on tc.id_tipo_cliente = c.id_tipo_cliente
      where c.activo and not c.es_consumidor_final and tc.lista_precio = 'Minorista' and c.id_usuario is null
      order by random()::numeric limit 1;
      if v_cli is null then
        v_tipo := 'Consumidor final';
      end if;
    else
      v_tipo := 'Consumidor final';
      v_cli := null;
    end if;

    v_x := random()::numeric;
    if v_x < 0.42 then
      v_medios := jsonb_build_array(jsonb_build_object('id_medio_pago', demo_seed._p('efectivo'), 'importe', v_total));
    elsif v_x < 0.62 then
      v_medios := jsonb_build_array(jsonb_build_object('id_medio_pago', demo_seed._p('mercado_pago'), 'importe', v_total));
    elsif v_x < 0.82 then
      v_medios := jsonb_build_array(jsonb_build_object('id_medio_pago', demo_seed._p('debito'), 'importe', v_total,
                                                       'referencia', 'POS ' || lpad((floor(random()::numeric * 999999))::int::text, 6, '0')));
    elsif v_x < 0.92 then
      v_medios := jsonb_build_array(jsonb_build_object('id_medio_pago', demo_seed._p('credito'), 'importe', v_total,
                                                       'referencia', 'POS ' || lpad((floor(random()::numeric * 999999))::int::text, 6, '0')));
    elsif v_x < 0.96 or v_total < 2000 then
      v_medios := jsonb_build_array(jsonb_build_object('id_medio_pago', demo_seed._p('transferencia'), 'importe', v_total,
                                                       'id_cuenta_tesoreria', demo_seed._p('banco_macro'),
                                                       'referencia', demo_seed._referencia('TRF', p_fecha)));
    else
      v_parte := round(v_total / 2, -1);
      v_medios := jsonb_build_array(
        jsonb_build_object('id_medio_pago', demo_seed._p('efectivo'), 'importe', v_parte),
        jsonb_build_object('id_medio_pago', demo_seed._p('mercado_pago'), 'importe', v_total - v_parte));
    end if;

    v_venta := public.fn_venta_registrar(
      v_cli, demo_seed._p('fb'), current_date, null, v_detalle, 0, v_empleada, v_tipo, v_medios, v_sesion.id_caja);
    perform demo_seed._reg('comprobante_venta', v_venta.id_comprobante, v_ts);
    perform demo_seed._reg('movimiento_stock', d.id_movimiento, v_ts)
    from public.comprobante_venta_detalle d where d.id_comprobante = v_venta.id_comprobante;
    perform demo_seed._reg('movimiento_tesoreria', mt.id_movimiento, v_ts)
    from public.movimiento_tesoreria mt
    join public.movimiento_caja mc on mc.id_movimiento_caja = mt.id_movimiento_caja
    where mc.id_comprobante = v_venta.id_comprobante;

    -- Algún gasto menor en efectivo a media tarde
    if i = v_n / 2 and random()::numeric < 0.35 then
      v_resumen := public.fn_caja_resumen(v_sesion.id_caja);
      if (v_resumen->'efectivo'->>'saldo_teorico')::numeric > 12000 then
        v_mc := public.fn_caja_movimiento_registrar(
          v_sesion.id_caja, 'Egreso', demo_seed._p('efectivo'), round(2500 + random()::numeric * 6000, -2),
          case when random()::numeric < 0.5 then 'Compra de bolsas y articulos de limpieza' else 'Pago de cadete' end,
          null, v_empleada);
        perform demo_seed._reg('movimiento_caja', v_mc.id_movimiento_caja, v_ts + interval '3 minutes');
      end if;
    end if;
  end loop;

  -- Fechar los movimientos de caja antes del arqueo (el cierre exige arqueo posterior)
  perform demo_seed._triggers('movimiento_caja', false);
  update public.movimiento_caja mc set creado = g.ts
  from demo_seed.registro g
  where g.tabla = 'comprobante_venta' and g.id = mc.id_comprobante and mc.id_caja = v_sesion.id_caja;
  update public.movimiento_caja mc set creado = g.ts
  from demo_seed.registro g
  where g.tabla = 'movimiento_caja' and g.id = mc.id_movimiento_caja and mc.id_caja = v_sesion.id_caja;
  perform demo_seed._triggers('movimiento_caja', true);

  -- Arqueo: se cuenta el efectivo; a veces falta o sobra algo de cambio
  v_resumen := public.fn_caja_resumen(v_sesion.id_caja);
  v_teorico := (v_resumen->'efectivo'->>'saldo_teorico')::numeric;
  v_fisico := floor(v_teorico / 10) * 10
              + case when random()::numeric < 0.2 then (floor(random()::numeric * 5) - 2) * 50 else 0 end;
  v_fisico := greatest(v_fisico, 0);
  v_resto := v_fisico;
  foreach v_den in array array[20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10]::numeric[] loop
    if floor(v_resto / v_den) > 0 then
      v_billetes := v_billetes || jsonb_build_array(jsonb_build_object('denominacion', v_den, 'cantidad', floor(v_resto / v_den)));
      v_resto := v_resto - floor(v_resto / v_den) * v_den;
    end if;
  end loop;

  v_ts := greatest(v_ts + interval '15 minutes',
                   (p_fecha + time '20:05')::timestamp at time zone 'America/Argentina/Buenos_Aires');
  v_arqueo := public.fn_caja_arqueo_realizar(
    v_sesion.id_caja, v_fisico,
    case when v_fisico <> v_teorico then 'Diferencia de cambio en el conteo' end,
    v_empleada, v_billetes);
  perform demo_seed._reg('arqueo_caja', v_arqueo.id_arqueo, v_ts);

  perform public.fn_sesion_caja_solicitar_cierre(v_sesion.id_sesion, 'Fin del turno');
  perform demo_seed._reg('sesion_cierre_pedido', v_sesion.id_sesion, v_ts + interval '5 minutes');

  perform demo_seed._como(v_gerente);
  perform public.fn_sesion_caja_cerrar(v_sesion.id_sesion, 'Cierre revisado');
  perform demo_seed._reg('caja_cierre', v_sesion.id_caja, v_ts + interval '25 minutes');
end;
$$;

-- ---------------------------------------------------------------------
-- Re-fechado: lleva las marcas de auditoría a la fecha simulada.
-- Los triggers de usuario de cada tabla se apagan solo durante el UPDATE
-- (protegen creado/editado y la inmutabilidad de caja), y se vuelven a
-- encender en la misma transacción.
-- ---------------------------------------------------------------------
create or replace function demo_seed._refechar()
returns void language plpgsql as $$
declare
  v_tablas text[] := array['comprobante_venta', 'cobro', 'comprobante_proveedor', 'orden_pago', 'pago',
                           'inventario', 'inventario_producto', 'caja', 'arqueo_caja', 'movimiento_caja',
                           'lista_precio', 'cliente', 'tipo_movimiento'];
  t text;
begin
  foreach t in array v_tablas loop
    perform demo_seed._triggers(t, false);
  end loop;

  update public.comprobante_venta v set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'comprobante_venta' and g.id = v.id_comprobante and not g.aplicado;
  update public.comprobante_venta v set fecha_comprobante = demo_seed._local(g.ts)
  from demo_seed.registro g
  where g.tabla = 'comprobante_venta' and g.id = v.id_comprobante and not g.aplicado and v.id_caja is not null;
  update public.comprobante_venta v set fecha_despacho = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'despacho' and g.id = v.id_comprobante and not g.aplicado;
  update public.comprobante_venta v set editado = g.ts
  from demo_seed.registro g where g.tabla = 'venta_editada' and g.id = v.id_comprobante and not g.aplicado;

  update public.cobro c set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'cobro' and g.id = c.id_cobro and not g.aplicado;

  update public.movimiento_tesoreria m set creado = g.ts, fecha = demo_seed._local(g.ts)
  from demo_seed.registro g where g.tabla = 'movimiento_tesoreria' and g.id = m.id_movimiento and not g.aplicado;

  update public.movimiento_stock m set creado = g.ts, fecha_movimiento = demo_seed._local(g.ts)
  from demo_seed.registro g where g.tabla = 'movimiento_stock' and g.id = m.id_movimiento and not g.aplicado;

  update public.orden_compra o set creado = g.ts
  from demo_seed.registro g where g.tabla = 'orden_compra' and g.id = o.id_orden_compra and not g.aplicado;

  update public.comprobante_proveedor c set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'comprobante_proveedor' and g.id = c.id_comprobante and not g.aplicado;

  update public.inventario i set fecha_registro = g.ts
  from demo_seed.registro g where g.tabla = 'inventario' and g.id = i.id_lote and not g.aplicado;
  update public.inventario_producto ip set fecha_registro = g.ts
  from demo_seed.registro g where g.tabla = 'inventario' and g.id = ip.id_inventario and not g.aplicado;

  update public.orden_pago o set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'orden_pago' and g.id = o.id_orden_pago and not g.aplicado;
  update public.pago p set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'pago' and g.id = p.id_pago and not g.aplicado;
  update public.cheque c set creado = g.ts
  from demo_seed.registro g where g.tabla = 'cheque' and g.id = c.id_cheque and not g.aplicado;

  update public.caja c set fecha_apertura = g.ts
  from demo_seed.registro g where g.tabla = 'caja_apertura' and g.id = c.id_caja and not g.aplicado;
  update public.caja c set fecha_cierre = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'caja_cierre' and g.id = c.id_caja and not g.aplicado;
  update public.sesion_caja s set fecha_solicitud = g.ts, fecha_autorizacion = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'sesion_caja' and g.id = s.id_sesion and not g.aplicado;
  update public.sesion_caja s set fecha_solicitud_cierre = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'sesion_cierre_pedido' and g.id = s.id_sesion and not g.aplicado;
  update public.sesion_caja s set fecha_fin = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'caja_cierre' and g.id = s.id_caja and not g.aplicado;
  update public.arqueo_caja a set creado = g.ts
  from demo_seed.registro g where g.tabla = 'arqueo_caja' and g.id = a.id_arqueo and not g.aplicado;

  update public.lista_precio l set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'lista_precio' and g.id = l.id_lista_precio and not g.aplicado;
  update public.lista_precio_detalle l set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'lista_precio' and g.id = l.id_lista_precio and not g.aplicado;
  update public.cliente c set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'cliente' and g.id = c.id_cliente and not g.aplicado;
  update public.tipo_movimiento t set creado = g.ts, editado = g.ts
  from demo_seed.registro g where g.tabla = 'tipo_movimiento' and g.id = t.id_tipo_movimiento and not g.aplicado;

  update demo_seed.registro set aplicado = true where not aplicado;

  foreach t in array v_tablas loop
    perform demo_seed._triggers(t, true);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- cargar_mes(n): simula los días hábiles del mes n de 2026 (hasta ayer)
-- ---------------------------------------------------------------------
create or replace function demo_seed.cargar_mes(p_mes int)
returns text language plpgsql as $$
declare
  v_ini date := make_date(2026, p_mes, 1);
  v_fin date := least((make_date(2026, p_mes, 1) + interval '1 month - 1 day')::date, current_date - 1);
  d     date;
begin
  if not exists (select 1 from demo_seed.parametro) then
    raise exception 'Primero ejecutar demo_seed.preparar()';
  end if;
  if exists (select 1 from demo_seed.mes_cargado where mes = p_mes) then
    return format('El mes %s ya estaba cargado', p_mes);
  end if;
  if p_mes > 1 and not exists (select 1 from demo_seed.mes_cargado where mes = p_mes - 1) then
    raise exception 'Cargar los meses en orden: falta el mes %', p_mes - 1;
  end if;

  perform setseed(0.31 + p_mes / 100.0);

  d := v_ini;
  while d <= v_fin loop
    if demo_seed._es_habil(d) then
      perform demo_seed._recepciones(d);
      if extract(isodow from d) = 1 or (extract(isodow from d) = 2 and not demo_seed._es_habil(d - 1)) then
        perform demo_seed._reposicion(d);
      end if;
      perform demo_seed._ventas_mayoristas(d);
      perform demo_seed._despachos(d);
      perform demo_seed._cobros(d);
      if extract(isodow from d) = 5 then
        perform demo_seed._pagos(d);
      end if;
      perform demo_seed._eventos(d);
      if d >= date '2026-10-08' then
        perform demo_seed._caja_dia(d);
      end if;
    end if;
    d := d + 1;
  end loop;

  perform demo_seed._refechar();
  insert into demo_seed.mes_cargado (mes) values (p_mes);

  return format('Mes %s cargado: %s ventas, %s facturas de compra, %s cobros, %s pagos',
    p_mes,
    (select count(*) from public.comprobante_venta v join demo_seed.registro g on g.tabla = 'comprobante_venta' and g.id = v.id_comprobante
      where extract(month from v.fecha_comprobante) = p_mes),
    (select count(*) from public.comprobante_proveedor c join demo_seed.registro g on g.tabla = 'comprobante_proveedor' and g.id = c.id_comprobante
      where extract(month from c.fecha_comprobante) = p_mes),
    (select count(*) from public.cobro c join demo_seed.registro g on g.tabla = 'cobro' and g.id = c.id_cobro
      where extract(month from c.fecha_cobro) = p_mes),
    (select count(*) from public.pago p join demo_seed.registro g on g.tabla = 'pago' and g.id = p.id_pago
      where extract(month from p.fecha_pago) = p_mes));
end;
$$;

-- ---------------------------------------------------------------------
-- resumen(): dashboard mensual + chequeos de consistencia
-- ---------------------------------------------------------------------
create or replace function demo_seed.resumen()
returns table(concepto text, valor text) language sql stable as $$
  select 'Mes ' || to_char(mes, 'YYYY-MM'),
         'ingresos ' || to_char(ingresos, 'FM999G999G990') || ' | egresos ' || to_char(egresos, 'FM999G999G990')
         || ' | resultado ' || to_char(resultado, 'FM999G999G990')
  from public.fn_dashboard_mensual(date '2026-01-01', date '2026-10-31')
  union all select 'Stock negativo (filas)', count(*)::text from public.stock where cantidad < 0
  union all select 'Stock vs lotes con diferencias (producto x deposito)', count(*)::text from (
      select s.id_producto, s.id_deposito from public.stock s
      left join (select ip.id_producto, i.id_deposito, sum(ip.stock_disponible) q
                 from public.inventario_producto ip join public.inventario i on i.id_lote = ip.id_inventario
                 group by 1, 2) l using (id_producto, id_deposito)
      where coalesce(l.q, 0) > s.cantidad) x
  union all select 'Ventas sin movimiento de stock', count(*)::text from public.comprobante_venta_detalle where id_movimiento is null
  union all select 'Ventas pagadas con saldo', count(*)::text from public.comprobante_venta where estado = 'Pagado' and saldo_pendiente <> 0
  union all select 'Cobros que no suman la venta', count(*)::text from public.cobro c join public.comprobante_venta v using (id_comprobante)
      where c.importe_total <> v.importe_total
  union all select 'Facturas de compra con saldo negativo', count(*)::text from public.comprobante_proveedor where saldo_pendiente < 0
  union all select 'Cajas abiertas', count(*)::text from public.caja where estado = 'Abierta'
  union all select 'Cuenta ' || nombre_cuenta, to_char(saldo_actual, 'FM999G999G990D00') from public.cuenta_tesoreria
  union all select 'Filas creadas por la carga', count(*)::text from demo_seed.registro;
$$;
