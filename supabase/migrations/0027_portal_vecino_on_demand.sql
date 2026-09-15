-- Carga por demanda: antes portal_por_token/portal_buscar traían expensas y
-- alquiler juntos en una sola llamada. Ahora cada sección se pide por
-- separado, recién cuando el vecino abre esa pestaña, y encima evita el
-- trabajo de armar la sección que no se pidió.

drop function if exists public.portal_por_token(uuid);
drop function if exists public.portal_buscar(uuid, text);
drop function if exists public._portal_datos(uuid, text[]);

-- ── Helpers internos ────────────────────────────────────────────────────

create or replace function public._portal_unidades(p_cliente_id uuid, p_dnis text[])
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
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
  from departamentos d
  join consorcios c on c.id = d.id_consorcio
  where c.cliente_id = p_cliente_id
    and (
      lower(trim(d.propietario_dni)) = any(p_dnis)
      or lower(trim(d.inquilino_dni)) = any(p_dnis)
    );
$$;

create or replace function public._portal_contratos(p_cliente_id uuid, p_dnis text[])
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
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
  from contratos ct
  where ct.cliente_id = p_cliente_id
    and ct.finalizado = false
    and (
      lower(trim(ct.propietario_dni)) = any(p_dnis)
      or lower(trim(ct.inquilino_dni)) = any(p_dnis)
    );
$$;

create or replace function public._portal_indices(p_cliente_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', ia.tipo, 'mes', ia.mes, 'anio', ia.anio, 'valor', ia.valor
         )), '[]'::jsonb)
  from indices_actualizacion ia
  where ia.cliente_id = p_cliente_id or ia.externo = true;
$$;

create or replace function public._portal_cliente_config(p_cliente_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('nombre', cs.nombre, 'logo_url', cs.logo_url, 'telefono', cs.telefono, 'direccion', cs.direccion)
  from clientes_servicio cs where cs.id = p_cliente_id;
$$;

-- ── RPCs públicas (una por pestaña, más una de validación liviana) ─────

-- Chequeo liviano para el login por DNI: solo confirma si hay algo asociado,
-- sin traer datos. Determina si se muestra "no encontramos nada" o se
-- avanza a la pantalla de resultados (donde cada pestaña carga la suya).
create or replace function public.portal_dni_existe(p_cliente_id uuid, p_dni text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from departamentos d join consorcios c on c.id = d.id_consorcio
    where c.cliente_id = p_cliente_id
      and (lower(trim(d.propietario_dni)) = lower(trim(p_dni)) or lower(trim(d.inquilino_dni)) = lower(trim(p_dni)))
  ) or exists(
    select 1 from contratos ct
    where ct.cliente_id = p_cliente_id and ct.finalizado = false
      and (lower(trim(ct.propietario_dni)) = lower(trim(p_dni)) or lower(trim(ct.inquilino_dni)) = lower(trim(p_dni)))
  );
$$;

grant execute on function public.portal_dni_existe(uuid, text) to anon;

create or replace function public.portal_expensas_dni(p_cliente_id uuid, p_dni text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('unidades', public._portal_unidades(p_cliente_id, array[lower(trim(p_dni))]));
$$;

grant execute on function public.portal_expensas_dni(uuid, text) to anon;

create or replace function public.portal_alquiler_dni(p_cliente_id uuid, p_dni text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'contratos', public._portal_contratos(p_cliente_id, array[lower(trim(p_dni))]),
    'indices', public._portal_indices(p_cliente_id),
    'cliente_config', public._portal_cliente_config(p_cliente_id)
  );
$$;

grant execute on function public.portal_alquiler_dni(uuid, text) to anon;

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

  -- Garantiza que la unidad del link esté siempre presente, incluso si no
  -- tiene ningún DNI cargado (con lo que _portal_unidades no la encontraría).
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

  return jsonb_build_object('unidades', jsonb_build_array(v_unidad_propia) || v_unidades);
end;
$$;

grant execute on function public.portal_expensas_token(uuid) to anon;

create or replace function public.portal_alquiler_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_depto departamentos%rowtype;
  v_cliente_id uuid;
  v_dnis text[];
begin
  select * into v_depto from departamentos where token_consulta = p_token;
  if not found then
    return null;
  end if;

  select cliente_id into v_cliente_id from consorcios where id = v_depto.id_consorcio;
  select coalesce(array_remove(array[lower(trim(v_depto.propietario_dni)), lower(trim(v_depto.inquilino_dni))], null), '{}'::text[])
    into v_dnis;

  return jsonb_build_object(
    'contratos', public._portal_contratos(v_cliente_id, v_dnis),
    'indices', public._portal_indices(v_cliente_id),
    'cliente_config', public._portal_cliente_config(v_cliente_id)
  );
end;
$$;

grant execute on function public.portal_alquiler_token(uuid) to anon;
