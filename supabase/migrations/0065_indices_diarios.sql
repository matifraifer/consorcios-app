-- 0065_indices_diarios.sql
-- Serie DIARIA de índices (por ahora solo ICL, variable 40 de la API de Estadísticas
-- Monetarias v4.0 del BCRA). Compartida entre todos los clientes, igual que un índice
-- `externo`: cualquier usuario logueado la lee, solo la Edge Function `sync-indice-icl`
-- (service role) escribe.
--
-- Uso previsto (2da etapa, fuera de la ventana de cobros): el coeficiente de una
-- actualización ICL pasa a ser ICL(fecha de actualización) / ICL(fecha de inicio del
-- período), igual que las calculadoras de mercado, en vez de componer variaciones
-- mensuales.
--
-- Pasos (correr a mano en el SQL Editor):
--   1. Correr este archivo completo (tabla + RLS).
--   2. Deployar la función:  supabase functions deploy sync-indice-icl --no-verify-jwt
--      y cargar su secret:   supabase secrets set SYNC_INDICES_SECRET=<valor-largo-al-azar>
--   3. Invocarla una vez a mano para la carga inicial (desde 2020-07-01), ver el final
--      de este archivo.
--   4. Programar el cron diario (bloque "CRON" al final).

create table if not exists public.indices_diarios (
  tipo        text        not null,
  fecha       date        not null,
  valor       numeric     not null check (valor > 0),
  fuente      text        not null default 'BCRA',
  updated_at  timestamptz not null default now(),
  primary key (tipo, fecha)
);

alter table public.indices_diarios enable row level security;

drop policy if exists indices_diarios_select on public.indices_diarios;
create policy indices_diarios_select on public.indices_diarios
  for select to authenticated using (true);
-- Sin policies de insert/update/delete: solo escribe la service role (bypassa RLS).

-- Valor vigente a una fecha: el de ese día o, si no está publicado, el último anterior.
create or replace function public.indice_diario_a_fecha(p_tipo text, p_fecha date)
returns table (fecha date, valor numeric)
language sql stable
set search_path = public
as $$
  select d.fecha, d.valor
  from indices_diarios d
  where d.tipo = p_tipo and d.fecha <= p_fecha
  order by d.fecha desc
  limit 1
$$;

grant execute on function public.indice_diario_a_fecha(text, date) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- CARGA INICIAL (paso 3) — o desde la terminal:
--   curl -X POST "https://itnibiidhnlgozwbddif.supabase.co/functions/v1/sync-indice-icl" \
--        -H "x-sync-secret: <SYNC_INDICES_SECRET>" -H "Content-Type: application/json" \
--        -d '{"desde":"2020-07-01"}'
--
-- Verificación:
--   select count(*), min(fecha), max(fecha) from indices_diarios where tipo = 'ICL';
--   select * from indice_diario_a_fecha('ICL', '2026-11-01');   -- 37.21


-- ─────────────────────────────────────────────────────────────────────────────
-- CRON (paso 4) — requiere las extensiones pg_cron y pg_net (Database → Extensions).
-- Guardar URL y secret en Vault (una sola vez):
--
--   select vault.create_secret('https://itnibiidhnlgozwbddif.supabase.co/functions/v1/sync-indice-icl', 'sync_indices_url');
--   select vault.create_secret('<SYNC_INDICES_SECRET>', 'sync_indices_secret');
--
-- Programar todos los días a las 10:00 UTC (07:00 Argentina):
--
--   select cron.schedule(
--     'sync-indice-icl-diario',
--     '0 10 * * *',
--     $cron$
--       select net.http_post(
--         url     := (select decrypted_secret from vault.decrypted_secrets where name = 'sync_indices_url'),
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_indices_secret')
--         ),
--         body    := '{}'::jsonb
--       );
--     $cron$
--   );
--
-- Ver ejecuciones:  select * from cron.job_run_details order by start_time desc limit 10;
-- Desprogramar:     select cron.unschedule('sync-indice-icl-diario');
