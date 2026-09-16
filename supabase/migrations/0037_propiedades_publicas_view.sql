-- RLS en Postgres/PostgREST filtra FILAS, no columnas. La policy
-- public_select_propiedades (0002_rls_propiedades_clientes.sql) permite a
-- `anon` ver cualquier propiedad no dada de baja, pero con la `anon key`
-- (pública, está en el bundle del frontend) cualquiera puede pedir por REST
-- cualquier columna de esas filas — incluidas comprador_nombre/dni/telefono,
-- precio_final_venta y observaciones_internas, que nunca deberían ser
-- públicas (son datos internos o de terceros que ni siquiera son usuarios de
-- la plataforma). getPropiedadPublica() en supabase.js incluso hace
-- select('*'), así que hoy esos datos ya viajan por la red en la página
-- pública real, no solo en un curl armado a mano.
--
-- Fix: vista con solo las columnas realmente públicas, con
-- security_invoker para que siga aplicando la RLS de la tabla base con el
-- rol de quien consulta (no el del dueño de la vista) — así no se duplica
-- la condición de filas acá. Se revoca el SELECT directo de `anon` sobre la
-- tabla completa; `authenticated` no se toca (tenant_all_propiedades ya lo
-- acota por cliente_id, y el panel admin necesita todas las columnas).

create or replace view public.propiedades_publicas
with (security_invoker = true) as
select
  id, cliente_id, titulo, tipo_propiedad, tipo_operacion, estado,
  precio_publicacion, moneda, direccion, localidad, provincia,
  latitud, longitud, ambientes, dormitorios, banios, cochera,
  metros_cubiertos, metros_totales, descripcion, created_at, updated_at
from public.propiedades;

revoke select on public.propiedades from anon;
grant select on public.propiedades_publicas to anon;
