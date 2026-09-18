# Análisis de la base de datos (esquema + RLS) — Consorcio App

Fecha: 2026-09-16
Alcance: revisión del esquema completo de tablas y de las policies de RLS provistas por el usuario (export directo de Supabase). Complementa `ANALISIS_SEGURIDAD.md` (que se centró en Edge Functions/RPCs) y `ANALISIS_PERFORMANCE.md` (índices).

Convención de severidad: **Crítico** / **Alto** / **Medio** / **Bajo**.

---

## 1. 🟢 RESUELTO — `propiedades` expone columnas sensibles a `anon` sin control de columnas

```sql
public_select_propiedades | SELECT | anon | USING (estado <> 'Baja')
```

Esta policy controla **qué filas** puede leer un visitante anónimo, pero RLS en Postgres/PostgREST **no controla qué columnas** se devuelven — eso lo decide quien arma el parámetro `select=` en la URL, y con la `anon key` (pública, está en el bundle del frontend) cualquiera puede armar la que quiera.

La tabla `propiedades` tiene columnas que nunca deberían ser públicas: `comprador_nombre`, `comprador_dni`, `comprador_telefono`, `precio_final_venta`, `observaciones_internas`.

Con la policy actual, un llamado directo a la API REST (sin pasar por el frontend, sin sesión) como:
```
GET /rest/v1/propiedades?select=titulo,comprador_dni,comprador_telefono,observaciones_internas&estado=eq.Vendida
```
devuelve el DNI y teléfono del comprador y las notas internas de **cualquier propiedad vendida de cualquier cliente de la plataforma**. Tu UI (`Propiedades.jsx`, `InmobiliariaPublica.jsx`) nunca pide esas columnas en su `select`, pero eso es una convención del frontend, no una restricción de la base — cualquiera que inspeccione la red y arme su propia request la salta por completo.

**Cómo corregirlo** (de más simple a más correcto):
1. *Mitigación rápida*: acotar el `USING` a `estado = 'Disponible'` (hoy también deja pasar `Reservada` y `Vendida`, que tampoco deberían ser navegables públicamente). Reduce el radio de filas expuestas pero no resuelve el problema de fondo: cualquier columna sensible que se agregue en el futuro a una propiedad "Disponible" seguiría expuesta.
2. *Corrección real*: crear una vista `propiedades_publicas` que solo exponga las columnas realmente públicas (`titulo, tipo_propiedad, tipo_operacion, precio_publicacion, moneda, direccion, localidad, provincia, ambientes, dormitorios, banios, cochera, metros_cubiertos, metros_totales, descripcion, latitud, longitud`, etc. — sin las de comprador ni `observaciones_internas`), y mover la policy de `anon` para que apunte a esa vista en vez de a la tabla completa. Esto saca la responsabilidad de seguridad del frontend (que puede tener un bug o un desarrollador nuevo que agregue un `select('*')` sin saber del riesgo) y la pone en la base, que es donde tiene que estar.

**Severidad (era)**: Crítico — es una fuga real de PII (DNI, teléfono) de terceros (compradores, que ni siquiera son usuarios de la plataforma) explotable hoy con un simple `curl` y la `anon key` pública.

**Fix aplicado**: se implementó la opción 2 (corrección real). `supabase/migrations/0037_propiedades_publicas_view.sql` crea la vista `propiedades_publicas` (con `security_invoker = true`, para que siga aplicando la RLS de filas de la tabla base — `estado <> 'Baja'` — con el rol de quien consulta, sin duplicar esa condición) exponiendo solo columnas públicas (`id, cliente_id, titulo, tipo_propiedad, tipo_operacion, estado, precio_publicacion, moneda, direccion, localidad, provincia, latitud, longitud, ambientes, dormitorios, banios, cochera, metros_cubiertos, metros_totales, descripcion, created_at, updated_at`), y se revoca el `SELECT` directo de `anon` sobre `propiedades`. `authenticated` no se toca (`tenant_all_propiedades` ya lo acota por `cliente_id`, y el panel admin necesita todas las columnas).

