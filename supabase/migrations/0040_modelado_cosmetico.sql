-- Detalles de modelado sin impacto funcional (ver ANALISIS_BASE.md, punto 5).

-- periodos_expensas.usuario_id guarda el mismo dato que reclamos.usuario_id
-- (el id de usuarios que lo creó), pero tipado como text en vez de int4 —
-- unificado. Si alguna fila tuviera ahí un valor no numérico, esta línea
-- falla con un error claro de Postgres antes de tocar nada.
alter table public.periodos_expensas
  alter column usuario_id type integer using usuario_id::integer;

-- contactos usaba varchar (sin límite) para columnas equivalentes al resto
-- de la base, que usa text — mismo comportamiento y almacenamiento en
-- Postgres, solo inconsistencia de convención entre migraciones.
alter table public.contactos alter column dni type text;
alter table public.contactos alter column telefono type text;
alter table public.contactos alter column email type text;
alter table public.contactos alter column nombre type text;
alter table public.contactos alter column apellido type text;
