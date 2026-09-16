-- Las tablas "hijas" sin cliente_id propio validan su RLS con
-- EXISTS (SELECT 1 FROM tabla_padre WHERE ... AND cliente_id = current_cliente_id()).
-- Sin índice en cliente_id del padre ni en la FK del lado hijo, ese chequeo
-- de autorización hace seq scan en cada lectura (no solo en reportes
-- puntuales). Ver ANALISIS_BASE.md, punto 4.
--
-- CREATE INDEX (sin CONCURRENTLY) toma un lock breve de escritura mientras
-- se construye el índice — aceptable para el tamaño actual de estas tablas.

-- cliente_id en las tablas "padre" que se filtran directo por tenant
create index if not exists idx_prospectos_cliente_id            on public.prospectos (cliente_id);
create index if not exists idx_contratos_cliente_id             on public.contratos (cliente_id);
create index if not exists idx_periodos_expensas_cliente_id     on public.periodos_expensas (cliente_id);
create index if not exists idx_consorcios_cliente_id            on public.consorcios (cliente_id);
create index if not exists idx_contactos_cliente_id             on public.contactos (cliente_id);
create index if not exists idx_propiedades_cliente_id           on public.propiedades (cliente_id);
create index if not exists idx_reclamos_cliente_id              on public.reclamos (cliente_id);

-- FK del lado "hijo" usada en el join del EXISTS
create index if not exists idx_departamentos_id_consorcio       on public.departamentos (id_consorcio);
create index if not exists idx_visitas_prospecto_id             on public.visitas (prospecto_id);
create index if not exists idx_visitas_propiedad_id              on public.visitas (propiedad_id);
create index if not exists idx_pagos_contrato_contrato_id       on public.pagos_contrato (contrato_id);
create index if not exists idx_cargos_extra_contrato_pago_id    on public.cargos_extra_contrato (pago_id);
create index if not exists idx_contratos_adjuntos_contrato_id   on public.contratos_adjuntos (contrato_id);
create index if not exists idx_propiedades_imagenes_propiedad_id on public.propiedades_imagenes (propiedad_id);
create index if not exists idx_historial_prospectos_prospecto_id on public.historial_prospectos (prospecto_id);
create index if not exists idx_propiedades_interes_prospecto_id on public.propiedades_interes (prospecto_id);
create index if not exists idx_propiedades_interes_propiedad_id on public.propiedades_interes (propiedad_id);
create index if not exists idx_contactos_propiedades_contacto_id on public.contactos_propiedades (contacto_id);
create index if not exists idx_contactos_propiedades_propiedad_id on public.contactos_propiedades (propiedad_id);
create index if not exists idx_tareas_etapa_etapa_id            on public.tareas_etapa (etapa_id);
create index if not exists idx_etapas_proyecto_proyecto_id      on public.etapas_proyecto (proyecto_id);
