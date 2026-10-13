-- Los cargos extra de un período ya pagado quedan fijos: no se pueden agregar, modificar
-- ni eliminar (ya forman parte de lo cobrado y de los recibos emitidos). Mientras el
-- período está pendiente se pueden editar libremente.
--
-- No afecta a registrar_pago_contrato: los cargos de mora, depósito y actualización de
-- depósito se insertan antes de marcar el pago como pagado, dentro de la misma transacción.
-- Para corregir a mano un período pagado desde el SQL Editor, desactivar el trigger:
--   alter table cargos_extra_contrato disable trigger cargos_extra_bloqueo_pagados;
--   ... corrección ...
--   alter table cargos_extra_contrato enable trigger cargos_extra_bloqueo_pagados;

create or replace function cargos_extra_bloquear_pagados()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from pagos_contrato
    where id in (
      case when tg_op = 'DELETE' then old.pago_id else new.pago_id end,
      case when tg_op = 'UPDATE' then old.pago_id else null end
    )
      and estado = 'pagado'
  ) then
    raise exception 'No se pueden modificar los cargos extra de un período ya pagado.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists cargos_extra_bloqueo_pagados on cargos_extra_contrato;
create trigger cargos_extra_bloqueo_pagados
  before insert or update or delete on cargos_extra_contrato
  for each row execute function cargos_extra_bloquear_pagados();

-- ROLLBACK:
-- drop trigger if exists cargos_extra_bloqueo_pagados on cargos_extra_contrato;
-- drop function if exists cargos_extra_bloquear_pagados();
