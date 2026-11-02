-- Marca las propiedades cargadas con autocompletado por IA (desde documentos en el alta de
-- propiedad, o creadas automáticamente al cargar un contrato con IA). Misma convención que
-- contratos.cargado_ia (0021). Se muestra como indicador "IA" en la grilla de propiedades.
-- Las propiedades ya existentes quedan en false.

alter table public.propiedades add column if not exists cargado_ia boolean not null default false;

-- Rollback:
-- alter table public.propiedades drop column if exists cargado_ia;
