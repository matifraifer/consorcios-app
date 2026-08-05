-- Soporte para mora e interés en la pestaña "Liquidaciones" del consorcio.
-- fecha_vencimiento: se carga a mano al crear un período, se usa para calcular meses de atraso.
-- tasa_mora: % mensual de interés simple, configurable por consorcio.
alter table public.periodos_expensas add column if not exists fecha_vencimiento date;
alter table public.consorcios add column if not exists tasa_mora numeric default 0;