Se detectó de paso que el problema era peor de lo que parecía: `getPropiedadPublica()` en `supabase.js` (usada por `PropiedadPublica.jsx`, la página pública real de una propiedad) hacía `select('*')` — es decir, los datos sensibles ya viajaban por la red en el uso normal de la app, no solo en un `curl` armado a mano. Esa función y `getPropiedadesPublicas()` (usada por `InmobiliariaPublica.jsx`) pasan a consultar `propiedades_publicas` en vez de `propiedades`. El resto de los usos de `propiedades` en `supabase.js` son todos de páginas de admin autenticadas (`Propiedades.jsx`, `PropiedadDetalleDrawer.jsx`, CRM) y no se tocaron.

**Bug introducido por este fix (detectado y corregido después)**: la vista se creó con `with (security_invoker = true)`, que exige que el rol que consulta (`anon`) tenga privilegios *también* sobre la tabla base — pero la misma migración le revoca el `SELECT` a `anon` sobre `propiedades`, así que la vista quedó inutilizable para visitantes sin sesión (`permission denied for table propiedades`), tumbando el catálogo público real (`/inmobiliaria/:clienteId`, `/p/:id`). No se detectó al probar porque un usuario logueado (rol `authenticated`, que sí conserva su `SELECT` sobre `propiedades`) enmascara el problema. Ver `FIX_PROPIEDADES_PUBLICAS.md`. **Fix del fix**: `supabase/migrations/0041_fix_propiedades_publicas_view.sql` saca `security_invoker` (una vista sin esa opción corre con los privilegios de quien la creó, alcanza con el `grant` sobre la vista) y repone a mano el filtro `estado <> 'Baja'` que antes heredaba de la RLS de la tabla base. Corrida en producción y verificada con `curl` sin sesión (`GET /rest/v1/propiedades_publicas` → `200` con datos reales, ya no `401 permission denied`).

**Segundo efecto colateral encontrado al reverificar (fotos)**: la policy pública de `propiedades_imagenes` (`0002_rls_propiedades_clientes.sql`) valida con un `EXISTS (select 1 from propiedades p where p.id = ... and p.estado <> 'Baja')` — esa subconsulta corre con los privilegios de `anon` (no es `SECURITY DEFINER`), así que también quedó inevaluable al revocarle el `SELECT` completo sobre `propiedades`. `supabase/migrations/0042_fix_propiedades_imagenes_anon.sql` le da a `anon` un `grant select (id, estado)` a nivel de columna sobre `propiedades` — solo las 2 columnas que el `EXISTS` necesita, no reabre la fuga de columnas sensibles. Corrida en producción y verificada: `propiedades_imagenes` → `200` con fotos reales, `propiedades.comprador_dni` → sigue en `401`. Ver `FIX_PROPIEDADES_PUBLICAS.md`.

---

## 2. 🟢 RESUELTO — `resolve_username_intentos` sin policy de RLS visible

Esta tabla es la mitigación implementada contra el hallazgo de enumeración de usuarios de `ANALISIS_SEGURIDAD.md` (punto 4, `email_for_username`) — registra intentos por IP para poder limitar su frecuencia.

**Confirmado**: `supabase/migrations/0033_resolve_username_rate_limit.sql` (la misma migración que crea la tabla) ya incluye `alter table resolve_username_intentos enable row level security;` sin ninguna policy — exactamente la corrección correcta, sin necesidad de cambios adicionales. La tabla queda cerrada a `anon`/`authenticated` por PostgREST, solo accesible vía `service_role` (que es como la usa la Edge Function `resolve-username`). Migración ya corrida en producción, confirmado por el usuario.

**Severidad (era)**: Media (a confirmar; si el rate-limit se pudiera resetear a demanda, degradaba a "sin protección real" el punto 4 de seguridad).

---

## 3. 🟢 RESUELTO — `cliente_id` nullable en tablas centrales del modelo multi-tenant

