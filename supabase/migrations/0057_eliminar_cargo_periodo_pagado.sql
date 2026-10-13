-- Eliminar un cargo extra de un período YA PAGADO, desde el detalle del contrato (con
-- confirmación). En una sola transacción:
--   1. elimina el cargo,
--   2. ajusta el monto pagado (monto_pagado − monto del cargo; un descuento, que está en
--      negativo, lo sube),
--   3. actualiza el recibo del inquilino y el del propietario con los datos nuevos,
--      conservando su número, y los marca como modificados (modificado_at/_por → el PDF
--      muestra "Recibo modificado el dd/mm/aaaa").
-- El trigger de 0055 sigue bloqueando cualquier otro cambio a cargos de períodos pagados;
-- solo esta función lo saltea (variable de sesión local a la transacción).
-- SECURITY INVOKER: corre con los permisos del usuario (RLS por cliente_id).
-- Requiere 0054 y 0055.

alter table recibos_contrato
  add column if not exists modificado_at timestamptz,
  add column if not exists modificado_por uuid;

alter table recibos_propietario
  add column if not exists modificado_at timestamptz,
  add column if not exists modificado_por uuid;

-- Trigger de 0055 + excepción para eliminar_cargo_periodo_pagado
create or replace function cargos_extra_bloquear_pagados()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.permitir_cargos_pagados', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if exists (
    select 1 from pagos_contrato
    where id in (
      case when tg_op = 'DELETE' then old.pago_id else new.pago_id end,
      case when tg_op = 'UPDATE' then old.pago_id else null end
    )
      and estado = 'pagado'
  ) then
    raise exception 'No se pueden modificar los cargos extra de un período ya pagado.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- p_cargo_id como texto: funciona sea cual sea el tipo de cargos_extra_contrato.id
create or replace function eliminar_cargo_periodo_pagado(p_cargo_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cargo   cargos_extra_contrato%rowtype;
  v_pago    pagos_contrato%rowtype;
  v_pagado  numeric;
  v_cargos  numeric;
  v_alq     numeric;
begin
  select * into v_cargo from cargos_extra_contrato where id::text = p_cargo_id;
  if not found then
    raise exception 'Cargo no encontrado.';
  end if;

  select * into v_pago from pagos_contrato where id = v_cargo.pago_id for update;
  if v_pago.estado <> 'pagado' then
    raise exception 'El período no está pagado: el cargo se elimina normalmente.';
  end if;

  perform set_config('app.permitir_cargos_pagados', 'on', true);
  delete from cargos_extra_contrato where id = v_cargo.id;
  perform set_config('app.permitir_cargos_pagados', 'off', true);

  v_pagado := coalesce(v_pago.monto_pagado, 0) - v_cargo.monto;
  update pagos_contrato set monto_pagado = v_pagado where id = v_pago.id;

  select coalesce(sum(monto), 0) into v_cargos from cargos_extra_contrato where pago_id = v_pago.id;
  v_alq := v_pagado - v_cargos;

  -- Recibo del inquilino: total = monto pagado, cargos = los que quedan
  update recibos_contrato set
    monto = v_pagado,
    cargos_extra = (select coalesce(jsonb_agg(jsonb_build_object('descripcion', descripcion, 'monto', monto, 'tipo', tipo) order by created_at), '[]'::jsonb)
                    from cargos_extra_contrato where pago_id = v_pago.id),
    modificado_at = now(),
    modificado_por = auth.uid()
  where pago_id = v_pago.id;

  -- Recibo del propietario: comisión con el % con que se emitió, solo sobre el alquiler
  update recibos_propietario set
    monto_alquiler = v_alq,
    monto = v_alq * coalesce(comision_pct, 0) / 100,
    descuentos = (select coalesce(jsonb_agg(jsonb_build_object('descripcion', descripcion, 'monto', abs(monto)) order by created_at), '[]'::jsonb)
                  from cargos_extra_contrato where pago_id = v_pago.id and tipo = 'descuento'),
    cargos_extra = (select coalesce(jsonb_agg(jsonb_build_object('descripcion', descripcion, 'monto', monto, 'tipo', tipo) order by created_at), '[]'::jsonb)
                    from cargos_extra_contrato where pago_id = v_pago.id and tipo not in ('mora', 'descuento')),
    modificado_at = now(),
    modificado_por = auth.uid()
  where pago_id = v_pago.id;
end;
$$;

grant execute on function eliminar_cargo_periodo_pagado(text) to authenticated;

-- ROLLBACK:
-- drop function if exists eliminar_cargo_periodo_pagado(text);
-- (re-crear cargos_extra_bloquear_pagados desde 0055)
-- alter table recibos_propietario drop column if exists modificado_por, drop column if exists modificado_at;
-- alter table recibos_contrato drop column if exists modificado_por, drop column if exists modificado_at;
