-- Eliminación lógica de contratos (ícono "Eliminar contrato" en la grilla de contratos).
--
-- - contratos.deleted (true = eliminado), deleted_at y deleted_by (auth.uid() de quien lo
--   eliminó). La fila nunca se borra: pagos, recibos (con su numeración), cargos e
--   historial de actualizaciones quedan intactos.
-- - Un contrato eliminado no se muestra en ningún lado: grilla y KPIs del dashboard
--   (filtrado en el frontend) y Portal del Vecino (filtrado acá, en las funciones que
--   leen contratos).
-- - No se filtra por RLS a propósito: si la policy ocultara los eliminados, el mismo
--   update que marca deleted=true no podría devolver la fila.
-- Requiere 0048.

alter table contratos
  add column if not exists deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists contratos_cliente_no_eliminados_idx
  on contratos (cliente_id) where deleted = false;

-- ── Portal: portal_dni_existe (definición de 0029 + filtro deleted) ──

create or replace function public.portal_dni_existe(p_cliente_id uuid, p_dni text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'tiene_unidades', exists(
      select 1 from departamentos d join consorcios c on c.id = d.id_consorcio
      where c.cliente_id = p_cliente_id
        and (lower(trim(d.propietario_dni)) = lower(trim(p_dni)) or lower(trim(d.inquilino_dni)) = lower(trim(p_dni)))
    ),
    'tiene_contratos', exists(
      select 1 from contratos ct
      where ct.cliente_id = p_cliente_id and ct.finalizado = false and ct.deleted = false
        and (lower(trim(ct.propietario_dni)) = lower(trim(p_dni)) or lower(trim(ct.inquilino_dni)) = lower(trim(p_dni)))
    )
  );
$$;

grant execute on function public.portal_dni_existe(uuid, text) to anon;

-- ── Portal: portal_expensas_token (definición de 0032 + filtro deleted) ──

create or replace function public.portal_expensas_token(p_token uuid, p_dni text)
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
  v_tiene_contratos boolean;
begin
  select * into v_depto from departamentos where token_consulta = p_token;
  if not found then
    return null;
  end if;

  select cliente_id into v_cliente_id from consorcios where id = v_depto.id_consorcio;
  select coalesce(array_remove(array[lower(trim(v_depto.propietario_dni)), lower(trim(v_depto.inquilino_dni))], null), '{}'::text[])
    into v_dnis;

  -- Mismo "no encontrado" que el token inválido, para no filtrar si el token
  -- existe pero el DNI es incorrecto.
  if not (lower(trim(p_dni)) = any(v_dnis)) then
    return null;
  end if;

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

  select exists(
    select 1 from contratos ct
    where ct.cliente_id = v_cliente_id and ct.finalizado = false and ct.deleted = false
      and (lower(trim(ct.propietario_dni)) = any(v_dnis) or lower(trim(ct.inquilino_dni)) = any(v_dnis))
  ) into v_tiene_contratos;

  return jsonb_build_object(
    'unidades', jsonb_build_array(v_unidad_propia) || v_unidades,
    'tiene_contratos', v_tiene_contratos,
    'cliente_config', public._portal_cliente_config(v_cliente_id)
  );
end;
$$;

grant execute on function public.portal_expensas_token(uuid, text) to anon;

-- ── Portal: _portal_contratos (definición de 0048 + filtro deleted) ──

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
           'interes_mora_diario', ct.interes_mora_diario,
           'deposito', ct.deposito,
           'deposito_vigente', ct.deposito_vigente,
           'propiedad', (
             select jsonb_build_object('direccion', pr.direccion, 'titulo', pr.titulo)
             from propiedades pr where pr.id = ct.propiedad_id
           ),
           'pagos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', pc.id, 'periodo_numero', pc.periodo_numero,
                      'periodo_inicio', pc.periodo_inicio, 'periodo_fin', pc.periodo_fin,
                      'monto_base', pc.monto_base, 'monto_vigente', pc.monto_vigente,
                      'es_periodo_actualizacion', pc.es_periodo_actualizacion,
                      'estado', pc.estado, 'monto_pagado', pc.monto_pagado, 'fecha_pago', pc.fecha_pago,
                      'cargos_extra', (
                        select coalesce(jsonb_agg(jsonb_build_object(
                                 'descripcion', ce.descripcion, 'monto', ce.monto, 'tipo', ce.tipo
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
    and ct.finalizado = false and ct.deleted = false
    and (
      lower(trim(ct.propietario_dni)) = any(p_dnis)
      or lower(trim(ct.inquilino_dni)) = any(p_dnis)
    );
$$;

-- ROLLBACK:
-- (re-crear portal_dni_existe desde 0029, portal_expensas_token desde 0032 y _portal_contratos desde 0048)
-- drop index if exists contratos_cliente_no_eliminados_idx;
-- alter table contratos drop column if exists deleted_by, drop column if exists deleted_at, drop column if exists deleted;
