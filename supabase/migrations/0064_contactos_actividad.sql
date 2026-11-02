-- Actividad del contacto: recordatorios, comentarios e historial.
--
-- recordatorios_contacto: recordatorios con fecha (y hora opcional), asignados a un usuario
--   (asignado_nombre = usuarios.nombre_usuario, misma convención que contactos.asignado_nombre).
-- contactos_historial: línea de tiempo del contacto. Dos clases de entradas:
--   - 'comentario': las escribe el usuario desde el drawer "Actividad del contacto". Solo el
--     autor puede editarlas o borrarlas.
--   - eventos automáticos (creado, embudo, tipos, asignado, propiedad_vinculada/desvinculada,
--     seguimiento_creado, recordatorio_creado/completado): los cargan triggers en la base, así
--     quedan registrados vengan de donde vengan (formulario, importación, contratos, IA). Los
--     usuarios no pueden insertarlos ni modificarlos (la policy de insert solo admite comentarios;
--     los triggers son SECURITY DEFINER).
-- La vista contactos_listado (0059) se recrea con recordatorios_pendientes y proximo_recordatorio
-- para el indicador de la grilla de Contactos.
--
-- Requiere 0058/0059. Backfill: un evento 'creado' por cada contacto existente.

-- ── Usuario de la sesión ───────────────────────────────────────────────
create or replace function public.current_nombre_usuario()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nombre_usuario from usuarios where auth_user_id = auth.uid() limit 1
$$;

grant execute on function public.current_nombre_usuario() to authenticated;

