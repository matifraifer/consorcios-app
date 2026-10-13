-- Recibo del propietario: incluye los cargos extra del período (recargos manuales,
-- depósito en garantía y actualización de depósito), que suman al neto rendido. NO incluye
-- el interés por mora (queda para la inmobiliaria) ni los descuentos (ya se guardan aparte
-- en recibos_propietario.descuentos y restan). La comisión de gestión sigue calculándose
-- solo sobre el alquiler.
--
-- recibos_propietario.cargos_extra: snapshot [{ "descripcion", "monto", "tipo" }] al crear
-- el recibo. null = recibo anterior a esta migración: el PDF toma los cargos del pago en
-- ese momento (sin mora ni descuentos).
-- Requiere 0050.

alter table recibos_propietario
  add column if not exists cargos_extra jsonb;

-- Se agrega un parámetro: hay que borrar la firma anterior, si no queda un overload.
drop function if exists crear_recibo_propietario(
  uuid, uuid, uuid, date, numeric, numeric, numeric,
  text, text, text, integer, date, date, text, jsonb
);

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
  p_serie text default '0001',
  p_descuentos jsonb default '[]'::jsonb,
  p_cargos_extra jsonb default '[]'::jsonb
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
    direccion_inmueble, cuota_numero, periodo_mes, vencimiento_fecha,
    file_firma, descuentos, cargos_extra
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_monto_alquiler, p_comision_pct, p_propietario_nombre, p_propietario_apellido,
    p_direccion_inmueble, p_cuota_numero, p_periodo_mes, p_vencimiento_fecha,
    (select firma_path from clientes_servicio where id = p_cliente_id),
    coalesce(p_descuentos, '[]'::jsonb),
    coalesce(p_cargos_extra, '[]'::jsonb)
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

grant execute on function crear_recibo_propietario(
  uuid, uuid, uuid, date, numeric, numeric, numeric,
  text, text, text, integer, date, date, text, jsonb, jsonb
) to authenticated;

-- ROLLBACK:
-- (re-crear crear_recibo_propietario desde 0050, borrando antes la versión con p_cargos_extra)
-- alter table recibos_propietario drop column if exists cargos_extra;
