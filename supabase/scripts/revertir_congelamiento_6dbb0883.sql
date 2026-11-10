-- Revierte congelar_actualizaciones_6dbb0883.sql: el contrato 6dbb0883-36aa-491c-bc43-a22ab97d6855
-- (Balmaceda Madueño, ICL cuatrimestral desde 01/09/2024) vuelve a calcularse con el ICL diario
-- desde el inicio.
--
-- Usar solo si se decide con el cliente corregir al ICL real.
--
-- Qué hace (bloque DO atómico):
--   - borra todas las filas de actualizaciones_contrato del contrato
--   - pone monto_vigente en null en todas sus cuotas
-- Efecto: el detalle muestra la estimación con ICL diario (~792.000 desde la cuota 25) y el
-- próximo pago que se registre aplica y congela todas las actualizaciones con el ICL diario.
--
-- No toca monto_pagado, cargos ni recibos: lo ya cobrado queda como está. La diferencia
-- histórica se cobra aparte, como cargo extra manual en cuotas pendientes (modal
-- "Cargos Extra" del detalle del contrato); calcular el monto exacto el día que se haga.
--
-- ANTES DE CORRER: revisar que no haya actualizaciones aplicadas después del congelamiento
-- (la próxima era la cuota 29, 01/01/2027). Si las hay, también se borran y se recalculan
-- con ICL diario partiendo del monto real; revisar el resultado antes de confirmar el cobro.

-- Chequeo previo: actualizaciones actuales del contrato (las del congelamiento tienen la nota
-- 'Congelado con el monto efectivamente cobrado...').
select periodo_numero, monto_anterior, monto_nuevo, indices_usados, created_at
from actualizaciones_contrato
where contrato_id = '6dbb0883-36aa-491c-bc43-a22ab97d6855'
order by periodo_numero;

do $$
declare
  v_contrato uuid := '6dbb0883-36aa-491c-bc43-a22ab97d6855';
begin
  delete from actualizaciones_contrato where contrato_id = v_contrato;
  update pagos_contrato set monto_vigente = null where contrato_id = v_contrato;
end $$;

-- Verificación: no deben quedar actualizaciones ni monto_vigente.
select count(*) as actualizaciones
from actualizaciones_contrato
where contrato_id = '6dbb0883-36aa-491c-bc43-a22ab97d6855';

select count(*) as cuotas_con_monto_vigente
from pagos_contrato
where contrato_id = '6dbb0883-36aa-491c-bc43-a22ab97d6855' and monto_vigente is not null;
