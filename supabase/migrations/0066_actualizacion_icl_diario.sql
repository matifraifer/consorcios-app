-- 0066_actualizacion_icl_diario.sql  (requiere 0048, 0056 y 0065)
-- Las actualizaciones de los índices que tienen serie DIARIA en `indices_diarios` (hoy, el
-- ICL del BCRA) dejan de componer variaciones mensuales y pasan a calcularse como las
-- calculadoras de mercado:
--
--     coeficiente = valor(inicio del período de actualización) / valor(inicio del período anterior)
--
-- Ej.: contrato trimestral que arranca el 01/08/2026 → la cuota 4 (01/11/2026) se actualiza
-- con ICL(01/11/2026) / ICL(01/08/2026) = 37,21 / 35,01.
--
-- Los índices sin serie diaria (IPC, índices propios) siguen igual que antes.
-- Las actualizaciones ya aplicadas (actualizaciones_contrato) quedan congeladas.
--
-- Si el valor de la fecha exacta no está publicado se usa el último anterior, con hasta
-- DIAS_TOLERANCIA días de diferencia (el BCRA publica todos los días, también fines de
-- semana). Si no hay valor en ese rango, la fecha cuenta como índice faltante.
--
-- No correr entre el 1 y el 10 del mes (ventana de cobros).

-- ── Valor diario a una fecha, con tolerancia ─────────────────────────────
create or replace function public._indice_diario_valor(p_tipo text, p_fecha date)
returns numeric
language sql
stable
set search_path = public
as $$
  select d.valor
  from indices_diarios d
  where d.tipo = p_tipo and d.fecha <= p_fecha and d.fecha >= p_fecha - 7
  order by d.fecha desc
  limit 1
$$;

grant execute on function public._indice_diario_valor(text, date) to authenticated;

