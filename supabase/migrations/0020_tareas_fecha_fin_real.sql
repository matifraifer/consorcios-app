-- La grilla de tareas (dentro de "Etapas del proyecto") distingue la fecha
-- de fin prevista (ya existente en tareas_etapa.fecha_fin) de la fecha real
-- en que la tarea efectivamente terminó.
alter table tareas_etapa add column if not exists fecha_fin_real date;

-- ROLLBACK:
-- alter table tareas_etapa drop column if exists fecha_fin_real;
