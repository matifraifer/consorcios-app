-- Fase 2 (resto de las tablas): aislar cada tabla por cliente_id (directo o
-- vía FK), usando el mapa de foreign keys real del proyecto.
-- Requiere que 0001-0003 ya estén aplicadas (current_cliente_id() debe existir).
--
-- ANTES de correr esto: en el dashboard, Database > Policies, borrar las
-- policies "abiertas" de TODAS las tablas listadas abajo (si no, conviven
-- con las nuevas y la restricción no aplica).
--
-- Tablas con cliente_id DIRECTO en la propia fila: acceso total (select/
-- insert/update/delete) para authenticated, solo si cliente_id = current_cliente_id().
-- Tablas SIN cliente_id directo: se valida vía la tabla padre (FK), con
-- subquery EXISTS.
-- Tablas globales/compartidas entre clientes (etapas_crm, propiedades_ext):
-- solo lectura para authenticated, sin filtro de cliente_id.
-- usuarios y tipos_documentacion: la app solo los LEE desde el frontend
-- (el alta se hace a mano), así que solo tienen policy de SELECT.

-- ============ GRUPO A: cliente_id directo ============

alter table consorcios enable row level security;
create policy "tenant_all_consorcios" on consorcios for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table propietarios enable row level security;
create policy "tenant_all_propietarios" on propietarios for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table reclamos enable row level security;
create policy "tenant_all_reclamos" on reclamos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table periodos_expensas enable row level security;
create policy "tenant_all_periodos_expensas" on periodos_expensas for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table contactos enable row level security;
create policy "tenant_all_contactos" on contactos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table prospectos enable row level security;
create policy "tenant_all_prospectos" on prospectos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table contratos enable row level security;
create policy "tenant_all_contratos" on contratos for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table documentos_respaldatorios enable row level security;
create policy "tenant_all_documentos_respaldatorios" on documentos_respaldatorios for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

alter table contactos_propiedades_ext enable row level security;
create policy "tenant_all_contactos_propiedades_ext" on contactos_propiedades_ext for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- ml_tokens: feature de MercadoLibre deshabilitada, se protege igual por las dudas
alter table ml_tokens enable row level security;
create policy "tenant_all_ml_tokens" on ml_tokens for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- consultas_web: cliente_id directo + necesita permitir alta pública (formulario
-- de contacto en /p/:id y /inmobiliaria/:clienteId). Antes de esto, cualquiera
-- con la anon key también podía LEER todos los leads (dni, telefono, email,
-- presupuesto) de todos los clientes -- esto lo cierra.
alter table consultas_web enable row level security;
create policy "public_insert_consultas_web" on consultas_web for insert to anon
with check (true);
create policy "tenant_all_consultas_web" on consultas_web for all to authenticated
using (cliente_id = current_cliente_id()) with check (cliente_id = current_cliente_id());

-- ============ GRUPO B: 1 hop vía FK ============

alter table departamentos enable row level security;
create policy "tenant_all_departamentos" on departamentos for all to authenticated
using (exists (select 1 from consorcios c where c.id = departamentos.id_consorcio and c.cliente_id = current_cliente_id()))
with check (exists (select 1 from consorcios c where c.id = departamentos.id_consorcio and c.cliente_id = current_cliente_id()));

alter table gastos enable row level security;
create policy "tenant_all_gastos" on gastos for all to authenticated
using (exists (select 1 from periodos_expensas pe where pe.id = gastos.periodo_id and pe.cliente_id = current_cliente_id()))
with check (exists (select 1 from periodos_expensas pe where pe.id = gastos.periodo_id and pe.cliente_id = current_cliente_id()));

alter table expensas_departamento enable row level security;
create policy "tenant_all_expensas_departamento" on expensas_departamento for all to authenticated
using (exists (select 1 from periodos_expensas pe where pe.id = expensas_departamento.periodo_id and pe.cliente_id = current_cliente_id()))
with check (exists (select 1 from periodos_expensas pe where pe.id = expensas_departamento.periodo_id and pe.cliente_id = current_cliente_id()));

alter table contactos_propiedades enable row level security;
create policy "tenant_all_contactos_propiedades" on contactos_propiedades for all to authenticated
using (exists (select 1 from contactos c where c.id = contactos_propiedades.contacto_id and c.cliente_id = current_cliente_id()))
with check (exists (select 1 from contactos c where c.id = contactos_propiedades.contacto_id and c.cliente_id = current_cliente_id()));

alter table propiedades_interes enable row level security;
create policy "tenant_all_propiedades_interes" on propiedades_interes for all to authenticated
using (exists (select 1 from prospectos p where p.id = propiedades_interes.prospecto_id and p.cliente_id = current_cliente_id()))
with check (exists (select 1 from prospectos p where p.id = propiedades_interes.prospecto_id and p.cliente_id = current_cliente_id()));

alter table historial_prospectos enable row level security;
create policy "tenant_all_historial_prospectos" on historial_prospectos for all to authenticated
using (exists (select 1 from prospectos p where p.id = historial_prospectos.prospecto_id and p.cliente_id = current_cliente_id()))
with check (exists (select 1 from prospectos p where p.id = historial_prospectos.prospecto_id and p.cliente_id = current_cliente_id()));

