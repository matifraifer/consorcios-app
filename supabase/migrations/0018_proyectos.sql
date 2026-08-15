-- Módulo "Gestión de proyectos". Primer paso: tabla base de proyectos,
-- listada en /proyectos con costo presupuestado/real y fechas de
-- finalización prevista/real. Etapas, Gantt, costos detallados y equipo
-- se modelan en migraciones posteriores a medida que se construyen esas
-- pantallas.
create table if not exists proyectos (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            uuid not null references clientes_servicio(id),
  nombre                text not null,
  descripcion           text,
  costo_presupuestado   numeric,
  costo_real            numeric,
  fecha_inicio          date,
  fecha_fin_prevista    date,
  fecha_fin_real        date,
  created_at            timestamptz not null default now()
);

create index if not exists idx_proyectos_cliente on proyectos (cliente_id);

alter table proyectos enable row level security;
create policy "tenant_all_proyectos" on proyectos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- ROLLBACK:
-- drop policy if exists "tenant_all_proyectos" on proyectos;
-- drop table if exists proyectos;
