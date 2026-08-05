-- Extiende consultar_deuda_departamento (0010) para devolver también el
-- detalle de gastos de los períodos que el departamento adeuda, filtrados
-- a los gastos que le corresponden (departamentos_ids nulo = todos, o
-- incluye a este departamento).

create or replace function public.consultar_deuda_departamento(
  p_token uuid, p_email text, p_numeracion text
)
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

  if not found
     or v_depto.email is null
     or lower(trim(v_depto.email)) is distinct from lower(trim(p_email))
     or lower(trim(v_depto.numeracion)) is distinct from lower(trim(p_numeracion)) then
    return null;
  end if;

  select nombre, tasa_mora into v_consorcio from consorcios where id = v_depto.id_consorcio;

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

  -- Gastos de los períodos que este departamento adeuda (expensa sin pagar),
  -- filtrados a los que le corresponden.
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
    'consorcio_nombre', v_consorcio.nombre,
    'tasa_mora', v_consorcio.tasa_mora,
    'periodos', v_periodos,
    'expensas', v_expensas,
    'gastos', v_gastos
  );
end;
$$;

grant execute on function public.consultar_deuda_departamento(uuid, text, text) to anon;
