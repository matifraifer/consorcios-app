-- Agrega la columna "creado_por" a contactos: guarda el nombre_usuario de quien
-- cargó el contacto, para poder filtrar por operador en la pantalla de Contactos.
alter table public.contactos add column if not exists creado_por text;
