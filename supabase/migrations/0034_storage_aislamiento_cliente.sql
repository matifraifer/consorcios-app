-- El bucket propiedades-imagenes permitía escritura a cualquier usuario
-- authenticated sin importar el cliente_id del path (ver ANALISIS_SEGURIDAD.md,
-- punto 5) — un usuario logueado de la inmobiliaria A podía sobrescribir o
-- borrar fotos/logos/portadas de la inmobiliaria B si conocía (o adivinaba)
-- su cliente_id. Se acota la policy al cliente_id del propio usuario,
-- contemplando los 3 patrones de path que usa el frontend:
--   logos/{cliente_id}/...        (uploadClienteLogo)
--   portada/{cliente_id}/...      (uploadPortadaImage)
--   {cliente_id}/{propiedad_id}/... (uploadPropiedadImagen)
-- La lectura pública no se toca: sigue siendo vía getPublicUrl, que no pasa
-- por RLS (el bucket sigue siendo público para GET).

drop policy if exists "authenticated_write_propiedades_imagenes_bucket" on storage.objects;

create policy "authenticated_write_propiedades_imagenes_bucket"
on storage.objects for all
to authenticated
using (
  bucket_id = 'propiedades-imagenes' and (
    (
      (storage.foldername(name))[1] in ('logos', 'portada')
      and (storage.foldername(name))[2] = current_cliente_id()::text
    )
    or
    (
      (storage.foldername(name))[1] not in ('logos', 'portada')
      and (storage.foldername(name))[1] = current_cliente_id()::text
    )
  )
)
with check (
  bucket_id = 'propiedades-imagenes' and (
    (
      (storage.foldername(name))[1] in ('logos', 'portada')
      and (storage.foldername(name))[2] = current_cliente_id()::text
    )
    or
    (
      (storage.foldername(name))[1] not in ('logos', 'portada')
      and (storage.foldername(name))[1] = current_cliente_id()::text
    )
  )
);
