-- Actualizaciones de contratos persistidas + interés por mora + depósito.
--
-- Hasta ahora la actualización por IPC/ICL/etc. se calculaba solo en el frontend en cada
-- render (computeMontoActualizado) y nunca se guardaba: pagos_contrato.monto_base quedaba
-- siempre con el monto original. A partir de acá:
--
-- - contratos.monto_base y pagos_contrato.monto_base NO cambian (monto original pactado).
-- - pagos_contrato.monto_vigente: monto de alquiler ya actualizado y congelado. Se completa
--   al aplicar una actualización, para el período de la actualización y los siguientes hasta
--   la próxima actualización. null = todavía no se aplicó (el frontend lo estima en vivo).
-- - actualizaciones_contrato: historial, una fila por actualización aplicada, con los índices
--   exactos que se usaron (los índices se pueden editar después; esto queda congelado).
-- - La actualización se aplica al registrar el pago del período de actualización
--   (registrar_pago_contrato), dentro de la misma transacción. Si faltan índices de algún mes
--   de la ventana, se corta con error y el pago no se registra.
-- - contratos.deposito (original) / deposito_vigente (último actualizado, lo mantiene la RPC):
--   en cada actualización el depósito se actualiza con el mismo coeficiente y la diferencia
--   se carga como cargo extra (tipo 'deposito') en el período de la actualización.
-- - contratos.interes_mora_diario: % diario. La mora se calcula en el frontend al registrar
--   el pago (el admin la puede editar) y se guarda como cargo extra (tipo 'mora').
--
-- Las RPC son SECURITY INVOKER: corren con los permisos del usuario, así que RLS limita
-- todo al cliente_id del usuario logueado.

alter table contratos
  add column if not exists interes_mora_diario numeric,
  add column if not exists deposito numeric,
  add column if not exists deposito_vigente numeric;

alter table pagos_contrato
  add column if not exists monto_vigente numeric;

alter table cargos_extra_contrato
  add column if not exists tipo text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cargos_extra_contrato_tipo_check') then
    alter table cargos_extra_contrato
      add constraint cargos_extra_contrato_tipo_check check (tipo in ('manual', 'mora', 'deposito'));
  end if;
end $$;

create table if not exists actualizaciones_contrato (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes_servicio(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  pago_id uuid not null unique references pagos_contrato(id) on delete cascade,
  periodo_numero integer not null,
  tipo_indice text not null,
  plazo_meses integer not null,
  indices_usados jsonb not null,           -- [{ "mes": 1, "anio": 2026, "valor": 2.2 }, ...]
  coeficiente numeric not null,
  monto_anterior numeric not null,
  monto_nuevo numeric not null,
  deposito_anterior numeric,
  deposito_nuevo numeric,
  aplicado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table actualizaciones_contrato enable row level security;

drop policy if exists "actualizaciones_contrato por cliente" on actualizaciones_contrato;
create policy "actualizaciones_contrato por cliente" on actualizaciones_contrato
  for all to authenticated
  using (cliente_id = current_cliente_id())
  with check (cliente_id = current_cliente_id());

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
  v_up pagos_contrato%rowtype;
  v_mes record;
  v_valor numeric;
  v_factor numeric;
  v_indices jsonb;
  v_faltantes text[];
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

  -- Sin ningún índice cargado de ese tipo, el contrato no se actualiza (mismo criterio
  -- que el frontend: "Los montos se muestran sin actualización").
  if not exists (select 1 from indices_actualizacion where tipo = v_ct.tipo_actualizacion) then
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

    -- Ventana: los v_plazo meses anteriores a la actualización (índices de variación mensual)
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

    -- Solo bloquea si el período de la actualización todavía no se pagó. Las de períodos
    -- ya pagados (contratos anteriores a esta migración) se aplican con los índices que
    -- haya, igual que se venían mostrando, para no trabar el contrato por meses viejos.
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

-- ── Registra un pago: aplica actualizaciones pendientes + mora + marca pagado ──

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
begin
  select * into v_pago from pagos_contrato where id = p_pago_id for update;
  if not found then
    raise exception 'Pago no encontrado.';
  end if;
  if v_pago.estado = 'pagado' then
    raise exception 'Este período ya figura como pagado.';
  end if;

  perform aplicar_actualizaciones_contrato(v_pago.contrato_id, v_pago.periodo_numero);

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

grant execute on function registrar_pago_contrato(uuid, numeric, date, text, numeric, integer) to authenticated;

-- ── Portal del Vecino: exponer los campos nuevos (redefine _portal_contratos de 0027) ──

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
    and ct.finalizado = false
    and (
      lower(trim(ct.propietario_dni)) = any(p_dnis)
      or lower(trim(ct.inquilino_dni)) = any(p_dnis)
    );
$$;

-- ROLLBACK:
-- (re-crear _portal_contratos desde 0027)
-- drop function if exists registrar_pago_contrato(uuid, numeric, date, text, numeric, integer);
-- drop function if exists aplicar_actualizaciones_contrato(uuid, integer);
-- drop table if exists actualizaciones_contrato;
-- alter table cargos_extra_contrato drop constraint if exists cargos_extra_contrato_tipo_check;
-- alter table cargos_extra_contrato drop column if exists tipo;
-- alter table pagos_contrato drop column if exists monto_vigente;
-- alter table contratos drop column if exists deposito_vigente, drop column if exists deposito, drop column if exists interes_mora_diario;
