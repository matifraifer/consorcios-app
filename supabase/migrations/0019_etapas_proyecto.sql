-- Pantalla "Etapas del proyecto": cada proyecto se divide en etapas
-- (nombre + color, para diferenciarlas visualmente en la grilla/Gantt) y
-- cada etapa agrupa tareas con responsable, estado, costos y fechas.
-- Ninguna de las dos tiene cliente_id propio: la RLS valida en cascada
-- contra proyectos (mismo patrón que "departamentos" valida contra
-- "consorcios", ver 0004_rls_resto_tablas.sql).
create table if not exists etapas_proyecto (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  nombre       text not null,
  color        text,
  created_at   timestamptz not null default now()
);

create table if not exists tareas_etapa (
  id                   uuid primary key default gen_random_uuid(),
  etapa_id             uuid not null references etapas_proyecto(id) on delete cascade,
  nombre               text not null,
  descripcion          text,
  responsable          text,
  estado               text not null default 'pendiente'
                       check (estado in ('pendiente', 'en_curso', 'bloqueado', 'finalizado')),
  costo_presupuestado  numeric,
  costo_real           numeric,
  fecha_inicio         date,
  fecha_fin            date,
  created_at           timestamptz not null default now()
);

create index if not exists idx_etapas_proyecto_proyecto on etapas_proyecto (proyecto_id);
create index if not exists idx_tareas_etapa_etapa on tareas_etapa (etapa_id);

alter table etapas_proyecto enable row level security;
create policy "tenant_all_etapas_proyecto" on etapas_proyecto for all to authenticated
using (exists (select 1 from proyectos p where p.id = etapas_proyecto.proyecto_id and p.cliente_id = current_cliente_id()))
with check (exists (select 1 from proyectos p where p.id = etapas_proyecto.proyecto_id and p.cliente_id = current_cliente_id()));

alter table tareas_etapa enable row level security;
create policy "tenant_all_tareas_etapa" on tareas_etapa for all to authenticated
using (exists (
  select 1 from etapas_proyecto e join proyectos p on p.id = e.proyecto_id
  where e.id = tareas_etapa.etapa_id and p.cliente_id = current_cliente_id()
))
with check (exists (
  select 1 from etapas_proyecto e join proyectos p on p.id = e.proyecto_id
  where e.id = tareas_etapa.etapa_id and p.cliente_id = current_cliente_id()
));

-- ROLLBACK:
-- drop policy if exists "tenant_all_tareas_etapa" on tareas_etapa;
-- drop policy if exists "tenant_all_etapas_proyecto" on etapas_proyecto;
-- drop table if exists tareas_etapa;
-- drop table if exists etapas_proyecto;
