-- Fix: el portal público (/inmobiliaria/:clienteId, /p/:id) devolvía
-- "no encontró la inmobiliaria" cuando quien entraba estaba logueado con
-- OTRO cliente_id. Las policies de lectura pública de 0002 eran "to anon"
-- únicamente, así que un usuario "authenticated" solo veía su propio
-- cliente_id vía "tenant_all_clientes_servicio" (using (id = current_cliente_id())).
-- Se reemplazan por "to anon, authenticated" para que el catálogo público
-- se vea igual haya o no sesión iniciada.

drop policy if exists "public_select_propiedades" on propiedades;
create policy "public_select_propiedades"
on propiedades for select
to anon, authenticated
using (estado <> 'Baja');

drop policy if exists "public_select_propiedades_imagenes" on propiedades_imagenes;
create policy "public_select_propiedades_imagenes"
on propiedades_imagenes for select
to anon, authenticated
using (
  exists (
    select 1 from propiedades p
    where p.id = propiedades_imagenes.propiedad_id and p.estado <> 'Baja'
  )
);

drop policy if exists "public_select_clientes_servicio" on clientes_servicio;
create policy "public_select_clientes_servicio"
on clientes_servicio for select
to anon, authenticated
using (true);

-- ROLLBACK:
-- drop policy if exists "public_select_propiedades" on propiedades;
-- create policy "public_select_propiedades" on propiedades for select to anon using (estado <> 'Baja');
-- drop policy if exists "public_select_propiedades_imagenes" on propiedades_imagenes;
-- create policy "public_select_propiedades_imagenes" on propiedades_imagenes for select to anon using (exists (select 1 from propiedades p where p.id = propiedades_imagenes.propiedad_id and p.estado <> 'Baja'));
-- drop policy if exists "public_select_clientes_servicio" on clientes_servicio;
-- create policy "public_select_clientes_servicio" on clientes_servicio for select to anon using (true);
