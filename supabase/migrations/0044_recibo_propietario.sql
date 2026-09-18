-- Recibo de rendición al propietario (locador): lo que la inmobiliaria le cobra por la
-- gestión del alquiler. Se genera automáticamente junto con el recibo del inquilino al
-- registrar el pago, solo si el contrato tiene una comisión de gestión configurada.
-- Monto = comision_gestion% * (monto_pagado del período, sin contar cargos extra).

alter table contratos
  add column if not exists comision_gestion numeric;

create table if not exists recibos_numeracion_propietario (
  cliente_id uuid primary key references clientes_servicio(id) on delete cascade,
  ultimo_numero integer not null default 0
);

create table if not exists recibos_propietario (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes_servicio(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  pago_id uuid not null unique references pagos_contrato(id) on delete cascade,
  serie text not null default '0001',
  numero integer not null,
  fecha_pago date not null,
  monto numeric not null,
  monto_alquiler numeric not null,
  comision_pct numeric not null,
  propietario_nombre text,
  propietario_apellido text,
  direccion_inmueble text,
  cuota_numero integer,
  periodo_mes date,
  vencimiento_fecha date,
  created_at timestamptz not null default now(),
  unique (cliente_id, serie, numero)
);

alter table recibos_numeracion_propietario enable row level security;
alter table recibos_propietario enable row level security;

create policy "recibos_numeracion_propietario por cliente" on recibos_numeracion_propietario
  for all to authenticated
  using (cliente_id = current_cliente_id())
  with check (cliente_id = current_cliente_id());

create policy "recibos_propietario por cliente" on recibos_propietario
  for all to authenticated
  using (cliente_id = current_cliente_id())
  with check (cliente_id = current_cliente_id());

create or replace function crear_recibo_propietario(
  p_cliente_id uuid,
  p_contrato_id uuid,
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_monto_alquiler numeric,
  p_comision_pct numeric,
  p_propietario_nombre text default null,
  p_propietario_apellido text default null,
  p_direccion_inmueble text default null,
  p_cuota_numero integer default null,
  p_periodo_mes date default null,
  p_vencimiento_fecha date default null,
  p_serie text default '0001'
)
returns recibos_propietario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
  v_recibo recibos_propietario;
begin
  insert into recibos_numeracion_propietario (cliente_id, ultimo_numero)
  values (p_cliente_id, 1)
  on conflict (cliente_id) do update set ultimo_numero = recibos_numeracion_propietario.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  insert into recibos_propietario (
    cliente_id, contrato_id, pago_id, serie, numero, fecha_pago, monto,
    monto_alquiler, comision_pct, propietario_nombre, propietario_apellido,
    direccion_inmueble, cuota_numero, periodo_mes, vencimiento_fecha
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_monto_alquiler, p_comision_pct, p_propietario_nombre, p_propietario_apellido,
    p_direccion_inmueble, p_cuota_numero, p_periodo_mes, p_vencimiento_fecha
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

grant execute on function crear_recibo_propietario(
  uuid, uuid, uuid, date, numeric, numeric, numeric,
  text, text, text, integer, date, date, text
) to authenticated;
