-- Los recibos de pago deben quedar fijos con los datos que tenian en el momento del
-- pago, sin importar si despues se edita el contrato (nombre del inquilino, direccion
-- de la propiedad, dia de vencimiento, etc.). Se agregan las columnas de snapshot y se
-- actualiza crear_recibo_contrato para recibirlas y guardarlas junto con el recibo.

alter table recibos_contrato
  add column if not exists inquilino_nombre text,
  add column if not exists inquilino_apellido text,
  add column if not exists direccion_inmueble text,
  add column if not exists concepto text,
  add column if not exists cuota_numero integer,
  add column if not exists periodo_mes date,
  add column if not exists vencimiento_fecha date,
  add column if not exists es_compraventa boolean not null default false,
  add column if not exists cargos_extra jsonb not null default '[]'::jsonb;

drop function if exists crear_recibo_contrato(uuid, uuid, uuid, date, numeric, text);

create or replace function crear_recibo_contrato(
  p_cliente_id uuid,
  p_contrato_id uuid,
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_serie text default '0001',
  p_inquilino_nombre text default null,
  p_inquilino_apellido text default null,
  p_direccion_inmueble text default null,
  p_concepto text default null,
  p_cuota_numero integer default null,
  p_periodo_mes date default null,
  p_vencimiento_fecha date default null,
  p_es_compraventa boolean default false,
  p_cargos_extra jsonb default '[]'::jsonb
)
returns recibos_contrato
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
  v_recibo recibos_contrato;
begin
  insert into recibos_numeracion (cliente_id, ultimo_numero)
  values (p_cliente_id, 1)
  on conflict (cliente_id) do update set ultimo_numero = recibos_numeracion.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  insert into recibos_contrato (
    cliente_id, contrato_id, pago_id, serie, numero, fecha_pago, monto,
    inquilino_nombre, inquilino_apellido, direccion_inmueble, concepto,
    cuota_numero, periodo_mes, vencimiento_fecha, es_compraventa, cargos_extra
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_inquilino_nombre, p_inquilino_apellido, p_direccion_inmueble, p_concepto,
    p_cuota_numero, p_periodo_mes, p_vencimiento_fecha, p_es_compraventa, p_cargos_extra
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

grant execute on function crear_recibo_contrato(
  uuid, uuid, uuid, date, numeric, text,
  text, text, text, text, integer, date, date, boolean, jsonb
) to authenticated;
