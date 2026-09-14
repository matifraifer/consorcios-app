-- Flag de contrato de compraventa (cambia el texto de concepto del recibo:
-- "Cuota del mes..." en vez de "Alquiler del mes...")
alter table contratos add column if not exists es_compraventa boolean not null default false;

-- Direccion del cliente (inmobiliaria/consorcio), usada en el recibo de pago
alter table clientes_servicio add column if not exists direccion text;
