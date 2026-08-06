-- Integración WhatsApp (Baileys, login por QR). MVP: conectar + mandar/recibir
-- texto plano. Sin vínculo con contactos/prospectos todavía (fase 2).
--
-- whatsapp_sesiones: 1 fila por cliente_id, mantenida por el servicio Node
-- (whatsapp-service) con la service-role key. auth_state guarda las
-- credenciales de Baileys serializadas para sobrevivir un restart sin
-- volver a pedir el QR.
create table if not exists whatsapp_sesiones (
  cliente_id   uuid primary key references clientes_servicio(id),
  estado       text not null default 'desconectado'
               check (estado in ('qr_pendiente', 'conectado', 'desconectado')),
  qr           text,
  numero       text,
  auth_state   jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists whatsapp_mensajes (
  id            bigint generated always as identity primary key,
  cliente_id    uuid not null references clientes_servicio(id),
  telefono      text not null,
  direction     text not null check (direction in ('entrante', 'saliente')),
  body          text not null,
  wa_message_id text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_whatsapp_mensajes_cliente_tel
  on whatsapp_mensajes (cliente_id, telefono, created_at);

alter table whatsapp_sesiones enable row level security;
create policy "tenant_all_whatsapp_sesiones" on whatsapp_sesiones for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table whatsapp_mensajes enable row level security;
create policy "tenant_all_whatsapp_mensajes" on whatsapp_mensajes for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- ROLLBACK:
-- drop policy if exists "tenant_all_whatsapp_mensajes" on whatsapp_mensajes;
-- drop policy if exists "tenant_all_whatsapp_sesiones" on whatsapp_sesiones;
-- drop table if exists whatsapp_mensajes;
-- drop table if exists whatsapp_sesiones;
