-- Recordatorios automáticos de expensas por WhatsApp (Twilio), N días antes
-- del vencimiento. Convive con la integración Baileys existente (mensajería
-- manual, whatsapp_sesiones/whatsapp_mensajes) — esta es un canal aparte.
--
-- La cuenta de Twilio es única para toda la plataforma (un solo número,
-- no una por consorcio/cliente) — las credenciales viven como secrets de
-- la Edge Function (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_NUMBER),
-- no en una tabla por cliente.

alter table public.departamentos add column if not exists telefono text;
alter table public.consorcios add column if not exists dias_recordatorio_previo integer;
-- null = recordatorios automáticos desactivados para ese consorcio

create table if not exists public.recordatorios_whatsapp_enviados (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes_servicio(id),
  periodo_id      integer not null references public.periodos_expensas(id),
  departamento_id integer not null references public.departamentos(id),
  telefono        text not null,
  estado          text not null default 'enviado' check (estado in ('enviado', 'error')),
  error_detalle   text,
  created_at      timestamptz not null default now(),
  unique (periodo_id, departamento_id)
);

alter table public.recordatorios_whatsapp_enviados enable row level security;

create policy "tenant_select_recordatorios" on public.recordatorios_whatsapp_enviados for select to authenticated
using (cliente_id = current_cliente_id());

-- Los inserts sobre esta tabla los hace la Edge Function
-- enviar-recordatorios-whatsapp con la service-role key (bypassa RLS),
-- igual que mp_tokens/mp_pagos.

-- ---------------------------------------------------------------------
-- Paso manual aparte, recién después de probar la Edge Function a mano:
-- habilita el cron diario que la invoca. Reemplazar <PROJECT_REF> y
-- <ANON_KEY> por los valores reales del proyecto antes de correr esto.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;
--
-- select cron.schedule(
--   'recordatorios-whatsapp-diario',
--   '0 12 * * *', -- 12:00 UTC = 9:00 ART
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-recordatorios-whatsapp',
--     headers := '{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
