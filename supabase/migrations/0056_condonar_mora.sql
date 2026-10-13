-- Condonar el interés por mora de un período pendiente desde el detalle del contrato.
--
-- La mora de un período pendiente no es un cargo guardado: se calcula en el momento
-- (computeMora) y recién se guarda como cargo al registrar el pago. Con mora_condonada el
-- período deja de mostrar mora en el detalle y en el Portal del Vecino, y el diálogo de
-- pago la trae en 0. Se puede revertir mientras el período siga pendiente.
-- Requiere 0051.

alter table pagos_contrato
  add column if not exists mora_condonada boolean not null default false,
  add column if not exists mora_condonada_at timestamptz,
  add column if not exists mora_condonada_por uuid;

-- ── Portal: _portal_contratos (definición de 0051 + mora_condonada) ──

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
-- (re-crear _portal_contratos desde 0051)
-- alter table pagos_contrato drop column if exists mora_condonada_por, drop column if exists mora_condonada_at, drop column if exists mora_condonada;
