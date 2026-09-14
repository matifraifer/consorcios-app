-- Recibos de pago de alquiler. Numeracion "0000-00000000": los primeros 4 digitos son
-- la serie (fija, "0001" por ahora) y los ultimos 8 son un correlativo POR CLIENTE
-- (dos clientes distintos pueden tener recibos con el mismo numero).
create table if not exists recibos_numeracion (
  cliente_id uuid primary key references clientes_servicio(id) on delete cascade,
  ultimo_numero integer not null default 0
);

create table if not exists recibos_contrato (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes_servicio(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  pago_id uuid not null unique references pagos_contrato(id) on delete cascade,
  serie text not null default '0001',
  numero integer not null,
  fecha_pago date not null,
  monto numeric not null,
  created_at timestamptz not null default now(),
  unique (cliente_id, serie, numero)
);

alter table recibos_numeracion enable row level security;
alter table recibos_contrato enable row level security;

create policy "recibos_numeracion por cliente" on recibos_numeracion
  for all to authenticated
  using (cliente_id = current_cliente_id())
  with check (cliente_id = current_cliente_id());

create policy "recibos_contrato por cliente" on recibos_contrato
  for all to authenticated
  using (cliente_id = current_cliente_id())
  with check (cliente_id = current_cliente_id());

-- Asigna el proximo numero correlativo del cliente y crea el recibo en una sola
-- transaccion (el upsert en recibos_numeracion toma un row lock, evita numeros
-- duplicados ante pagos registrados en simultaneo).
create or replace function crear_recibo_contrato(
  p_cliente_id uuid,
  p_contrato_id uuid,
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_serie text default '0001'
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

  insert into recibos_contrato (cliente_id, contrato_id, pago_id, serie, numero, fecha_pago, monto)
  values (p_cliente_id, p_contrato_id, p_pago_id, p_serie, v_numero, p_fecha_pago, p_monto)
  returning * into v_recibo;

  return v_recibo;
end;
$$;

grant execute on function crear_recibo_contrato(uuid, uuid, uuid, date, numeric, text) to authenticated;
