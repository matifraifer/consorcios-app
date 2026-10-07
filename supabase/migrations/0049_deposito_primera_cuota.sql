-- La primera cuota de cada contrato incluye el depósito en garantía completo.
--
-- Mismo criterio que la mora y la actualización de depósito (0048): mientras la cuota 1
-- está pendiente el frontend lo muestra a partir de contratos.deposito, y al registrar el
-- pago registrar_pago_contrato lo guarda como cargo extra (tipo 'deposito_inicial'), así
-- queda en el recibo y toma el depósito vigente al momento del pago (si se editó antes).
-- Requiere 0048.

alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_tipo_check;
alter table cargos_extra_contrato
  add constraint cargos_extra_contrato_tipo_check
  check (tipo in ('manual', 'mora', 'deposito', 'deposito_inicial'));

create or replace function registrar_pago_contrato(
  p_pago_id uuid,
  p_monto_pagado numeric,
  p_fecha_pago date,
  p_comprobante_path text default null,
  p_monto_mora numeric default 0,
  p_dias_mora integer default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pago pagos_contrato%rowtype;
  v_deposito numeric;
begin
  select * into v_pago from pagos_contrato where id = p_pago_id for update;
  if not found then
    raise exception 'Pago no encontrado.';
  end if;
  if v_pago.estado = 'pagado' then
    raise exception 'Este período ya figura como pagado.';
  end if;

  perform aplicar_actualizaciones_contrato(v_pago.contrato_id, v_pago.periodo_numero);

  -- Depósito en garantía completo en la primera cuota (una sola vez)
  if v_pago.periodo_numero = 1
     and not exists (
       select 1 from cargos_extra_contrato
       where pago_id = p_pago_id and tipo = 'deposito_inicial'
     ) then
    select deposito into v_deposito from contratos where id = v_pago.contrato_id;
    if coalesce(v_deposito, 0) > 0 then
      insert into cargos_extra_contrato (pago_id, descripcion, monto, tipo)
      values (p_pago_id, 'Depósito en garantía', v_deposito, 'deposito_inicial');
    end if;
  end if;

  delete from cargos_extra_contrato where pago_id = p_pago_id and tipo = 'mora';
  if coalesce(p_monto_mora, 0) > 0 then
    insert into cargos_extra_contrato (pago_id, descripcion, monto, tipo)
    values (
      p_pago_id,
      'Interés por mora' || case when p_dias_mora is not null then ' (' || p_dias_mora || ' días)' else '' end,
      p_monto_mora,
      'mora'
    );
  end if;

  update pagos_contrato
  set estado = 'pagado',
      monto_pagado = p_monto_pagado,
      fecha_pago = p_fecha_pago,
      comprobante_path = p_comprobante_path
  where id = p_pago_id;
end;
$$;

-- ROLLBACK:
-- (re-crear registrar_pago_contrato desde 0048)
-- alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_tipo_check;
-- alter table cargos_extra_contrato add constraint cargos_extra_contrato_tipo_check check (tipo in ('manual', 'mora', 'deposito'));