-- ── Recordatorios ──────────────────────────────────────────────────────
create table if not exists public.recordatorios_contacto (
  id              bigserial primary key,
  cliente_id      uuid not null,
  contacto_id     integer not null references public.contactos(id) on delete cascade,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  fecha           date not null,
  hora            time,
  asignado_nombre text,
  completado      boolean not null default false,
  completado_at   timestamptz,
  completado_por  text,
  creado_por      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists recordatorios_contacto_contacto on public.recordatorios_contacto (contacto_id, completado, fecha);
create index if not exists recordatorios_contacto_asignado on public.recordatorios_contacto (cliente_id, asignado_nombre, completado, fecha);

alter table public.recordatorios_contacto enable row level security;

drop policy if exists "tenant_all_recordatorios_contacto" on public.recordatorios_contacto;
create policy "tenant_all_recordatorios_contacto" on public.recordatorios_contacto for all to authenticated
using (cliente_id = current_cliente_id())
with check (
  cliente_id = current_cliente_id()
  and exists (select 1 from public.contactos c where c.id = contacto_id and c.cliente_id = current_cliente_id())
);

-- ── Historial ──────────────────────────────────────────────────────────
create table if not exists public.contactos_historial (
  id             bigserial primary key,
  cliente_id     uuid not null,
  contacto_id    integer not null references public.contactos(id) on delete cascade,
  tipo           text not null check (tipo in (
                   'comentario', 'creado', 'embudo', 'tipos', 'asignado',
                   'propiedad_vinculada', 'propiedad_desvinculada', 'seguimiento_creado',
                   'recordatorio_creado', 'recordatorio_completado')),
  texto          text,
  detalle        jsonb,
  usuario_nombre text,
  created_at     timestamptz not null default now(),
  editado_at     timestamptz,
  check (tipo <> 'comentario' or length(trim(coalesce(texto, ''))) > 0)
);

create index if not exists contactos_historial_contacto on public.contactos_historial (contacto_id, created_at desc);

alter table public.contactos_historial enable row level security;

drop policy if exists "tenant_select_contactos_historial" on public.contactos_historial;
create policy "tenant_select_contactos_historial" on public.contactos_historial for select to authenticated
using (cliente_id = current_cliente_id());

drop policy if exists "tenant_insert_comentario_historial" on public.contactos_historial;
create policy "tenant_insert_comentario_historial" on public.contactos_historial for insert to authenticated
with check (
  cliente_id = current_cliente_id()
  and tipo = 'comentario'
  and usuario_nombre = current_nombre_usuario()
  and exists (select 1 from public.contactos c where c.id = contacto_id and c.cliente_id = current_cliente_id())
);

drop policy if exists "autor_update_comentario_historial" on public.contactos_historial;
create policy "autor_update_comentario_historial" on public.contactos_historial for update to authenticated
using (cliente_id = current_cliente_id() and tipo = 'comentario' and usuario_nombre = current_nombre_usuario())
with check (cliente_id = current_cliente_id() and tipo = 'comentario' and usuario_nombre = current_nombre_usuario());

drop policy if exists "autor_delete_comentario_historial" on public.contactos_historial;
create policy "autor_delete_comentario_historial" on public.contactos_historial for delete to authenticated
using (cliente_id = current_cliente_id() and tipo = 'comentario' and usuario_nombre = current_nombre_usuario());

-- ── Triggers de eventos automáticos ───────────────────────────────────
create or replace function public._historial_contacto(
  p_contacto_id integer, p_tipo text, p_detalle jsonb, p_usuario text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into contactos_historial (cliente_id, contacto_id, tipo, detalle, usuario_nombre)
  select c.cliente_id, c.id, p_tipo, p_detalle, coalesce(p_usuario, current_nombre_usuario())
  from contactos c where c.id = p_contacto_id
$$;

-- contactos: alta y cambios de embudo / tipos / operador asignado
create or replace function public.trg_historial_contactos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipos_old text[];
  v_tipos_new text[];
begin
  if tg_op = 'INSERT' then
    perform _historial_contacto(new.id, 'creado', jsonb_build_object('origen', new.origen),
                                coalesce(current_nombre_usuario(), new.creado_por));
    return new;
  end if;

  if new.embudo_contacto is distinct from old.embudo_contacto then
    perform _historial_contacto(new.id, 'embudo', jsonb_build_object('de', old.embudo_contacto, 'a', new.embudo_contacto));
  end if;

  v_tipos_old := coalesce(nullif(old.tipos, '{}'), case when old.tipo is not null then array[old.tipo] else '{}'::text[] end);
  v_tipos_new := coalesce(nullif(new.tipos, '{}'), case when new.tipo is not null then array[new.tipo] else '{}'::text[] end);
  if not (v_tipos_old @> v_tipos_new and v_tipos_new @> v_tipos_old) then
    perform _historial_contacto(new.id, 'tipos', jsonb_build_object('de', to_jsonb(v_tipos_old), 'a', to_jsonb(v_tipos_new)));
  end if;

  if new.asignado_nombre is distinct from old.asignado_nombre then
    perform _historial_contacto(new.id, 'asignado', jsonb_build_object('de', old.asignado_nombre, 'a', new.asignado_nombre));
  end if;

  return new;
end;
$$;

drop trigger if exists historial_contactos on public.contactos;
create trigger historial_contactos
after insert or update on public.contactos
for each row execute function public.trg_historial_contactos();

-- contactos_propiedades: vínculos con propiedades
create or replace function public.trg_historial_contactos_propiedades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contacto_id  integer;
  v_propiedad_id uuid;
  v_titulo       text;
begin
  if tg_op = 'DELETE' then
    v_contacto_id := old.contacto_id; v_propiedad_id := old.propiedad_id;
  else
    v_contacto_id := new.contacto_id; v_propiedad_id := new.propiedad_id;
  end if;
  select coalesce(nullif(titulo, ''), direccion, 'Propiedad') into v_titulo from propiedades where id = v_propiedad_id;
  perform _historial_contacto(
    v_contacto_id,
    case when tg_op = 'DELETE' then 'propiedad_desvinculada' else 'propiedad_vinculada' end,
    jsonb_build_object('propiedad_id', v_propiedad_id, 'titulo', v_titulo)
  );
  return null;
end;
$$;

drop trigger if exists historial_contactos_propiedades on public.contactos_propiedades;
create trigger historial_contactos_propiedades
after insert or delete on public.contactos_propiedades
for each row execute function public.trg_historial_contactos_propiedades();

-- prospectos: seguimiento creado para el contacto
create or replace function public.trg_historial_prospectos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa text;
begin
  if new.contacto_id is null then return null; end if;
  select nombre into v_etapa from etapas_crm where id = new.etapa_id;
  perform _historial_contacto(new.contacto_id, 'seguimiento_creado',
                              jsonb_build_object('prospecto_id', new.id, 'etapa', v_etapa));
  return null;
end;
$$;

drop trigger if exists historial_prospectos_contacto on public.prospectos;
create trigger historial_prospectos_contacto
after insert on public.prospectos
for each row execute function public.trg_historial_prospectos();

-- recordatorios: creado y completado
create or replace function public.trg_historial_recordatorios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform _historial_contacto(new.contacto_id, 'recordatorio_creado', jsonb_build_object(
      'recordatorio_id', new.id, 'descripcion', new.descripcion, 'fecha', new.fecha,
      'hora', new.hora, 'asignado', new.asignado_nombre));
  elsif new.completado and not old.completado then
    perform _historial_contacto(new.contacto_id, 'recordatorio_completado', jsonb_build_object(
      'recordatorio_id', new.id, 'descripcion', new.descripcion));
  end if;
  return null;
end;
$$;

drop trigger if exists historial_recordatorios on public.recordatorios_contacto;
create trigger historial_recordatorios
after insert or update on public.recordatorios_contacto
for each row execute function public.trg_historial_recordatorios();

-- ── Vista del listado: indicador de recordatorios ─────────────────────
-- Se recrea (drop + create) porque c.* puede incluir columnas nuevas de contactos y
-- create or replace no permite reordenarlas.
drop view if exists public.contactos_listado;
create view public.contactos_listado
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.contactos_propiedades cp where cp.contacto_id = c.id)::int as propiedades_count,
  (select count(*) from public.recordatorios_contacto r where r.contacto_id = c.id and not r.completado)::int as recordatorios_pendientes,
  (select min(r.fecha) from public.recordatorios_contacto r where r.contacto_id = c.id and not r.completado) as proximo_recordatorio
from public.contactos c;

grant select on public.contactos_listado to authenticated;

-- ── Backfill: evento 'creado' para los contactos existentes ───────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'contactos' and column_name = 'created_at') then
    insert into public.contactos_historial (cliente_id, contacto_id, tipo, detalle, usuario_nombre, created_at)
    select c.cliente_id, c.id, 'creado', jsonb_build_object('origen', c.origen), c.creado_por, coalesce(c.created_at, now())
    from public.contactos c
    where not exists (select 1 from public.contactos_historial h where h.contacto_id = c.id and h.tipo = 'creado');
  else
    insert into public.contactos_historial (cliente_id, contacto_id, tipo, detalle, usuario_nombre)
    select c.cliente_id, c.id, 'creado', jsonb_build_object('origen', c.origen), c.creado_por
    from public.contactos c
    where not exists (select 1 from public.contactos_historial h where h.contacto_id = c.id and h.tipo = 'creado');
  end if;
end $$;

-- Rollback:
-- drop trigger if exists historial_contactos on contactos;
-- drop trigger if exists historial_contactos_propiedades on contactos_propiedades;
-- drop trigger if exists historial_prospectos_contacto on prospectos;
-- drop table if exists contactos_historial; drop table if exists recordatorios_contacto;
-- (y volver a correr 0059 para la vista)
