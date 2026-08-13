-- Integración Mercado Pago (Checkout Pro) para cobro de expensas.
-- Cada cliente (consorcio) conecta su propia cuenta de MP vía OAuth Connect;
-- el dinero entra directo a esa cuenta. mp_pagos registra cada intento de pago
-- generado desde la consulta pública de deuda (/consulta/:token) para poder
-- conciliar el webhook de MP contra el departamento/períodos correctos.

create table if not exists public.mp_tokens (
  cliente_id    uuid primary key references public.clientes_servicio(id),
  access_token  text not null,
  refresh_token text not null,
  public_key    text,
  mp_user_id    text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.mp_tokens enable row level security;

create policy "tenant_all_mp_tokens" on public.mp_tokens for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

create table if not exists public.mp_pagos (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes_servicio(id),
  departamento_id  integer not null references public.departamentos(id),
  periodos_ids     integer[] not null,
  monto            numeric(12,2) not null,
  preference_id    text,
  mp_payment_id    text,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.mp_pagos enable row level security;

create policy "tenant_all_mp_pagos" on public.mp_pagos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- Los inserts/updates sobre estas dos tablas los hacen las Edge Functions
-- (mp-auth, mp-crear-preferencia, mp-webhook) con la service-role key, que
-- bypasea RLS — igual que whatsapp_sesiones/whatsapp_mensajes.