-- ── Aplica (en orden) todas las actualizaciones pendientes hasta p_hasta_periodo ──
create or replace function aplicar_actualizaciones_contrato(p_contrato_id uuid, p_hasta_periodo integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ct contratos%rowtype;
  v_plazo integer;
  v_diario boolean;
  v_up pagos_contrato%rowtype;
  v_mes record;
  v_valor numeric;
  v_factor numeric;
  v_indices jsonb;
  v_faltantes text[];
  v_fecha_desde date;
  v_valor_desde numeric;
  v_valor_hasta numeric;
  v_monto_ant numeric;
  v_monto_nuevo numeric;
  v_dep_ant numeric;
  v_dep_nuevo numeric;
begin
  select * into v_ct from contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'Contrato no encontrado.';
  end if;

  v_plazo := case v_ct.plazo_actualizacion
    when 'Mensual' then 1 when 'Trimestral' then 3 when 'Cuatrimestral' then 4
    when 'Semestral' then 6 when 'Anual' then 12 else 0 end;
  if v_plazo = 0 or v_ct.tipo_actualizacion is null then
    return;
  end if;

  v_diario := exists (select 1 from indices_diarios where tipo = v_ct.tipo_actualizacion);

  -- Sin ningún índice cargado de ese tipo, el contrato no se actualiza (mismo criterio
  -- que el frontend: "Los montos se muestran sin actualización").
  if not v_diario and not exists (select 1 from indices_actualizacion where tipo = v_ct.tipo_actualizacion) then
    return;
  end if;

  for v_up in
    select * from pagos_contrato p
    where p.contrato_id = p_contrato_id
      and p.periodo_numero > 1
      and p.periodo_numero <= p_hasta_periodo
      and (p.periodo_numero - 1) % v_plazo = 0
      and not exists (select 1 from actualizaciones_contrato a where a.pago_id = p.id)
    order by p.periodo_numero
  loop
    v_factor := 1;
    v_indices := '[]'::jsonb;
    v_faltantes := '{}';

    if v_diario then
      -- Serie diaria: cociente entre el inicio de este período y el del período anterior.
      select periodo_inicio into v_fecha_desde
      from pagos_contrato
      where contrato_id = p_contrato_id and periodo_numero = v_up.periodo_numero - v_plazo;

      v_valor_desde := _indice_diario_valor(v_ct.tipo_actualizacion, v_fecha_desde);
      v_valor_hasta := _indice_diario_valor(v_ct.tipo_actualizacion, v_up.periodo_inicio);

      if v_valor_desde is null then
        v_faltantes := array_append(v_faltantes, to_char(v_fecha_desde, 'DD/MM/YYYY'));
      end if;
      if v_valor_hasta is null then
        v_faltantes := array_append(v_faltantes, to_char(v_up.periodo_inicio, 'DD/MM/YYYY'));
      end if;

      if v_valor_desde is not null and v_valor_hasta is not null then
        v_factor := v_valor_hasta / v_valor_desde;
        v_indices := jsonb_build_array(
          jsonb_build_object('fecha', v_fecha_desde, 'valor', v_valor_desde),
          jsonb_build_object('fecha', v_up.periodo_inicio, 'valor', v_valor_hasta));
      end if;
    else
      -- Variación mensual: se componen los v_plazo meses anteriores a la actualización.
      for v_mes in
        select periodo_inicio from pagos_contrato
        where contrato_id = p_contrato_id
          and periodo_numero between v_up.periodo_numero - v_plazo and v_up.periodo_numero - 1
        order by periodo_numero
      loop
        select i.valor into v_valor
        from indices_actualizacion i
        where i.tipo = v_ct.tipo_actualizacion
          and i.mes = extract(month from v_mes.periodo_inicio)::int
          and i.anio = extract(year from v_mes.periodo_inicio)::int
        order by coalesce(i.externo, false)   -- prioriza el índice propio del cliente
        limit 1;

        if v_valor is null then
          v_faltantes := array_append(v_faltantes, to_char(v_mes.periodo_inicio, 'MM/YYYY'));
        else
          v_factor := v_factor * (1 + v_valor / 100);
          v_indices := v_indices || jsonb_build_array(jsonb_build_object(
            'mes', extract(month from v_mes.periodo_inicio)::int,
            'anio', extract(year from v_mes.periodo_inicio)::int,
            'valor', v_valor));
        end if;
      end loop;
    end if;

    -- Solo bloquea si el período de la actualización todavía no se pagó. Las de períodos
    -- ya pagados se aplican con los índices que haya, para no trabar el contrato.
    if coalesce(array_length(v_faltantes, 1), 0) > 0 and v_up.estado <> 'pagado' then
      raise exception 'Faltan índices % de: %. Cargalos antes de registrar este pago.',
        v_ct.tipo_actualizacion, array_to_string(v_faltantes, ', ');
    end if;

    select coalesce(monto_vigente, monto_base) into v_monto_ant
    from pagos_contrato
    where contrato_id = p_contrato_id and periodo_numero = v_up.periodo_numero - 1;

    v_monto_nuevo := round(v_monto_ant * v_factor);

    update pagos_contrato
    set monto_vigente = v_monto_nuevo
    where contrato_id = p_contrato_id
      and periodo_numero >= v_up.periodo_numero
      and periodo_numero < v_up.periodo_numero + v_plazo;

    v_dep_ant := coalesce(v_ct.deposito_vigente, v_ct.deposito);
    v_dep_nuevo := null;
    if coalesce(v_dep_ant, 0) > 0 then
      v_dep_nuevo := round(v_dep_ant * v_factor);
      update contratos set deposito_vigente = v_dep_nuevo where id = p_contrato_id;
      v_ct.deposito_vigente := v_dep_nuevo;

      if v_up.estado <> 'pagado' and v_dep_nuevo > v_dep_ant then
        insert into cargos_extra_contrato (pago_id, descripcion, monto, tipo)
        values (v_up.id, 'Actualización de depósito', v_dep_nuevo - v_dep_ant, 'deposito');
      end if;
    end if;

    insert into actualizaciones_contrato (
      cliente_id, contrato_id, pago_id, periodo_numero, tipo_indice, plazo_meses,
      indices_usados, coeficiente, monto_anterior, monto_nuevo, deposito_anterior, deposito_nuevo
    ) values (
      v_ct.cliente_id, p_contrato_id, v_up.id, v_up.periodo_numero, v_ct.tipo_actualizacion, v_plazo,
      v_indices, v_factor, v_monto_ant, v_monto_nuevo, v_dep_ant, v_dep_nuevo
    );
  end loop;
end;
$$;

grant execute on function aplicar_actualizaciones_contrato(uuid, integer) to authenticated;

-- ── Valores diarios que necesita el frontend para estimar ────────────────
-- Uno por cada fecha de inicio de período de los contratos (no eliminados) cuyo índice
-- tiene serie diaria. Devuelve la fecha pedida (no la del valor encontrado) para que el
-- frontend busque por igualdad; valor null = no publicado. RLS de pagos_contrato/contratos
-- limita a los contratos del cliente.
create or replace function public.indices_diarios_contratos()
returns table (tipo text, fecha date, valor numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select f.tipo, f.fecha, _indice_diario_valor(f.tipo, f.fecha)
  from (
    select distinct c.tipo_actualizacion as tipo, p.periodo_inicio as fecha
    from pagos_contrato p
    join contratos c on c.id = p.contrato_id
    where coalesce(c.deleted, false) = false
      and exists (select 1 from indices_diarios d where d.tipo = c.tipo_actualizacion)
  ) f
$$;

grant execute on function public.indices_diarios_contratos() to authenticated;

-- ── Portal del Vecino: índices + valores diarios de las fechas de sus contratos ──
create or replace function public._portal_indices(p_cliente_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object('tipo', ia.tipo, 'mes', ia.mes, 'anio', ia.anio, 'valor', ia.valor))
    from indices_actualizacion ia
    where ia.cliente_id = p_cliente_id or ia.externo = true
  ), '[]'::jsonb)
  || coalesce((
    select jsonb_agg(jsonb_build_object('tipo', f.tipo, 'fecha', f.fecha, 'valor', _indice_diario_valor(f.tipo, f.fecha), 'diario', true))
    from (
      select distinct c.tipo_actualizacion as tipo, p.periodo_inicio as fecha
      from pagos_contrato p
      join contratos c on c.id = p.contrato_id
      where c.cliente_id = p_cliente_id
        and coalesce(c.deleted, false) = false
        and exists (select 1 from indices_diarios d where d.tipo = c.tipo_actualizacion)
    ) f
  ), '[]'::jsonb);
$$;

-- Verificación (contrato trimestral desde 01/08/2026, 300.000 → 318.852):
--   select round(300000 * _indice_diario_valor('ICL', '2026-11-01') / _indice_diario_valor('ICL', '2026-08-01'));
--
-- Rollback: volver a correr la definición de aplicar_actualizaciones_contrato de 0048 y la
-- de _portal_indices de 0027.
