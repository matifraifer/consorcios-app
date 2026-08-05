-- Consulta pública de deuda: cada departamento tiene un token no adivinable
-- para el link público; la validación de email + unidad se hace del lado del
-- servidor (security definer) para nunca exponer el email guardado al cliente
-- antes de que el visitante lo escriba.

alter table public.departamentos
  add column if not exists token_consulta uuid not null default gen_random_uuid();

alter table public.departamentos
  add constraint departamentos_token_consulta_key unique (token_consulta);

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

  return jsonb_build_object(
    'departamento_id', v_depto.id,
    'numeracion', v_depto.numeracion,
    'inquilino', v_depto.inquilino,
    'consorcio_nombre', v_consorcio.nombre,
    'tasa_mora', v_consorcio.tasa_mora,
    'periodos', v_periodos,
    'expensas', v_expensas
  );
end;
$$;

grant execute on function public.consultar_deuda_departamento(uuid, text, text) to anon;
