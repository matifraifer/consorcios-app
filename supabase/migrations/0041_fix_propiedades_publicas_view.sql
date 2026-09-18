-- Fix de 0037_propiedades_publicas_view.sql: con security_invoker = true,
-- Postgres exige que el rol que consulta la vista (anon) tenga privilegios
-- también sobre la tabla base (propiedades) — pero esa misma migración le
-- revoca el SELECT a anon sobre propiedades, así que la vista quedó
-- inutilizable para anon ("permission denied for table propiedades"). El
-- catálogo público (/inmobiliaria/:clienteId, /p/:id) funcionaba en
-- desarrollo/pruebas porque un usuario logueado (rol authenticated, que sí
-- conserva su SELECT sobre propiedades) enmascara el bug; un visitante real
-- sin sesión lo sufre siempre. Ver FIX_PROPIEDADES_PUBLICAS.md.
--
-- Sin security_invoker, la vista corre con los privilegios de quien la creó
-- (alcanza con el grant sobre la vista, no hace falta tocar la tabla base),
-- pero deja de heredar automáticamente la policy de RLS de la tabla — se
-- replica ese filtro (estado <> 'Baja') a mano en el WHERE de la vista.
--
-- El revoke de anon sobre propiedades de 0037 NO se toca: sigue siendo lo
-- que cierra la fuga original, la vista pasa a ser el único punto público.

create or replace view public.propiedades_publicas as
select
  id, cliente_id, titulo, tipo_propiedad, tipo_operacion, estado,
  precio_publicacion, moneda, direccion, localidad, provincia,
  latitud, longitud, ambientes, dormitorios, banios, cochera,
  metros_cubiertos, metros_totales, descripcion, created_at, updated_at
from public.propiedades
where estado <> 'Baja';
