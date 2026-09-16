-- Fase 2 (ver ANALISIS_SEGURIDAD.md, punto 5): aísla por cliente_id los
-- buckets contratos-adjuntos y documentos-respaldatorios, que la Fase 1
-- (0035) dejó abiertos a cualquier authenticated sin distinguir cliente.
--
-- A diferencia de propiedades-imagenes, estos paths no incluyen cliente_id
-- directo — hay que resolverlo con un EXISTS contra la tabla de negocio
-- correspondiente. Esto funciona porque en los dos flujos de subida la fila
-- ya existe en la base ANTES de subir el archivo:
--   - contratos-adjuntos, patrón "{contrato_id}/...": createContrato() en
--     supabase.js inserta la fila en `contratos` y recién con ese id arma
--     el path y sube los adjuntos.
--   - contratos-adjuntos, patrón "comprobantes/{pago_id}/...": las filas de
--     `pagos_contrato` se crean todas de una al crear el contrato
--     (generarPagos); registrarPagoContrato() sube el comprobante contra un
--     pago_id que ya existe.
--   - documentos-respaldatorios, patrón "{entidadTipo}/{entidadId}/...":
--     entidadId es un propiedad_id o contrato_id ya existente (no se puede
--     subir documentación de una propiedad/contrato que todavía no se creó).

drop policy if exists "authenticated_all_contratos_adjuntos_bucket" on storage.objects;

create policy "authenticated_all_contratos_adjuntos_bucket"
on storage.objects for all
to authenticated
using (
  bucket_id = 'contratos-adjuntos' and (
    (
      (storage.foldername(name))[1] = 'comprobantes'
      and exists (
        select 1 from pagos_contrato pc
        join contratos c on c.id = pc.contrato_id
        where pc.id::text = (storage.foldername(name))[2]
          and c.cliente_id = current_cliente_id()
      )
    )
    or
    (
      (storage.foldername(name))[1] <> 'comprobantes'
      and exists (
        select 1 from contratos c
        where c.id::text = (storage.foldername(name))[1]
          and c.cliente_id = current_cliente_id()
      )
    )
  )
)
with check (
  bucket_id = 'contratos-adjuntos' and (
    (
      (storage.foldername(name))[1] = 'comprobantes'
      and exists (
        select 1 from pagos_contrato pc
        join contratos c on c.id = pc.contrato_id
        where pc.id::text = (storage.foldername(name))[2]
          and c.cliente_id = current_cliente_id()
      )
    )
    or
    (
      (storage.foldername(name))[1] <> 'comprobantes'
      and exists (
        select 1 from contratos c
        where c.id::text = (storage.foldername(name))[1]
          and c.cliente_id = current_cliente_id()
      )
    )
  )
);

drop policy if exists "authenticated_all_documentos_respaldatorios_bucket" on storage.objects;

create policy "authenticated_all_documentos_respaldatorios_bucket"
on storage.objects for all
to authenticated
using (
  bucket_id = 'documentos-respaldatorios' and (
    (
      (storage.foldername(name))[1] = 'propiedad'
      and exists (
        select 1 from propiedades p
        where p.id::text = (storage.foldername(name))[2]
          and p.cliente_id = current_cliente_id()
      )
    )
    or
    (
      (storage.foldername(name))[1] = 'contrato'
      and exists (
        select 1 from contratos c
        where c.id::text = (storage.foldername(name))[2]
          and c.cliente_id = current_cliente_id()
      )
    )
  )
)
with check (
  bucket_id = 'documentos-respaldatorios' and (
    (
      (storage.foldername(name))[1] = 'propiedad'
      and exists (
        select 1 from propiedades p
        where p.id::text = (storage.foldername(name))[2]
          and p.cliente_id = current_cliente_id()
      )
    )
    or
    (
      (storage.foldername(name))[1] = 'contrato'
      and exists (
        select 1 from contratos c
        where c.id::text = (storage.foldername(name))[2]
          and c.cliente_id = current_cliente_id()
      )
    )
  )
);
