-- Reparación: depósito en garantía de la cuota 1 guardado como alquiler.
--
-- En producción quedó activa la versión de registrar_pago_contrato de 0048 (sin el
-- cargo 'deposito_inicial' de 0049). Los pagos de cuota 1 cobraron alquiler + depósito
-- pero sin el cargo, así que los recibos muestran todo como alquiler y la comisión de
-- gestión del recibo del propietario se calculó sobre alquiler + depósito.
--
-- Parte 1: re-crea la función de 0049 (solo la función: el check de tipos de 0049 NO se
-- vuelve a correr porque sacaría 'descuento', agregado en 0050).
-- Parte 2: para cada pago afectado agrega el cargo 'deposito_inicial' y corrige los
-- snapshots de recibos_contrato y recibos_propietario, conservando su número y
-- marcándolos como modificados. monto_pagado no cambia (ya incluye el depósito).
-- Solo toca pagos de cuota 1 pagados cuyo monto_pagado alcanza para alquiler + depósito,
-- sin cargo 'deposito_inicial' (se puede re-correr: los ya reparados se saltean).

-- ===================== Parte 1 =====================
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

-- ===================== Parte 2 =====================
do $$
declare
  r record;
  v_cargo jsonb;
begin
  -- Saltea el trigger de 0055 (cargos de períodos pagados), igual que 0057
  perform set_config('app.permitir_cargos_pagados', 'on', true);

  for r in
    select p.id as pago_id, c.deposito
    from pagos_contrato p
    join contratos c on c.id = p.contrato_id
    where p.periodo_numero = 1
      and p.estado = 'pagado'
      and coalesce(c.deposito, 0) > 0
      and not coalesce(c.deleted, false)
      and p.monto_pagado >= coalesce(p.monto_vigente, p.monto_base) + c.deposito
      and not exists (
        select 1 from cargos_extra_contrato x
        where x.pago_id = p.id and x.tipo = 'deposito_inicial'
      )
  loop
    insert into cargos_extra_contrato (pago_id, descripcion, monto, tipo)
    values (r.pago_id, 'Depósito en garantía', r.deposito, 'deposito_inicial');

    v_cargo := jsonb_build_object('descripcion', 'Depósito en garantía', 'monto', r.deposito, 'tipo', 'deposito_inicial');

    update recibos_contrato
    set cargos_extra = coalesce(cargos_extra, '[]'::jsonb) || jsonb_build_array(v_cargo),
        modificado_at = now()
    where pago_id = r.pago_id;

    update recibos_propietario
    set monto_alquiler = monto_alquiler - r.deposito,
        monto = round((monto_alquiler - r.deposito) * coalesce(comision_pct, 0) / 100, 2),
        cargos_extra = coalesce(cargos_extra, '[]'::jsonb) || jsonb_build_array(v_cargo),
        modificado_at = now()
    where pago_id = r.pago_id;

    raise notice 'Reparado pago %', r.pago_id;
  end loop;

  perform set_config('app.permitir_cargos_pagados', 'off', true);
end;
$$;

-- Verificación (debería devolver los pagos reparados con alquiler = monto_base)
-- select rp.pago_id, rp.monto_alquiler, rp.monto as comision, rp.cargos_extra, rc.monto, rc.cargos_extra
-- from recibos_propietario rp join recibos_contrato rc on rc.pago_id = rp.pago_id
-- where rp.cuota_numero = 1 and rp.modificado_at > now() - interval '1 hour';
