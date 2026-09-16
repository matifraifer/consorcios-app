-- email_for_username era un oráculo de enumeración: cualquiera podía pegarle
-- directo a la RPC (grant a anon) y confirmar qué nombre_usuario existen y
-- su email asociado. La resolución username->email se mueve a la Edge
-- Function resolve-username, que sí puede ver la IP real de quien llama
-- (la RPC vía PostgREST no — ve la IP del pooler) y rate-limitarla; la
-- función consulta la tabla usuarios directo con la service-role key, así
-- que esta RPC queda sin uso y se elimina en vez de dejarla huérfana.

drop function if exists public.email_for_username(text);

create table if not exists public.resolve_username_intentos (
  id         bigserial primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);

create index if not exists resolve_username_intentos_ip_created_at_idx
  on public.resolve_username_intentos (ip, created_at);

alter table public.resolve_username_intentos enable row level security;
-- Sin policies: nadie (ni anon ni authenticated) puede leer/escribir esta
-- tabla directo. Solo la Edge Function la toca, con la service-role key.
