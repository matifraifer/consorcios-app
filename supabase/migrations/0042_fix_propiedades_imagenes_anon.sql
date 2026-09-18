-- Segundo efecto colateral de 0037_propiedades_publicas_view.sql (ver
-- FIX_PROPIEDADES_PUBLICAS.md, Parte 2). La policy pública de
-- propiedades_imagenes (0002_rls_propiedades_clientes.sql) valida con:
--   exists (select 1 from propiedades p where p.id = ... and p.estado <> 'Baja')
-- Esa subconsulta corre con los privilegios del rol que consulta (anon), no
-- es SECURITY DEFINER. Al revocarle a anon el SELECT completo sobre
-- propiedades en 0037, el EXISTS quedó inevaluable y las fotos del catálogo
-- público (/inmobiliaria/:clienteId, /p/:id) dejaron de cargar para
-- visitantes sin sesión.
--
-- Fix: grant a nivel de columna, solo sobre las 2 columnas que el EXISTS
-- necesita (id, estado) — no reabre la fuga de comprador_dni/telefono/
-- observaciones_internas/etc., esas columnas siguen sin grant.

grant select (id, estado) on public.propiedades to anon;
