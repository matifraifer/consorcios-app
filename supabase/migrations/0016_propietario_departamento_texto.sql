-- Unifica las grillas de Propietarios y Departamentos en ConsorcioDetalle.jsx:
-- el propietario pasa a cargarse como texto plano directo en el departamento
-- (nombre/apellido/DNI), reemplazando el desplegable contra la tabla
-- propietarios (FK departamentos.id_propietario) en los formularios de alta.
-- Misma convención de columnas que ya usa "contratos" (propietario_nombre/
-- apellido/dni).
--
-- La tabla propietarios y la columna departamentos.id_propietario NO se
-- borran (siguen usándose desde Reclamos y la página global /propietarios,
-- y sirven de dato histórico) — solo se dejan de escribir desde los
-- formularios de "nuevo departamento".

alter table public.departamentos add column if not exists propietario_nombre text;
alter table public.departamentos add column if not exists propietario_apellido text;
alter table public.departamentos add column if not exists propietario_dni text;

-- Backfill: copia los datos del propietario ya vinculado por FK.
update public.departamentos d
set propietario_nombre = p.nombre,
    propietario_apellido = p.apellido,
    propietario_dni = p.dni
from public.propietarios p
where d.id_propietario = p.id
  and d.propietario_nombre is null;
