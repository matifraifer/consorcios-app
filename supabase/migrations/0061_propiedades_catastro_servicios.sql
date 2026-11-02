-- Nomenclatura catastral y cuentas de servicios pasan de contratos a propiedades
-- (son datos del inmueble, no cambian con el inquilino).
--
-- 1. Agrega las columnas a propiedades.
-- 2. Copia los datos ya cargados en contratos con propiedad vinculada: para cada
--    propiedad y CADA CAMPO por separado, toma el valor del contrato más reciente que
--    lo tenga (primero los no eliminados, después fecha_inicio y created_at más nuevos).
--    Solo completa campos vacíos de la propiedad: se puede volver a correr sin pisar nada
--    (correrla de nuevo después de deployar el frontend, para tomar lo cargado en el medio).
--
-- Las columnas de contratos NO se borran: quedan como respaldo de los contratos sin
-- propiedad vinculada. El frontend ya no las escribe (salvo ese caso) y las vacía al
-- mover los datos a la propiedad. Se borrarán en una migración aparte.
--
-- No se agregan a la vista propiedades_publicas (0037): son datos internos.
-- Requiere 0022, 0047 y 0051 (contratos.deleted).

alter table public.propiedades
  add column if not exists nomenclatura_catastral text,
  add column if not exists servicio_agua          text,
  add column if not exists servicio_gas           text,
  add column if not exists servicio_energia       text,
  add column if not exists servicio_municipalidad text;

with valores as (
  select c.propiedad_id, v.campo, trim(v.valor) as valor,
         row_number() over (
           partition by c.propiedad_id, v.campo
           order by coalesce(c.deleted, false), c.fecha_inicio desc nulls last, c.created_at desc
         ) as rn
  from public.contratos c
  cross join lateral (values
    ('nomenclatura_catastral', c.nomenclatura_catastral),
    ('servicio_agua',          c.servicio_agua),
    ('servicio_gas',           c.servicio_gas),
    ('servicio_energia',       c.servicio_energia),
    ('servicio_municipalidad', c.servicio_municipalidad)
  ) as v(campo, valor)
  where c.propiedad_id is not null
    and nullif(trim(v.valor), '') is not null
),
elegidos as (
  select propiedad_id,
         max(valor) filter (where campo = 'nomenclatura_catastral') as nomenclatura_catastral,
         max(valor) filter (where campo = 'servicio_agua')          as servicio_agua,
         max(valor) filter (where campo = 'servicio_gas')           as servicio_gas,
         max(valor) filter (where campo = 'servicio_energia')       as servicio_energia,
         max(valor) filter (where campo = 'servicio_municipalidad') as servicio_municipalidad
  from valores
  where rn = 1
  group by propiedad_id
)
update public.propiedades p set
  nomenclatura_catastral = coalesce(nullif(trim(p.nomenclatura_catastral), ''), e.nomenclatura_catastral),
  servicio_agua          = coalesce(nullif(trim(p.servicio_agua), ''),          e.servicio_agua),
  servicio_gas           = coalesce(nullif(trim(p.servicio_gas), ''),           e.servicio_gas),
  servicio_energia       = coalesce(nullif(trim(p.servicio_energia), ''),       e.servicio_energia),
  servicio_municipalidad = coalesce(nullif(trim(p.servicio_municipalidad), ''), e.servicio_municipalidad)
from elegidos e
where e.propiedad_id = p.id
  and (
       (nullif(trim(p.nomenclatura_catastral), '') is null and e.nomenclatura_catastral is not null)
    or (nullif(trim(p.servicio_agua), '')          is null and e.servicio_agua          is not null)
    or (nullif(trim(p.servicio_gas), '')           is null and e.servicio_gas           is not null)
    or (nullif(trim(p.servicio_energia), '')       is null and e.servicio_energia       is not null)
    or (nullif(trim(p.servicio_municipalidad), '') is null and e.servicio_municipalidad is not null)
  );

-- Verificación posterior (correr aparte):
-- Contratos sin propiedad que todavía tienen datos en las columnas viejas
-- select id, inquilino_apellido, propietario_apellido, nomenclatura_catastral, servicio_agua,
--        servicio_gas, servicio_energia, servicio_municipalidad
-- from contratos
-- where propiedad_id is null and coalesce(deleted, false) = false
--   and coalesce(nomenclatura_catastral, servicio_agua, servicio_gas, servicio_energia, servicio_municipalidad) is not null;
--
-- Rollback:
-- alter table propiedades drop column if exists nomenclatura_catastral, drop column if exists servicio_agua,
--   drop column if exists servicio_gas, drop column if exists servicio_energia, drop column if exists servicio_municipalidad;
