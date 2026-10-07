-- Descuentos sobre un pago de alquiler (modal "Cargos Extra" → solapa "Descuentos").
--
-- - Se guardan en cargos_extra_contrato con tipo 'descuento' y monto NEGATIVO: así todos
--   los totales que ya suman cargos extra (detalle del contrato, diálogo de pago, portal,
--   recibo del inquilino) los restan sin cambios.
-- - La comisión de gestión del propietario NO cambia (se sigue calculando sobre el
--   alquiler completo); el descuento se informa en su recibo de rendición.
--   recibos_propietario.descuentos: snapshot [{ "descripcion": "...", "monto": 10000 }]
--   (monto en positivo) al momento de crear el recibo.
-- - La mora se sigue calculando sobre el alquiler completo (sin descontar).
-- Requiere 0046 y 0049.

alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_tipo_check;
alter table cargos_extra_contrato
  add constraint cargos_extra_contrato_tipo_check
  check (tipo in ('manual', 'mora', 'deposito', 'deposito_inicial', 'descuento'));

alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_descuento_negativo;
alter table cargos_extra_contrato
  add constraint cargos_extra_contrato_descuento_negativo
  check (tipo <> 'descuento' or monto < 0);

alter table recibos_propietario
  add column if not exists descuentos jsonb not null default '[]'::jsonb;

-- Se agrega un parámetro: hay que borrar la firma anterior, si no queda un overload.
drop function if exists crear_recibo_propietario(
  uuid, uuid, uuid, date, numeric, numeric, numeric,
  text, text, text, integer, date, date, text
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
  p_descuentos jsonb default '[]'::jsonb
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
    file_firma, descuentos
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_monto_alquiler, p_comision_pct, p_propietario_nombre, p_propietario_apellido,
    p_direccion_inmueble, p_cuota_numero, p_periodo_mes, p_vencimiento_fecha,
    (select firma_path from clientes_servicio where id = p_cliente_id),
    coalesce(p_descuentos, '[]'::jsonb)
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

grant execute on function crear_recibo_propietario(
  uuid, uuid, uuid, date, numeric, numeric, numeric,
  text, text, text, integer, date, date, text, jsonb
) to authenticated;

-- ROLLBACK:
-- (re-crear crear_recibo_propietario desde 0046, borrando antes la versión con p_descuentos)
-- alter table recibos_propietario drop column if exists descuentos;
-- alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_descuento_negativo;
-- alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_tipo_check;
-- alter table cargos_extra_contrato add constraint cargos_extra_contrato_tipo_check check (tipo in ('manual', 'mora', 'deposito', 'deposito_inicial'));
