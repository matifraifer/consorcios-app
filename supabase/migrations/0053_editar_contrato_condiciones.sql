-- Edición de un contrato: los cambios en monto base, depósito, tipo/plazo de actualización
-- y fecha de inicio ahora impactan en los pagos ya generados (antes solo se guardaba el
-- dato del contrato y los pagos quedaban con el valor viejo).
--
-- Criterio: lo que ya se cobró o ya se actualizó por índice no se recalcula hacia atrás.
--   - monto_base: bloqueado si hay actualizaciones aplicadas. Si no, se actualiza
--     pagos_contrato.monto_base de TODOS los pagos (también los pagados, para que las
--     próximas actualizaciones se calculen sobre el monto correcto; lo cobrado y los
--     recibos no cambian porque guardan su propio snapshot).
--   - deposito: bloqueado si hay actualizaciones aplicadas o si la cuota 1 ya se cobró
--     (el depósito se cobra en la cuota 1).
--   - tipo/plazo de actualización: bloqueado si hay actualizaciones aplicadas (cambiar el
--     plazo haría que el próximo pago aplique hacia atrás actualizaciones de meses ya
--     cobrados). Si no, se recalcula es_periodo_actualizacion de todos los pagos.
--   - fecha_inicio: bloqueada si hay algún pago registrado. Si no, se borran los pagos (y
--     sus cargos extra) y se insertan los que arma el frontend (p_pagos_regenerados, misma
--     lógica que al crear el contrato).
-- SECURITY INVOKER: corre con los permisos del usuario (RLS por cliente_id).
-- Requiere 0048.

create or replace function editar_contrato_condiciones(
  p_contrato_id uuid,
  p_monto_base numeric,
  p_deposito numeric,
  p_tipo_actualizacion text,
  p_plazo_actualizacion text,
  p_fecha_inicio date,
  p_pagos_regenerados jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ct contratos%rowtype;
  v_pagados integer;
  v_con_actualizaciones boolean;
  v_cuota1_pagada boolean;
  v_plazo integer;
begin
  select * into v_ct from contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'Contrato no encontrado.';
  end if;

  select count(*) into v_pagados
    from pagos_contrato where contrato_id = p_contrato_id and estado = 'pagado';
  select exists(select 1 from actualizaciones_contrato where contrato_id = p_contrato_id)
    into v_con_actualizaciones;
  select exists(select 1 from pagos_contrato
                where contrato_id = p_contrato_id and periodo_numero = 1 and estado = 'pagado')
    into v_cuota1_pagada;

  -- ── Fecha de inicio: rearma todos los períodos ──
  if p_fecha_inicio is distinct from v_ct.fecha_inicio then
    if v_pagados > 0 then
      raise exception 'No se puede cambiar la fecha de inicio: el contrato ya tiene pagos registrados.';
    end if;
    if p_pagos_regenerados is null then
      raise exception 'Faltan los períodos regenerados para la nueva fecha de inicio.';
    end if;

    delete from cargos_extra_contrato
      where pago_id in (select id from pagos_contrato where contrato_id = p_contrato_id);
    delete from pagos_contrato where contrato_id = p_contrato_id;

    insert into pagos_contrato (
      contrato_id, periodo_numero, periodo_inicio, periodo_fin, monto_base, es_periodo_actualizacion, estado
    )
    select p_contrato_id, r.periodo_numero, r.periodo_inicio, r.periodo_fin, p_monto_base,
           coalesce(r.es_periodo_actualizacion, false), 'pendiente'
    from jsonb_to_recordset(p_pagos_regenerados)
      as r(periodo_numero integer, periodo_inicio date, periodo_fin date, es_periodo_actualizacion boolean);
  end if;

  -- ── Monto base ──
  if p_monto_base is distinct from v_ct.monto_base then
    if v_con_actualizaciones then
      raise exception 'No se puede cambiar el monto base: el contrato ya tuvo actualizaciones por índice aplicadas.';
    end if;
    update pagos_contrato set monto_base = p_monto_base where contrato_id = p_contrato_id;
  end if;

  -- ── Depósito ──
  if p_deposito is distinct from v_ct.deposito then
    if v_con_actualizaciones then
      raise exception 'No se puede cambiar el depósito: el contrato ya tuvo actualizaciones por índice aplicadas.';
    end if;
    if v_cuota1_pagada then
      raise exception 'No se puede cambiar el depósito: ya se cobró con la primera cuota.';
    end if;
  end if;

  -- ── Tipo / plazo de actualización ──
  if p_tipo_actualizacion is distinct from v_ct.tipo_actualizacion
     or p_plazo_actualizacion is distinct from v_ct.plazo_actualizacion then
    if v_con_actualizaciones then
      raise exception 'No se puede cambiar el tipo o el plazo de actualización: el contrato ya tuvo actualizaciones por índice aplicadas.';
    end if;
    v_plazo := case p_plazo_actualizacion
      when 'Mensual' then 1 when 'Trimestral' then 3 when 'Cuatrimestral' then 4
      when 'Semestral' then 6 when 'Anual' then 12 else 0 end;
    update pagos_contrato
      set es_periodo_actualizacion = (v_plazo > 0 and periodo_numero > 1 and (periodo_numero - 1) % v_plazo = 0)
      where contrato_id = p_contrato_id;
  end if;

  update contratos
  set monto_base = p_monto_base,
      deposito = p_deposito,
      tipo_actualizacion = p_tipo_actualizacion,
      plazo_actualizacion = p_plazo_actualizacion,
      fecha_inicio = p_fecha_inicio
  where id = p_contrato_id;
end;
$$;

grant execute on function editar_contrato_condiciones(uuid, numeric, numeric, text, text, date, jsonb) to authenticated;

-- ROLLBACK:
-- drop function if exists editar_contrato_condiciones(uuid, numeric, numeric, text, text, date, jsonb);
