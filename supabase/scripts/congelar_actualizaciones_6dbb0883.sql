-- Congela las actualizaciones ya cobradas del contrato 6dbb0883-36aa-491c-bc43-a22ab97d6855
-- (Balmaceda Madueño, ICL cuatrimestral desde 01/09/2024) con los montos que efectivamente
-- se cobraron (método mensual viejo, al que le faltaban los ICL de sep 2024 a ene 2025).
--
-- Decidido el 10/11/2026: no se corrige retroactivamente al ICL diario. El ICL diario se usa
-- recién desde la próxima actualización (cuota 29, 01/01/2027), partiendo de 640.469.
--
-- Qué hace (una transacción):
--   - monto_vigente de cada bloque = lo cobrado en ese bloque (cuotas 25-28 = 640.469, así
--     octubre a diciembre 2026 siguen en el mismo monto).
--   - una fila en actualizaciones_contrato por cada período de actualización (5, 9, 13, 17,
--     21, 25), que es lo que hace que aplicar_actualizaciones_contrato no las recalcule.
-- No toca monto_pagado, cargos ni recibos. El contrato no tiene depósito.
-- Correr en el SQL Editor. El bloque DO es atómico: si algo falla no queda nada a medias.
-- Si ya existen filas en actualizaciones_contrato para este contrato, aborta sin cambiar nada.

do $$
declare
  v_contrato uuid := '6dbb0883-36aa-491c-bc43-a22ab97d6855';
  v_cliente  uuid;
  r record;
begin
  if exists (select 1 from actualizaciones_contrato where contrato_id = v_contrato) then
    raise exception 'El contrato ya tiene actualizaciones registradas. No se modifica nada.';
  end if;

  select cliente_id into v_cliente from contratos where id = v_contrato;

  for r in
    select * from (values
      ( 5, 400000::numeric, 400000::numeric),
      ( 9, 400000, 433358),
      (13, 433358, 486449),
      (17, 486449, 526802),
      (21, 526802, 575541),
      (25, 575541, 640469)
    ) as t(periodo, monto_anterior, monto_nuevo)
  loop
    update pagos_contrato
    set monto_vigente = r.monto_nuevo
    where contrato_id = v_contrato
      and periodo_numero between r.periodo and r.periodo + 3;

    insert into actualizaciones_contrato (
      cliente_id, contrato_id, pago_id, periodo_numero, tipo_indice, plazo_meses,
      indices_usados, coeficiente, monto_anterior, monto_nuevo, deposito_anterior, deposito_nuevo
    )
    select v_cliente, v_contrato, p.id, r.periodo, 'ICL', 4,
           jsonb_build_array(jsonb_build_object(
             'nota', 'Congelado con el monto efectivamente cobrado (carga histórica, método mensual)')),
           r.monto_nuevo / r.monto_anterior, r.monto_anterior, r.monto_nuevo, null, null
    from pagos_contrato p
    where p.contrato_id = v_contrato and p.periodo_numero = r.periodo;
  end loop;
end $$;

-- Verificación: cuotas 1-28 con su monto vigente, y las 6 actualizaciones.
select periodo_numero, periodo_inicio, estado, monto_vigente, monto_pagado
from pagos_contrato
where contrato_id = '6dbb0883-36aa-491c-bc43-a22ab97d6855' and periodo_numero <= 29
order by periodo_numero;

select periodo_numero, monto_anterior, monto_nuevo, round(coeficiente, 4) as coef
from actualizaciones_contrato
where contrato_id = '6dbb0883-36aa-491c-bc43-a22ab97d6855'
order by periodo_numero;
