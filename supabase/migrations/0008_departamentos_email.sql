-- Agrega la columna "email" a departamentos, para poder cargar el mail de
-- contacto de la unidad (inquilino/propietario) desde el drawer de edición.
alter table public.departamentos add column if not exists email text;
