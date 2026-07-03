-- Fix: permitir que usuarios logueados (rol authenticated) puedan subir/editar/borrar
-- archivos en el bucket propiedades-imagenes. Antes de la Fase 1 (login real con
-- Supabase Auth) todas las requests de la app iban como rol anon, así que las
-- policies de storage.objects probablemente solo cubrían ese rol.
--
-- El bucket ya es público para LECTURA (getPublicUrl no pasa por RLS), esto
-- solo habilita escritura para usuarios logueados. No segmenta por cliente_id
-- todavía (los paths no son uniformes: logos/{cliente_id}/..., portada/{cliente_id}/...,
-- {cliente_id}/{propiedad_id}/...) — eso puede ajustarse más adelante si se quiere
-- aislamiento estricto por tenant también en Storage.

create policy "authenticated_write_propiedades_imagenes_bucket"
on storage.objects for all
to authenticated
using (bucket_id = 'propiedades-imagenes')
with check (bucket_id = 'propiedades-imagenes');
