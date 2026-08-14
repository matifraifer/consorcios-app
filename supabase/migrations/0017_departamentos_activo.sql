-- Baja lógica de unidades funcionales ("Eliminar" en la UI no borra el
-- registro, lo inactiva). Postgres aplica el default a las filas existentes
-- al agregar la columna, así que todo lo que ya existe queda activo=true.
alter table public.departamentos add column if not exists activo boolean not null default true;
