-- Recibo del propietario como rendición: medio por el que se le entregó el dinero.
-- Se elige al descargar el recibo (Transferencia / Efectivo) y se guarda acá; la próxima
-- descarga viene precargada. null = todavía no se eligió.
-- (El nuevo formato del recibo — alquiler, comisión, descuentos y neto rendido — se arma
-- en el frontend con los datos que el recibo ya guarda; no requiere otros cambios.)

alter table recibos_propietario
  add column if not exists medio_rendicion text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recibos_propietario_medio_rendicion_check') then
    alter table recibos_propietario
      add constraint recibos_propietario_medio_rendicion_check
      check (medio_rendicion is null or medio_rendicion in ('transferencia', 'efectivo'));
  end if;
end $$;

-- ROLLBACK:
-- alter table recibos_propietario drop constraint if exists recibos_propietario_medio_rendicion_check;
-- alter table recibos_propietario drop column if exists medio_rendicion;
