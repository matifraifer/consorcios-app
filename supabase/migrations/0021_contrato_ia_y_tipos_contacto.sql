-- Marca si un contrato fue cargado autocompletando datos con IA (ver ContratoFormDrawer.jsx)
alter table contratos add column if not exists cargado_ia boolean not null default false;

-- Unifica el tipo de contacto "Arrendatario" (duplicado de "Locatario") en "Locatario",
-- y corrige el mapeo legacy propietario/inquilino: Locatario = inquilino, Locador = propietario.
update contactos
set tipos = array_replace(tipos, 'Arrendatario', 'Locatario')
where 'Arrendatario' = any(tipos);

update contactos
set tipo = 'Locatario'
where tipo = 'Arrendatario';

update contactos
set tipo = 'Locatario'
where tipo = 'Inquilino';

update contactos
set tipo = 'Locador'
where tipo = 'Propietario';
