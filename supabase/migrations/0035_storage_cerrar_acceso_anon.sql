-- Se detectó (consultando pg_policies en producción, no trackeado hasta
-- ahora en ninguna migración del repo) que 3 buckets de Storage tenían
-- acceso de escritura y/o lectura abierto a "anon"/"public" (cualquiera en
-- internet, sin login), no solo sin aislamiento por cliente como
-- documentaba el punto 5 original de ANALISIS_SEGURIDAD.md:
--   - propiedades-imagenes: INSERT/DELETE abiertos a anon (de sobra: ya
--     tiene su propia policy de authenticated con aislamiento por cliente,
--     ver 0034_storage_aislamiento_cliente.sql; la lectura pública sigue
--     funcionando vía getPublicUrl, que no pasa por RLS).
--   - documentos-respaldatorios: SELECT/INSERT/DELETE abiertos a anon.
--   - contratos-adjuntos: SELECT/INSERT/UPDATE/DELETE abiertos a "public"
--     (rol que en Postgres incluye tanto anon como authenticated).
-- Ninguno de estos dos últimos buckets se usa desde ninguna página pública
-- del frontend (PropiedadPublica.jsx, InmobiliariaPublica.jsx,
-- PortalVecino.jsx) — solo desde componentes de admin logueado
-- (ContratoDetalleDrawer.jsx, DocumentacionRespaldatoriaSection.jsx), así
-- que no hay ningún caso de uso legítimo para anon ahí.
--
-- Fase 1: cerrar el acceso público, restringir a authenticated (sin
-- aislamiento por cliente_id todavía en estos dos buckets — los paths no
-- lo incluyen, eso queda para una Fase 2 aparte, ver ANALISIS_SEGURIDAD.md).

drop policy if exists "Allow anon delete q68zlk_0" on storage.objects;
drop policy if exists "Allow anon delete q68zlk_1" on storage.objects;
drop policy if exists "Allow anon upload q68zlk_0" on storage.objects;
drop policy if exists "anon puede subir a propiedades-imagenes" on storage.objects;

drop policy if exists "anon puede borrar documentos-respaldatorios" on storage.objects;
drop policy if exists "anon puede leer documentos-respaldatorios" on storage.objects;
drop policy if exists "anon puede subir documentos-respaldatorios" on storage.objects;

drop policy if exists "open storage contratos dltij2_0" on storage.objects;
drop policy if exists "open storage contratos dltij2_1" on storage.objects;
drop policy if exists "open storage contratos dltij2_2" on storage.objects;
drop policy if exists "open storage contratos dltij2_3" on storage.objects;

create policy "authenticated_all_documentos_respaldatorios_bucket"
on storage.objects for all
to authenticated
using (bucket_id = 'documentos-respaldatorios')
with check (bucket_id = 'documentos-respaldatorios');

create policy "authenticated_all_contratos_adjuntos_bucket"
on storage.objects for all
to authenticated
using (bucket_id = 'contratos-adjuntos')
with check (bucket_id = 'contratos-adjuntos');
