-- Campos de ubicación y título de propiedades opcionales en la base, igual que en el
-- formulario (PropiedadFormDrawer.jsx no los exige). localidad tenía NOT NULL configurado a
-- mano desde el dashboard (no está en ninguna migración) y el alta fallaba con
-- "null value in column localidad" cuando no se cargaba. drop not null no hace nada si la
-- columna ya acepta null, así que se incluyen las demás columnas opcionales del form.

alter table public.propiedades
  alter column localidad drop not null,
  alter column provincia drop not null,
  alter column direccion drop not null,
  alter column titulo    drop not null;

-- Para revisar si queda alguna otra columna obligatoria (correr aparte):
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'propiedades' and is_nullable = 'NO'
-- order by ordinal_position;
