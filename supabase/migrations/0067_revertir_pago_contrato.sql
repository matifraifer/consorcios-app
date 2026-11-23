-- Revertir el pago de un período de alquiler desde el detalle del contrato.
--
-- RPC revertir_pago_contrato (una transacción, roles admin/inmo):
--   - solo el último período pagado del contrato (y contrato no finalizado ni eliminado)
--   - vuelve el pago a 'pendiente' (monto_pagado, fecha_pago y comprobante_path en null;
--     el archivo del comprobante lo borra el frontend con el path que devuelve la RPC)
--   - borra los cargos que genera registrar_pago_contrato y se vuelven a generar al
--     registrar el pago de nuevo: 'mora' y 'deposito_inicial'. Los cargos manuales, los
--     descuentos, la mora condonada y la actualización por índice ya aplicada
--     (monto_vigente, deposito_vigente, cargo 'deposito', actualizaciones_contrato) quedan:
--     al volver a pagar no se aplica dos veces
--   - ANULA (no borra) el recibo del inquilino y el del propietario: conservan su número
--     con anulado_at/anulado_por/motivo_anulacion. El único por pago pasa a ser un índice
--     parcial sobre los no anulados, así el nuevo registro genera recibos nuevos con los
--     próximos números.
--
-- También redefine _portal_contratos (definición de 0056 + filtro de anulados): en
-- producción había quedado activa la versión de 0048 (sin el filtro de contratos
-- eliminados ni mora_condonada).
-- Requiere 0056 y 0057.

-- ── Anulación de recibos ──

alter table recibos_contrato
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid,
  add column if not exists motivo_anulacion text;

alter table recibos_propietario
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid,
  add column if not exists motivo_anulacion text;

alter table recibos_contrato drop constraint if exists recibos_contrato_pago_id_key;
create unique index if not exists recibos_contrato_pago_activo_key
  on recibos_contrato (pago_id) where anulado_at is null;

alter table recibos_propietario drop constraint if exists recibos_propietario_pago_id_key;
create unique index if not exists recibos_propietario_pago_activo_key
  on recibos_propietario (pago_id) where anulado_at is null;

-- ── RPC ──

create or replace function revertir_pago_contrato(p_pago_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pago     pagos_contrato%rowtype;
  v_contrato contratos%rowtype;
  v_rol      text;
  v_motivo   text := nullif(trim(p_motivo), '');
begin
  select lower(rol) into v_rol from usuarios where auth_user_id = auth.uid();
  if v_rol is null or v_rol not in ('admin', 'inmo') then
    raise exception 'No tenés permisos para revertir pagos.';
  end if;

  select * into v_pago from pagos_contrato where id = p_pago_id for update;
  if not found then
    raise exception 'Pago no encontrado.';
  end if;
  if v_pago.estado <> 'pagado' then
    raise exception 'El período no figura como pagado.';
  end if;

  select * into v_contrato from contratos where id = v_pago.contrato_id;
  if v_contrato.finalizado or coalesce(v_contrato.deleted, false) then
    raise exception 'No se puede revertir un pago de un contrato finalizado o eliminado.';
  end if;

  if exists (
    select 1 from pagos_contrato
    where contrato_id = v_pago.contrato_id
      and estado = 'pagado'
      and periodo_numero > v_pago.periodo_numero
  ) then
    raise exception 'Solo se puede revertir el último período pagado del contrato.';
  end if;

  -- Primero el pago a pendiente: así el trigger de 0055 deja borrar sus cargos
  update pagos_contrato
  set estado = 'pendiente',
      monto_pagado = null,
      fecha_pago = null,
      comprobante_path = null
  where id = p_pago_id;

  delete from cargos_extra_contrato
  where pago_id = p_pago_id and tipo in ('mora', 'deposito_inicial');

  update recibos_contrato
  set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo
  where pago_id = p_pago_id and anulado_at is null;

  update recibos_propietario
  set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo
  where pago_id = p_pago_id and anulado_at is null;

  return jsonb_build_object('comprobante_path', v_pago.comprobante_path);
end;
$$;

grant execute on function revertir_pago_contrato(uuid, text) to authenticated;

-- ── eliminar_cargo_periodo_pagado (0057) solo sobre los recibos vigentes ──

create or replace function eliminar_cargo_periodo_pagado(p_cargo_id text)
returns void
language plpgsql
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
  where pago_id = v_pago.id and anulado_at is null;

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
  where pago_id = v_pago.id and anulado_at is null;
end;
$$;

-- ── Portal: _portal_contratos (definición de 0056 + solo el recibo vigente) ──

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
                      'monto_base', pc.monto_base, 'monto_vigente', pc.monto_vigente, 'mora_condonada', pc.mora_condonada,
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
                        from recibos_contrato rc where rc.pago_id = pc.id and rc.anulado_at is null
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

-- ROLLBACK (solo si no hay recibos anulados: con anulados, el unique por pago falla):
-- drop function if exists revertir_pago_contrato(uuid, text);
-- drop index if exists recibos_contrato_pago_activo_key;
-- drop index if exists recibos_propietario_pago_activo_key;
-- alter table recibos_contrato add constraint recibos_contrato_pago_id_key unique (pago_id);
-- alter table recibos_propietario add constraint recibos_propietario_pago_id_key unique (pago_id);
-- alter table recibos_contrato drop column if exists anulado_at, drop column if exists anulado_por, drop column if exists motivo_anulacion;
-- alter table recibos_propietario drop column if exists anulado_at, drop column if exists anulado_por, drop column if exists motivo_anulacion;
-- (re-crear eliminar_cargo_periodo_pagado desde 0057 y _portal_contratos desde 0056)
