-- Fase 2 (parcial): proteger propiedades, propiedades_imagenes y clientes_servicio
-- manteniendo /p/:id e /inmobiliaria/:clienteId públicas.
--
-- ANTES de correr esto: en el dashboard de Supabase, Database > Policies,
-- borrar las policies "abiertas" existentes en estas 3 tablas
-- (algo como "Enable all access for all users" / USING (true)).
-- Si no las borrás, van a convivir con las nuevas y la restricción no aplica.

-- 0) Helper: cliente_id del usuario logueado actualmente
create or replace function public.current_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cliente_id from usuarios where auth_user_id = auth.uid()
$$;

-- 1) PROPIEDADES
alter table propiedades enable row level security;

create policy "public_select_propiedades"
on propiedades for select
to anon
using (estado <> 'Baja');

create policy "tenant_all_propiedades"
on propiedades for all
to authenticated
using (cliente_id = current_cliente_id())
with check (cliente_id = current_cliente_id());

-- 2) PROPIEDADES_IMAGENES (sin cliente_id propio, se valida vía la propiedad dueña)
alter table propiedades_imagenes enable row level security;

create policy "public_select_propiedades_imagenes"
on propiedades_imagenes for select
to anon
using (
  exists (
    select 1 from propiedades p
    where p.id = propiedades_imagenes.propiedad_id and p.estado <> 'Baja'
  )
);

create policy "tenant_all_propiedades_imagenes"
on propiedades_imagenes for all
to authenticated
using (
  exists (
    select 1 from propiedades p
    where p.id = propiedades_imagenes.propiedad_id and p.cliente_id = current_cliente_id()
  )
)
with check (
  exists (
    select 1 from propiedades p
    where p.id = propiedades_imagenes.propiedad_id and p.cliente_id = current_cliente_id()
  )
);

-- 3) CLIENTES_SERVICIO (lectura pública total, escritura solo del propio cliente)
alter table clientes_servicio enable row level security;

create policy "public_select_clientes_servicio"
on clientes_servicio for select
to anon
using (true);

create policy "tenant_all_clientes_servicio"
on clientes_servicio for all
to authenticated
using (id = current_cliente_id())
with check (id = current_cliente_id());

-- ROLLBACK (por si algo se rompe y hay que volver atrás rápido):
-- drop policy if exists "public_select_propiedades" on propiedades;
-- drop policy if exists "tenant_all_propiedades" on propiedades;
-- drop policy if exists "public_select_propiedades_imagenes" on propiedades_imagenes;
-- drop policy if exists "tenant_all_propiedades_imagenes" on propiedades_imagenes;
-- drop policy if exists "public_select_clientes_servicio" on clientes_servicio;
-- drop policy if exists "tenant_all_clientes_servicio" on clientes_servicio;
-- create policy "open_propiedades" on propiedades for all to anon, authenticated using (true) with check (true);
-- create policy "open_propiedades_imagenes" on propiedades_imagenes for all to anon, authenticated using (true) with check (true);
-- create policy "open_clientes_servicio" on clientes_servicio for all to anon, authenticated using (true) with check (true);