Toda la seguridad de aislamiento entre clientes depende de `cliente_id = current_cliente_id()`. Sin embargo, las siguientes columnas estaban marcadas **Nullable**: `consorcios.cliente_id`, `propietarios.cliente_id`, `reclamos.cliente_id`, `periodos_expensas.cliente_id`, `propiedades.cliente_id`, `prospectos.cliente_id`, `contactos.cliente_id`, `indices_actualizacion.cliente_id`, `consultas_web.cliente_id`.

Si algún proceso con `service_role` (que bypassa RLS — una Edge Function, un script de carga masiva) inserta por error una fila con `cliente_id = null`, esa fila queda huérfana: invisible para todos los tenants (`null = cualquier_uuid` nunca es `true` en SQL), pero sigue ocupando espacio y puede romper joins o reportes agregados sin que nadie entienda por qué. No es una fuga de seguridad (falla "cerrado", no "abierto"), pero es una fuente de bugs silenciosos y difíciles de diagnosticar.

**Fix aplicado**: `supabase/migrations/0038_cliente_id_not_null.sql` agrega `NOT NULL` a `cliente_id` en las 9 tablas. No hicimos un `select ... where cliente_id is null` previo por tabla porque no hace falta: `ALTER COLUMN ... SET NOT NULL` valida automáticamente todas las filas existentes y la migración completa corre en una sola transacción. Corrida en producción sin errores — no había filas huérfanas en ninguna de las 9 tablas.

**Severidad (era)**: Media (integridad de datos, no explotable como vulnerabilidad).

---

## 4. 🟢 RESUELTO — Refuerza un hallazgo ya documentado en performance — RLS con `EXISTS` sin índices

Las policies de las tablas "hijas" sin `cliente_id` propio (`departamentos`, `visitas`, `pagos_contrato`, `cargos_extra_contrato`, `contactos_propiedades`, `historial_prospectos`, `propiedades_interes`, `tareas_etapa`, `contratos_adjuntos`, `propiedades_imagenes`, `etapas_proyecto`) usan `EXISTS (SELECT 1 FROM tabla_padre WHERE ... AND cliente_id = current_cliente_id())`.

Es el patrón correcto para RLS en tablas sin `cliente_id` directo, pero implica que **cada fila leída de esas tablas dispara una subconsulta de autorización contra la tabla padre**, filtrando por `cliente_id`. `ANALISIS_PERFORMANCE.md` (referenciado acá) no está en el repo — no se pudo confirmar su hallazgo 2.4 directamente, pero se confirmó revisando las 39 migraciones del repo: **ningún índice existía sobre `cliente_id` de `prospectos`, `contratos`, `periodos_expensas`, `consorcios` ni `contactos`** (el único índice sobre una columna `cliente_id` era `idx_proyectos_cliente`, en una tabla que ni siquiera está en esta lista) — cada subconsulta de autorización hacía un seq scan, y esto corre en **cada request de lectura**, no solo en reportes puntuales.

**Fix aplicado**: `supabase/migrations/0039_indices_cliente_id_y_fk.sql` agrega índices en:
- `cliente_id` de las tablas padre: `prospectos`, `contratos`, `periodos_expensas`, `consorcios`, `contactos`, y de paso `propiedades`/`reclamos` (mismo patrón, mismo riesgo, no nombradas explícitamente en este punto pero detectadas con el mismo problema).
- La columna FK del lado "hijo" usada en el join de cada `EXISTS` (`departamentos.id_consorcio`, `visitas.prospecto_id`/`propiedad_id`, `pagos_contrato.contrato_id`, `cargos_extra_contrato.pago_id`, `contratos_adjuntos.contrato_id`, `propiedades_imagenes.propiedad_id`, `historial_prospectos.prospecto_id`, `propiedades_interes.prospecto_id`/`propiedad_id`, `contactos_propiedades.contacto_id`/`propiedad_id`, `tareas_etapa.etapa_id`, `etapas_proyecto.proyecto_id`) — sin esto, aunque el padre tenga índice en `cliente_id`, el join en sí seguía siendo lento en tablas grandes.

