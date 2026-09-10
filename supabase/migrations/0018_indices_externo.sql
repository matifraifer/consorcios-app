-- Agrega la columna "externo" a indices_actualizacion: los índices marcados
-- como externos (externo = true) se ven desde TODOS los clientes; los demás
-- (externo = false o null) siguen viéndose solo desde el cliente que los cargó.
--
-- Reemplaza la policy "tenant_all_indices_actualizacion" (creada a mano fuera
-- de las migraciones trackeadas, junto con la tabla) por 4 policies separadas
-- (select/insert/update/delete) para poder ampliar solo el SELECT.

alter table indices_actualizacion
  add column if not exists externo boolean not null default false;

drop policy if exists "tenant_all_indices_actualizacion" on indices_actualizacion;
-- La tabla nunca se migró al esquema por-cliente: tenía una policy "open" (using true, para ALL)
-- que convive con cualquier policy nueva (son todas permisivas, se combinan con OR) y anula el filtro.
drop policy if exists "open" on indices_actualizacion;

create policy "tenant_select_indices_actualizacion" on indices_actualizacion for select to authenticated
using (cliente_id = current_cliente_id() or externo = true);

create policy "tenant_insert_indices_actualizacion" on indices_actualizacion for insert to authenticated
with check (cliente_id = current_cliente_id());

create policy "tenant_update_indices_actualizacion" on indices_actualizacion for update to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

create policy "tenant_delete_indices_actualizacion" on indices_actualizacion for delete to authenticated
using (cliente_id = current_cliente_id());

-- ROLLBACK:
-- alter table indices_actualizacion drop column if exists externo;
-- drop policy if exists "tenant_select_indices_actualizacion" on indices_actualizacion;
-- drop policy if exists "tenant_insert_indices_actualizacion" on indices_actualizacion;
-- drop policy if exists "tenant_update_indices_actualizacion" on indices_actualizacion;
-- drop policy if exists "tenant_delete_indices_actualizacion" on indices_actualizacion;
-- create policy "tenant_all_indices_actualizacion" on indices_actualizacion for all to authenticated
-- using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());