alter table visitas enable row level security;
create policy "tenant_all_visitas" on visitas for all to authenticated
using (exists (select 1 from prospectos p where p.id = visitas.prospecto_id and p.cliente_id = current_cliente_id()))
with check (exists (select 1 from prospectos p where p.id = visitas.prospecto_id and p.cliente_id = current_cliente_id()));

alter table pagos_contrato enable row level security;
create policy "tenant_all_pagos_contrato" on pagos_contrato for all to authenticated
using (exists (select 1 from contratos ct where ct.id = pagos_contrato.contrato_id and ct.cliente_id = current_cliente_id()))
with check (exists (select 1 from contratos ct where ct.id = pagos_contrato.contrato_id and ct.cliente_id = current_cliente_id()));

alter table contratos_adjuntos enable row level security;
create policy "tenant_all_contratos_adjuntos" on contratos_adjuntos for all to authenticated
using (exists (select 1 from contratos ct where ct.id = contratos_adjuntos.contrato_id and ct.cliente_id = current_cliente_id()))
with check (exists (select 1 from contratos ct where ct.id = contratos_adjuntos.contrato_id and ct.cliente_id = current_cliente_id()));

-- ============ GRUPO C: 2 hops vía FK ============

alter table cargos_extra_contrato enable row level security;
create policy "tenant_all_cargos_extra_contrato" on cargos_extra_contrato for all to authenticated
using (exists (
  select 1 from pagos_contrato pc join contratos ct on ct.id = pc.contrato_id
  where pc.id = cargos_extra_contrato.pago_id and ct.cliente_id = current_cliente_id()
))
with check (exists (
  select 1 from pagos_contrato pc join contratos ct on ct.id = pc.contrato_id
  where pc.id = cargos_extra_contrato.pago_id and ct.cliente_id = current_cliente_id()
));

-- ============ GRUPO D: solo lectura, sin escritura desde el frontend ============

-- usuarios: el frontend solo hace SELECT (alta de usuarios es manual en el dashboard)
alter table usuarios enable row level security;
create policy "tenant_select_usuarios" on usuarios for select to authenticated
using (cliente_id = current_cliente_id());

-- tipos_documentacion: cliente_id nullable = tipo global compartido; el frontend
-- no inserta/edita tipos, solo lee
alter table tipos_documentacion enable row level security;
create policy "tenant_select_tipos_documentacion" on tipos_documentacion for select to authenticated
using (cliente_id = current_cliente_id() or cliente_id is null);

-- ============ GRUPO E: tablas globales/compartidas entre clientes ============

-- etapas_crm: config fija del Kanban, igual para todos los clientes
alter table etapas_crm enable row level security;
create policy "authenticated_select_etapas_crm" on etapas_crm for select to authenticated
using (true);

-- propiedades_ext: pool de propiedades "de la comunidad" (scrapeadas), compartido
-- entre todos los clientes por diseño -- no tiene cliente_id
alter table propiedades_ext enable row level security;
create policy "authenticated_select_propiedades_ext" on propiedades_ext for select to authenticated
using (true);

-- ROLLBACK -- por tabla, si algo se rompe:
-- drop policy if exists "tenant_all_consorcios" on consorcios;
-- drop policy if exists "tenant_all_propietarios" on propietarios;
-- drop policy if exists "tenant_all_reclamos" on reclamos;
-- drop policy if exists "tenant_all_periodos_expensas" on periodos_expensas;
-- drop policy if exists "tenant_all_contactos" on contactos;
-- drop policy if exists "tenant_all_prospectos" on prospectos;
-- drop policy if exists "tenant_all_contratos" on contratos;
-- drop policy if exists "tenant_all_documentos_respaldatorios" on documentos_respaldatorios;
-- drop policy if exists "tenant_all_contactos_propiedades_ext" on contactos_propiedades_ext;
-- drop policy if exists "tenant_all_ml_tokens" on ml_tokens;
-- drop policy if exists "public_insert_consultas_web" on consultas_web;
-- drop policy if exists "tenant_all_consultas_web" on consultas_web;
-- drop policy if exists "tenant_all_departamentos" on departamentos;
-- drop policy if exists "tenant_all_gastos" on gastos;
-- drop policy if exists "tenant_all_expensas_departamento" on expensas_departamento;
-- drop policy if exists "tenant_all_contactos_propiedades" on contactos_propiedades;
-- drop policy if exists "tenant_all_propiedades_interes" on propiedades_interes;
-- drop policy if exists "tenant_all_historial_prospectos" on historial_prospectos;
-- drop policy if exists "tenant_all_visitas" on visitas;
-- drop policy if exists "tenant_all_pagos_contrato" on pagos_contrato;
-- drop policy if exists "tenant_all_contratos_adjuntos" on contratos_adjuntos;
-- drop policy if exists "tenant_all_cargos_extra_contrato" on cargos_extra_contrato;
-- drop policy if exists "tenant_select_usuarios" on usuarios;
-- drop policy if exists "tenant_select_tipos_documentacion" on tipos_documentacion;
-- drop policy if exists "authenticated_select_etapas_crm" on etapas_crm;
-- drop policy if exists "authenticated_select_propiedades_ext" on propiedades_ext;
-- -- y volver a crear una policy abierta por tabla si hace falta destrabar rápido:
-- -- create policy "open_<tabla>" on <tabla> for all to anon, authenticated using (true) with check (true);
