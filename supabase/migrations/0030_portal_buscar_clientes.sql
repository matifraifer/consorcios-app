-- El buscador de /portal usaba ilike directo sobre clientes_servicio.nombre,
-- que no ignora acentos/ñ (ej: buscar "madueno" no encontraba "Madueño").
-- Se resuelve con una RPC que compara ambos lados normalizados con unaccent.

create extension if not exists unaccent;

create or replace function public.portal_buscar_clientes(p_query text)
returns table (id uuid, nombre text, extension text)
language sql
security definer
set search_path = public
stable
as $$
  select cs.id, cs.nombre, cs.extension
  from clientes_servicio cs
  where cs.estado = 'activo'
    and unaccent(lower(cs.nombre)) ilike '%' || unaccent(lower(trim(p_query))) || '%'
  order by cs.nombre
  limit 8;
$$;

grant execute on function public.portal_buscar_clientes(text) to anon;
