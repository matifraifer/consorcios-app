-- Log de errores del portal público (sin login, así que no hay otra forma
-- de enterarnos si algo rompe para un vecino real). anon solo puede
-- insertar, nunca leer — la lectura es solo para debug manual (dashboard /
-- SQL Editor / service role).

create table if not exists public.portal_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ruta text,
  contexto text,
  mensaje text,
  detalle jsonb,
  user_agent text
);

alter table public.portal_error_logs enable row level security;

create policy "anon inserta logs del portal"
  on public.portal_error_logs for insert
  to anon
  with check (true);
