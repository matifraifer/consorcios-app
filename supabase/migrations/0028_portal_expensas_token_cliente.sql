-- Suma cliente_config a portal_expensas_token (ya lo traía portal_alquiler_*
-- y portal_expensas_dni no lo necesitaba porque el frontend ya tiene el
-- cliente resuelto por slug/id). Se usa para el saludo "Bienvenido/a al
-- portal del vecino de {cliente}" en el flujo por link de WhatsApp, donde
-- no hay :clienteId en la URL.

create or replace function public.portal_expensas_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_depto departamentos%rowtype;
  v_cliente_id uuid;
  v_dnis text[];
  v_unidad_propia jsonb;
  v_unidades jsonb;
begin
  select * into v_depto from departamentos where token_consulta = p_token;
  if not found then
    return null;
  end if;

  select cliente_id into v_cliente_id from consorcios where id = v_depto.id_consorcio;
  select coalesce(array_remove(array[lower(trim(v_depto.propietario_dni)), lower(trim(v_depto.inquilino_dni))], null), '{}'::text[])
    into v_dnis;

  select jsonb_build_object(
    'departamento_id', v_depto.id,
    'numeracion', v_depto.numeracion,
    'inquilino', v_depto.inquilino,
    'token_consulta', v_depto.token_consulta,
    'consorcio_nombre', c.nombre,
    'tasa_mora', c.tasa_mora,
    'comision_plataforma_fee', c.comision_plataforma_fee,
    'permite_pagos_parciales', c.permite_pagos_parciales,
    'periodos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pe.id, 'mes', pe.mes, 'anio', pe.anio, 'fecha_vencimiento', pe.fecha_vencimiento
             ) order by pe.anio desc, pe.mes desc), '[]'::jsonb)
      from periodos_expensas pe
      where pe.consorcio_id = v_depto.id_consorcio and pe.estado = 'cerrado'
    ),
    'expensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'periodo_id', ed.periodo_id, 'departamento_id', ed.departamento_id,
               'monto_total', ed.monto_total, 'monto_pagado', ed.monto_pagado, 'pagado', ed.pagado
             )), '[]'::jsonb)
      from expensas_departamento ed
      where ed.departamento_id = v_depto.id
        and ed.periodo_id in (
          select id from periodos_expensas where consorcio_id = v_depto.id_consorcio and estado = 'cerrado'
        )
    ),
    'gastos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'periodo_id', g.periodo_id, 'nombre', g.nombre, 'categoria', g.categoria,
               'tipo', g.tipo, 'monto', g.monto
             ) order by g.periodo_id desc), '[]'::jsonb)
      from gastos g
      where g.periodo_id in (
        select ed.periodo_id from expensas_departamento ed
        where ed.departamento_id = v_depto.id and ed.pagado = false
      )
      and (g.departamentos_ids is null or v_depto.id = any(g.departamentos_ids))
    )
  )
    into v_unidad_propia
    from consorcios c where c.id = v_depto.id_consorcio;

  select coalesce(jsonb_agg(u), '[]'::jsonb)
    into v_unidades
    from jsonb_array_elements(public._portal_unidades(v_cliente_id, v_dnis)) u
    where (u->>'departamento_id')::int is distinct from v_depto.id;

  return jsonb_build_object(
    'unidades', jsonb_build_array(v_unidad_propia) || v_unidades,
    'cliente_config', public._portal_cliente_config(v_cliente_id)
  );
end;
$$;

grant execute on function public.portal_expensas_token(uuid) to anon;
