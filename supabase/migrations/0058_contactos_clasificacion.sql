-- Clasificación de contactos: origen del contacto, embudo de ventas y nueva lista
-- de tipos de contacto (PROPIETARIO, COMPRADOR, INQUILINO, PROFESIONAL, ...).
--
-- origen_contacto es independiente de la columna "origen" existente (APP/WEB/IMPORTADO),
-- que indica por qué canal se cargó el registro.

alter table public.contactos add column if not exists origen_contacto text;
alter table public.contactos add column if not exists embudo_contacto text;

-- Conversión de los tipos viejos a la lista nueva:
--   Comprador                       -> COMPRADOR
--   Vendedor, Locador, Propietario  -> PROPIETARIO
--   Locatario, Arrendatario, Inquilino -> INQUILINO
-- Cualquier otro valor se pasa a mayúsculas. Se eliminan duplicados manteniendo el orden.
create or replace function pg_temp.convertir_tipo_contacto(t text) returns text
language sql immutable as $$
  select case lower(trim(t))
    when 'comprador'    then 'COMPRADOR'
    when 'vendedor'     then 'PROPIETARIO'
    when 'locador'      then 'PROPIETARIO'
    when 'propietario'  then 'PROPIETARIO'
    when 'locatario'    then 'INQUILINO'
    when 'arrendatario' then 'INQUILINO'
    when 'inquilino'    then 'INQUILINO'
    else upper(trim(t))
  end
$$;

update public.contactos c
set tipos = conv.tipos,
    tipo  = conv.tipos[1]
from (
  select id,
         array(
           select t from (
             select pg_temp.convertir_tipo_contacto(x.t) as t, min(x.ord) as ord
             from unnest(coalesce(nullif(ct.tipos, '{}'), case when ct.tipo is not null then array[ct.tipo] end))
                  with ordinality as x(t, ord)
             where x.t is not null and trim(x.t) <> ''
             group by 1
           ) s order by s.ord
         ) as tipos
  from public.contactos ct
  where ct.tipo is not null or coalesce(array_length(ct.tipos, 1), 0) > 0
) conv
where conv.id = c.id;
