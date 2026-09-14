-- Nomenclatura catastral + numeros de cuenta/suministro de servicios en contratos
-- Ademas, propiedad_id pasa a ser opcional (el contrato puede vincularse despues)
alter table contratos add column if not exists nomenclatura_catastral text;
alter table contratos add column if not exists servicio_agua text;
alter table contratos add column if not exists servicio_gas text;
alter table contratos add column if not exists servicio_energia text;
alter table contratos add column if not exists propietario_telefono text;
alter table contratos add column if not exists inquilino_telefono text;

alter table contratos alter column propiedad_id drop not null;
