-- Portal del vecino: reemplaza la validación por email + número de unidad
-- (consultar_deuda_departamento) por dos RPCs basadas en DNI:
--   - portal_por_token: para el link de WhatsApp (token no adivinable, ya
--     autentica la unidad, no se pide nada más).
--   - portal_buscar: para el portal general /portal/:clienteId, donde el
--     vecino entra solo con su DNI y ve todas sus unidades y contratos
--     dentro de ese cliente/inmobiliaria.

alter table public.departamentos
  add column if not exists inquilino_dni text;

drop function if exists public.consultar_deuda_departamento(uuid, text, text);

-- Devuelve el mismo shape que antes tenía consultar_deuda_departamento,
-- pero sin pedir email/numeración: el token ya es el secreto.
create or replace function public.portal_por_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_depto departamentos%rowtype;
  v_consorcio record;
  v_periodos jsonb;
  v_expensas jsonb;
  v_gastos jsonb;
begin
  select * into v_depto from departamentos where token_consulta = p_token;

  if not found then
    return null;
  end if;

  select nombre, tasa_mora, comision_plataforma_fee, permite_pagos_parciales
    into v_consorcio
    from consorcios where id = v_depto.id_consorcio;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'mes', mes, 'anio', anio, 'fecha_vencimiento', fecha_vencimiento
         ) order by anio desc, mes desc), '[]'::jsonb)
    into v_periodos
    from periodos_expensas
    where consorcio_id = v_depto.id_consorcio and estado = 'cerrado';

  select coalesce(jsonb_agg(jsonb_build_object(
           'periodo_id', ed.periodo_id, 'departamento_id', ed.departamento_id,
           'monto_total', ed.monto_total, 'monto_pagado', ed.monto_pagado, 'pagado', ed.pagado
         )), '[]'::jsonb)
    into v_expensas
    from expensas_departamento ed
    where ed.departamento_id = v_depto.id
      and ed.periodo_id in (
        select id from periodos_expensas where consorcio_id = v_depto.id_consorcio and estado = 'cerrado'
      );

  select coalesce(jsonb_agg(jsonb_build_object(
           'periodo_id', g.periodo_id, 'nombre', g.nombre, 'categoria', g.categoria,
           'tipo', g.tipo, 'monto', g.monto
         ) order by g.periodo_id desc), '[]'::jsonb)
    into v_gastos
    from gastos g
    where g.periodo_id in (
      select ed.periodo_id from expensas_departamento ed
      where ed.departamento_id = v_depto.id and ed.pagado = false
    )
    and (g.departamentos_ids is null or v_depto.id = any(g.departamentos_ids));

  return jsonb_build_object(
    'departamento_id', v_depto.id,
    'numeracion', v_depto.numeracion,
    'inquilino', v_depto.inquilino,
    'token_consulta', v_depto.token_consulta,
    'consorcio_nombre', v_consorcio.nombre,
    'tasa_mora', v_consorcio.tasa_mora,
    'comision_plataforma_fee', v_consorcio.comision_plataforma_fee,
    'permite_pagos_parciales', v_consorcio.permite_pagos_parciales,
    'periodos', v_periodos,
    'expensas', v_expensas,
    'gastos', v_gastos
  );
end;
$$;

grant execute on function public.portal_por_token(uuid) to anon;

-- Portal general por DNI: busca todas las unidades (por propietario_dni o
-- inquilino_dni) y contratos (por propietario_dni o inquilino_dni, no
-- finalizados) del cliente que coincidan con el DNI ingresado.
create or replace function public.portal_buscar(p_cliente_id uuid, p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidades jsonb;
  v_contratos jsonb;
  v_indices jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'departamento_id', d.id,
           'numeracion', d.numeracion,
           'inquilino', d.inquilino,
           'token_consulta', d.token_consulta,
           'consorcio_nombre', c.nombre,
           'tasa_mora', c.tasa_mora,
           'comision_plataforma_fee', c.comision_plataforma_fee,
           'permite_pagos_parciales', c.permite_pagos_parciales,
           'periodos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', pe.id, 'mes', pe.mes, 'anio', pe.anio, 'fecha_vencimiento', pe.fecha_vencimiento
                    ) order by pe.anio desc, pe.mes desc), '[]'::jsonb)
             from periodos_expensas pe
             where pe.consorcio_id = d.id_consorcio and pe.estado = 'cerrado'
           ),
           'expensas', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'periodo_id', ed.periodo_id, 'departamento_id', ed.departamento_id,
                      'monto_total', ed.monto_total, 'monto_pagado', ed.monto_pagado, 'pagado', ed.pagado
                    )), '[]'::jsonb)
             from expensas_departamento ed
             where ed.departamento_id = d.id
               and ed.periodo_id in (
                 select id from periodos_expensas where consorcio_id = d.id_consorcio and estado = 'cerrado'
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
               where ed.departamento_id = d.id and ed.pagado = false
             )
             and (g.departamentos_ids is null or d.id = any(g.departamentos_ids))
           )
         )), '[]'::jsonb)
    into v_unidades
    from departamentos d
    join consorcios c on c.id = d.id_consorcio
    where c.cliente_id = p_cliente_id
      and (
        (d.propietario_dni is not null and lower(trim(d.propietario_dni)) = lower(trim(p_dni)))
        or (d.inquilino_dni is not null and lower(trim(d.inquilino_dni)) = lower(trim(p_dni)))
      );

  select coalesce(jsonb_agg(jsonb_build_object(
           'contrato_id', ct.id,
           'tipo_actualizacion', ct.tipo_actualizacion,
           'plazo_actualizacion', ct.plazo_actualizacion,
           'es_compraventa', ct.es_compraventa,
           'pagos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', pc.id, 'periodo_numero', pc.periodo_numero,
                      'periodo_inicio', pc.periodo_inicio, 'periodo_fin', pc.periodo_fin,
                      'monto_base', pc.monto_base, 'es_periodo_actualizacion', pc.es_periodo_actualizacion,
                      'estado', pc.estado
                    ) order by pc.periodo_numero), '[]'::jsonb)
             from pagos_contrato pc
             where pc.contrato_id = ct.id and pc.estado = 'pendiente'
           )
         )), '[]'::jsonb)
    into v_contratos
    from contratos ct
    where ct.cliente_id = p_cliente_id
      and ct.finalizado = false
      and (
        (ct.propietario_dni is not null and lower(trim(ct.propietario_dni)) = lower(trim(p_dni)))
        or (ct.inquilino_dni is not null and lower(trim(ct.inquilino_dni)) = lower(trim(p_dni)))
      );

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', ia.tipo, 'mes', ia.mes, 'anio', ia.anio, 'valor', ia.valor
         )), '[]'::jsonb)
    into v_indices
    from indices_actualizacion ia
    where ia.cliente_id = p_cliente_id or ia.externo = true;

  if jsonb_array_length(v_unidades) = 0 and jsonb_array_length(v_contratos) = 0 then
    return null;
  end if;

  return jsonb_build_object(
    'unidades', v_unidades,
    'contratos', v_contratos,
    'indices', v_indices
  );
end;
$$;

grant execute on function public.portal_buscar(uuid, text) to anon;
