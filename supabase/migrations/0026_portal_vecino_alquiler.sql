-- Amplía el portal del vecino para la sección "Alquiler": ahora devuelve
-- TODOS los pagos de cada contrato (no solo los pendientes), con sus cargos
-- extra y el recibo (si ya está pagado), más los datos del cliente
-- (logo/nombre/teléfono/dirección) necesarios para generar el PDF del
-- recibo desde el portal público, igual que hace ContratoDetalleDrawer.
--
-- También hace que /consulta/:token (que antes solo mostraba esa unidad)
-- resuelva el DNI del propietario/inquilino de esa unidad y busque con él
-- el resto de unidades y contratos asociados, igual que /portal/:clienteId.

-- Helper interno: unidades + contratos + índices para un cliente y un
-- conjunto de DNIs (propietario o inquilino, en departamentos o contratos).
create or replace function public._portal_datos(p_cliente_id uuid, p_dnis text[])
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
        lower(trim(d.propietario_dni)) = any(p_dnis)
        or lower(trim(d.inquilino_dni)) = any(p_dnis)
      );

  select coalesce(jsonb_agg(jsonb_build_object(
           'contrato_id', ct.id,
           'inquilino_nombre', ct.inquilino_nombre,
           'inquilino_apellido', ct.inquilino_apellido,
           'es_compraventa', ct.es_compraventa,
           'tipo_actualizacion', ct.tipo_actualizacion,
           'plazo_actualizacion', ct.plazo_actualizacion,
           'dia_vencimiento', ct.dia_vencimiento,
           'propiedad', (
             select jsonb_build_object('direccion', pr.direccion, 'titulo', pr.titulo)
             from propiedades pr where pr.id = ct.propiedad_id
           ),
           'pagos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', pc.id, 'periodo_numero', pc.periodo_numero,
                      'periodo_inicio', pc.periodo_inicio, 'periodo_fin', pc.periodo_fin,
                      'monto_base', pc.monto_base, 'es_periodo_actualizacion', pc.es_periodo_actualizacion,
                      'estado', pc.estado, 'monto_pagado', pc.monto_pagado, 'fecha_pago', pc.fecha_pago,
                      'cargos_extra', (
                        select coalesce(jsonb_agg(jsonb_build_object(
                                 'descripcion', ce.descripcion, 'monto', ce.monto
                               ) order by ce.created_at), '[]'::jsonb)
                        from cargos_extra_contrato ce where ce.pago_id = pc.id
                      ),
                      'recibo', (
                        select jsonb_build_object(
                                 'serie', rc.serie, 'numero', rc.numero,
                                 'fecha_pago', rc.fecha_pago, 'monto', rc.monto
                               )
                        from recibos_contrato rc where rc.pago_id = pc.id
                      )
                    ) order by pc.periodo_numero), '[]'::jsonb)
             from pagos_contrato pc
             where pc.contrato_id = ct.id
           )
         )), '[]'::jsonb)
    into v_contratos
    from contratos ct
    where ct.cliente_id = p_cliente_id
      and ct.finalizado = false
      and (
        lower(trim(ct.propietario_dni)) = any(p_dnis)
        or lower(trim(ct.inquilino_dni)) = any(p_dnis)
      );

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', ia.tipo, 'mes', ia.mes, 'anio', ia.anio, 'valor', ia.valor
         )), '[]'::jsonb)
    into v_indices
    from indices_actualizacion ia
    where ia.cliente_id = p_cliente_id or ia.externo = true;

  return jsonb_build_object('unidades', v_unidades, 'contratos', v_contratos, 'indices', v_indices);
end;
$$;

create or replace function public.portal_por_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_depto departamentos%rowtype;
  v_cliente_id uuid;
  v_dnis text[];
  v_datos jsonb;
  v_unidad_propia jsonb;
  v_unidades jsonb;
  v_cliente_config jsonb;
begin
  select * into v_depto from departamentos where token_consulta = p_token;

  if not found then
    return null;
  end if;

  select cliente_id into v_cliente_id from consorcios where id = v_depto.id_consorcio;

  select array_remove(array[lower(trim(v_depto.propietario_dni)), lower(trim(v_depto.inquilino_dni))], null)
    into v_dnis;

  v_datos := public._portal_datos(v_cliente_id, coalesce(v_dnis, '{}'::text[]));

  -- Garantiza que la unidad del link esté siempre presente, incluso si no
  -- tiene ningún DNI cargado (con lo que _portal_datos no la encontraría).
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
    from jsonb_array_elements(v_datos->'unidades') u
    where (u->>'departamento_id')::int is distinct from v_depto.id;

  v_unidades := jsonb_build_array(v_unidad_propia) || v_unidades;

  select jsonb_build_object('nombre', cs.nombre, 'logo_url', cs.logo_url, 'telefono', cs.telefono, 'direccion', cs.direccion)
    into v_cliente_config
    from clientes_servicio cs where cs.id = v_cliente_id;

  return jsonb_build_object(
    'unidades', v_unidades,
    'contratos', v_datos->'contratos',
    'indices', v_datos->'indices',
    'cliente_config', v_cliente_config
  );
end;
$$;

grant execute on function public.portal_por_token(uuid) to anon;

create or replace function public.portal_buscar(p_cliente_id uuid, p_dni text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_datos jsonb;
  v_cliente_config jsonb;
begin
  v_datos := public._portal_datos(p_cliente_id, array[lower(trim(p_dni))]);

  if jsonb_array_length(v_datos->'unidades') = 0 and jsonb_array_length(v_datos->'contratos') = 0 then
    return null;
  end if;

  select jsonb_build_object('nombre', cs.nombre, 'logo_url', cs.logo_url, 'telefono', cs.telefono, 'direccion', cs.direccion)
    into v_cliente_config
    from clientes_servicio cs where cs.id = p_cliente_id;

  return v_datos || jsonb_build_object('cliente_config', v_cliente_config);
end;
$$;

grant execute on function public.portal_buscar(uuid, text) to anon;
