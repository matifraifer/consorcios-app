-- cliente_id nullable en tablas centrales del modelo multi-tenant: si algún
-- proceso con service_role (que bypassa RLS) inserta por error una fila con
-- cliente_id = null, esa fila queda huérfana (invisible para todos los
-- tenants, pero sigue ocupando espacio y puede romper joins/reportes
-- agregados sin que nadie entienda por qué). No es una fuga de seguridad
-- (falla "cerrado"), es integridad de datos. Ver ANALISIS_BASE.md, punto 3.
--
-- Cada ALTER valida las filas existentes automáticamente: si alguna tabla
-- tiene hoy una fila con cliente_id null, esta migración falla ahí mismo
-- (transacción completa, nada queda a medio aplicar) con un error de
-- Postgres que nombra la tabla y columna — hay que backfillear esa fila
-- antes de poder correr esto.

alter table public.consorcios            alter column cliente_id set not null;
alter table public.propietarios          alter column cliente_id set not null;
alter table public.reclamos              alter column cliente_id set not null;
alter table public.periodos_expensas     alter column cliente_id set not null;
alter table public.propiedades           alter column cliente_id set not null;
alter table public.prospectos            alter column cliente_id set not null;
alter table public.contactos             alter column cliente_id set not null;
alter table public.indices_actualizacion alter column cliente_id set not null;
alter table public.consultas_web         alter column cliente_id set not null;
