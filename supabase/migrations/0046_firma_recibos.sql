-- Firma de la inmobiliaria en los recibos de pago (inquilino y rendición al propietario).
--
-- - clientes_servicio.firma_path: firma vigente del cliente, cargada desde Configuracion.jsx.
-- - recibos_contrato.file_firma / recibos_propietario.file_firma: snapshot de la firma
--   vigente al momento de crear el recibo. Lo completan las RPC leyendo firma_path (no
--   viene del frontend). Recibos anteriores a esta migración quedan en null (sin firma).
-- - Bucket privado "firmas", path "{cliente_id}/{timestamp}.{ext}". Los archivos nunca se
--   pisan ni se borran (solo insert/select), para que los recibos viejos sigan apuntando
--   a la firma que tenían. El portal público (anon) la obtiene vía la Edge Function
--   firma-recibo, que devuelve una signed URL corta.

alter table clientes_servicio
  add column if not exists firma_path text;

alter table recibos_contrato
  add column if not exists file_firma text;

alter table recibos_propietario
  add column if not exists file_firma text;

-- ── Storage ──────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false)
on conflict (id) do nothing;

drop policy if exists "firmas_select_por_cliente" on storage.objects;
create policy "firmas_select_por_cliente"
on storage.objects for select
to authenticated
using (bucket_id = 'firmas' and (storage.foldername(name))[1] = current_cliente_id()::text);

drop policy if exists "firmas_insert_por_cliente" on storage.objects;
create policy "firmas_insert_por_cliente"
on storage.objects for insert
to authenticated
with check (bucket_id = 'firmas' and (storage.foldername(name))[1] = current_cliente_id()::text);

-- ── RPC: recibo del inquilino ────────────────────────────────────────────

create or replace function crear_recibo_contrato(
  p_cliente_id uuid,
  p_contrato_id uuid,
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_serie text default '0001',
  p_inquilino_nombre text default null,
  p_inquilino_apellido text default null,
  p_direccion_inmueble text default null,
  p_concepto text default null,
  p_cuota_numero integer default null,
  p_periodo_mes date default null,
  p_vencimiento_fecha date default null,
  p_es_compraventa boolean default false,
  p_cargos_extra jsonb default '[]'::jsonb
)
returns recibos_contrato
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
  v_recibo recibos_contrato;
begin
  insert into recibos_numeracion (cliente_id, ultimo_numero)
  values (p_cliente_id, 1)
  on conflict (cliente_id) do update set ultimo_numero = recibos_numeracion.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  insert into recibos_contrato (
    cliente_id, contrato_id, pago_id, serie, numero, fecha_pago, monto,
    inquilino_nombre, inquilino_apellido, direccion_inmueble, concepto,
    cuota_numero, periodo_mes, vencimiento_fecha, es_compraventa, cargos_extra,
    file_firma
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_inquilino_nombre, p_inquilino_apellido, p_direccion_inmueble, p_concepto,
    p_cuota_numero, p_periodo_mes, p_vencimiento_fecha, p_es_compraventa, p_cargos_extra,
    (select firma_path from clientes_servicio where id = p_cliente_id)
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

-- ── RPC: recibo de rendición al propietario ──────────────────────────────

create or replace function crear_recibo_propietario(
  p_cliente_id uuid,
  p_contrato_id uuid,
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_monto_alquiler numeric,
  p_comision_pct numeric,
  p_propietario_nombre text default null,
  p_propietario_apellido text default null,
  p_direccion_inmueble text default null,
  p_cuota_numero integer default null,
  p_periodo_mes date default null,
  p_vencimiento_fecha date default null,
  p_serie text default '0001'
)
returns recibos_propietario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
  v_recibo recibos_propietario;
begin
  insert into recibos_numeracion_propietario (cliente_id, ultimo_numero)
  values (p_cliente_id, 1)
  on conflict (cliente_id) do update set ultimo_numero = recibos_numeracion_propietario.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  insert into recibos_propietario (
    cliente_id, contrato_id, pago_id, serie, numero, fecha_pago, monto,
    monto_alquiler, comision_pct, propietario_nombre, propietario_apellido,
    direccion_inmueble, cuota_numero, periodo_mes, vencimiento_fecha,
    file_firma
  )
  values (
    p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto,
    p_monto_alquiler, p_comision_pct, p_propietario_nombre, p_propietario_apellido,
    p_direccion_inmueble, p_cuota_numero, p_periodo_mes, p_vencimiento_fecha,
    (select firma_path from clientes_servicio where id = p_cliente_id)
  )
  returning * into v_recibo;

  return v_recibo;
end;
$$;

-- ROLLBACK:
-- (re-crear crear_recibo_contrato desde 0043 y crear_recibo_propietario desde 0044)
-- drop policy if exists "firmas_select_por_cliente" on storage.objects;
-- drop policy if exists "firmas_insert_por_cliente" on storage.objects;
-- alter table recibos_propietario drop column if exists file_firma;
-- alter table recibos_contrato drop column if exists file_firma;
-- alter table clientes_servicio drop column if exists firma_path;
