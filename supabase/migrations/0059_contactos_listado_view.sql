-- Vista para el listado paginado de Contactos (Contactos.jsx → getContactosPaginados).
-- Agrega propiedades_count para poder filtrar ("con/sin propiedades") y ordenar por
-- cantidad de propiedades del lado del servidor.
--
-- Requiere 0058 (c.* se resuelve al crear la vista: si se crea antes, no incluye
-- origen_contacto/embudo_contacto). Si más adelante se agregan columnas a contactos,
-- hay que volver a correr este create or replace para que la vista las incluya.
--
-- security_invoker = true: la vista se consulta con los permisos del usuario, así que
-- aplica la RLS de contactos/contactos_propiedades (aislamiento por cliente_id).

create or replace view public.contactos_listado
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.contactos_propiedades cp where cp.contacto_id = c.id)::int as propiedades_count
from public.contactos c;

grant select on public.contactos_listado to authenticated;

-- Índice para el filtro por tipo (contactos.tipos @> array[...])
create index if not exists contactos_tipos_gin on public.contactos using gin (tipos);
create index if not exists contactos_cliente_activo_apellido on public.contactos (cliente_id, activo, apellido, nombre);
create index if not exists contactos_propiedades_contacto_id on public.contactos_propiedades (contacto_id);