`CREATE INDEX` sin `CONCURRENTLY` (toma un lock breve de escritura mientras se construye, aceptable para el tamaño actual de estas tablas — se decidió priorizar simplicidad y que quede versionado en el repo de migraciones, sobre evitar un lock momentáneo).

**Severidad (era)**: Media hoy / Alta en el mediano plazo (mismo diagnóstico que el hallazgo de performance, reforzado).

---

## 5. 🟢 RESUELTO — Detalles menores de modelado (cosmético, no urgente)

- `periodos_expensas.usuario_id` era `text`, mientras que `reclamos.usuario_id` es `int4` — dos columnas con el mismo nombre conceptual ("quién lo creó") con tipos distintos. Confirmado revisando el código (`NuevoPeriodo.jsx`/`Expensas.jsx`, `usuario_id: user.id`): guarda el mismo dato que `reclamos.usuario_id` (el `id` numérico de `usuarios`), no un nombre de usuario — solo estaba mal tipada.
- `contactos` usaba `varchar` para `dni/telefono/email/nombre/apellido`, mientras el resto de la base usa `text` para columnas equivalentes. Sin impacto funcional en Postgres, era solo inconsistencia de convención entre migraciones escritas en momentos distintos.

**Fix aplicado**: `supabase/migrations/0040_modelado_cosmetico.sql` unifica `periodos_expensas.usuario_id` a `integer` (`ALTER COLUMN ... TYPE integer USING usuario_id::integer` — si alguna fila tuviera un valor no numérico, la migración falla ahí con un error claro en vez de corromper datos) y las 5 columnas de `contactos` a `text`. Se decidió no agregar una FK de `usuario_id` a `usuarios.id` — no la pedía este punto y sí tendría riesgo real si hay algún id huérfano de un usuario borrado.

**Severidad (era)**: Baja.

---

## 6. Lo que está bien resuelto (no tocar sin necesidad)

- `usuarios`: solo tiene policy de `SELECT`, correctamente de solo lectura para `authenticated` — coincide con el flujo documentado (altas manuales desde el dashboard de Supabase).
- Tablas realmente compartidas entre todos los clientes están señalizadas explícitamente como tales en vez de "coladas" por accidente: `etapas_crm` (`SELECT... USING (true)`), `propiedades_ext` (ídem), `tipos_documentacion` (`cliente_id = current OR cliente_id IS NULL`, para permitir defaults globales + overrides por cliente), `indices_actualizacion` (`cliente_id = current OR externo = true`). Los cuatro casos son consistentes con lo documentado en `CLAUDE.md`.
- Los inserts públicos (`consultas_web`, `portal_error_logs`) están acotados a la operación `INSERT` únicamente, sin otorgar `SELECT` a `anon` — correcto, un atacante puede llenar de basura esas tablas (no hay rate-limit a nivel de policy, es un vector de spam de bajo impacto) pero no puede leer datos de otros.
- El patrón general de RLS (`cliente_id = current_cliente_id()` directo, o `EXISTS` contra la tabla padre para las que no tienen `cliente_id` propio) está aplicado con consistencia en las ~35 tablas de negocio.

---

## Resumen priorizado

1. ~~**Corregir la exposición de columnas sensibles en `propiedades`** (punto 1)~~ — resuelto, era el hallazgo más grave de todo este documento.
2. ~~**Confirmar y, si hace falta, habilitar RLS en `resolve_username_intentos`** (punto 2)~~ — resuelto, ya estaba bien desde que se creó la tabla.
3. ~~**`NOT NULL` en `cliente_id`** de las tablas centrales (punto 3)~~ — resuelto (`0038_cliente_id_not_null.sql`), corrido sin errores.
4. ~~**Índices en columnas `cliente_id`/FK** (punto 4)~~ — resuelto (`0039_indices_cliente_id_y_fk.sql`), falta correrla.
5. ~~Detalles de modelado (punto 5)~~ — resuelto (`0040_modelado_cosmetico.sql`), falta correrla.
