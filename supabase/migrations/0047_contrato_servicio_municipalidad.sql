-- Número de cuenta/partida municipal del inmueble (tasas municipales), cargado en la
-- sección "Datos de servicios" del contrato junto a agua/gas/energía. Lo autocompleta
-- la lectura con IA del contrato (extraer-contrato-ia).

alter table contratos
  add column if not exists servicio_municipalidad text;

-- ROLLBACK:
-- alter table contratos drop column if exists servicio_municipalidad;
