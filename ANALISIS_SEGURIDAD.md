# Análisis de seguridad — Consorcio App

Fecha: 2026-09-16
Alcance: revisión manual de Edge Functions (`supabase/functions/`), RLS/RPCs (`supabase/migrations/`) y `whatsapp-service/`. No se ejecutó un pentest activo (no se probó contra el proyecto real desplegado), es lectura de código.

Convención de severidad: **Crítico** (explotable hoy, impacto directo en plata/datos de terceros) / **Alto** / **Medio** / **Bajo**.

---

## 1. RESUELTO — Edge Functions administrativas sin ninguna autorización

Varias funciones están deployadas con `--no-verify-jwt` (según indica el propio CLAUDE.md) porque se llaman con la `anon key` en vez del JWT de sesión. El problema es que **ninguna de ellas valida después, dentro del código, que quien llama tiene permiso sobre el `cliente_id`/`consorcio_id`/`departamento_id` que le pasan como parámetro**. La `anon key` es pública (está en el bundle del frontend, cualquiera la puede extraer con las devtools), así que en la práctica estos endpoints son invocables por cualquier persona en internet con un simple `curl`, sin login y sin pertenecer a ningún cliente.

Funciones afectadas y qué puede hacer un atacante sin autenticarse:

- **`enviar-liquidacion-whatsapp`** (`supabase/functions/enviar-liquidacion-whatsapp/index.ts`): recibe `{ consorcio_id }` y manda WhatsApp (Twilio) a **todos** los teléfonos con deuda de ese consorcio. Sin ningún chequeo de que quien llama es admin de ese cliente. `consorcio_id` es un UUID pero no hace falta adivinarlo: alcanza con mirar la red del navegador logueado como cualquier cliente, o simplemente probar. Impacto: spam masivo a vecinos de cualquier consorcio, agotar el saldo de Twilio, dañar la reputación del número de WhatsApp (riesgo de ban, que ya está documentado como riesgo pero acá se vuelve trivial de gatillar por un tercero).
- **`enviar-recordatorios-whatsapp`**: mismo problema, y encima soporta invocarse **sin ningún body** (`consorcio_id` opcional) — en ese caso corre sobre **todos los consorcios de la plataforma** que tengan `dias_recordatorio_previo` configurado. Un atacante externo puede disparar el job completo de recordatorios cuando quiera, tantas veces como quiera (la deduplicación por `recordatorios_whatsapp_enviados` evita reenviar el mismo período, pero no evita el abuso ni el consumo de la API de Twilio).
- **`enviar-link-consulta`**: recibe `{ departamento_id }` (un `serial` int, trivialmente enumerable: 1, 2, 3...) y manda un email a la casilla cargada en ese departamento, sin validar quién pidió el envío. Permite bombardear de mails a cualquier propietario/inquilino de cualquier cliente de la plataforma, o simplemente barrer el rango de IDs para confirmar cuáles existen y a qué mail están asociados (aunque el mail no se devuelve en la respuesta, sí se filtra si existe o no vía el mensaje de error "no tiene email cargado" vs éxito).
- **`ml-auth`**: recibe `{ code, redirect_uri, cliente_id }` y hace `upsert` en `ml_tokens` con `onConflict: cliente_id`. Sin validar que el `cliente_id` pertenece a quien está haciendo el flujo OAuth. Un atacante que arranque su propio flujo de OAuth de MercadoLibre (con su propia cuenta ML) puede terminar el intercambio pasando el `cliente_id` **de otro cliente** de la plataforma, pisando el token de integración de MercadoLibre de esa otra inmobiliaria con el suyo propio. Esto no roba plata directamente, pero secuestra la integración de otro tenant (puede publicar/leer con la cuenta de ML del atacante en nombre del cliente correcto, o simplemente romperle la integración).
- **`extraer-contrato-ia`**: acepta cualquier texto y lo manda a la API de Anthropic con la key del proyecto. No hay ningún control de cuota/autenticación — es un proxy abierto a la API de Claude pagado por vos. Un atacante puede automatizar llamadas para consumir el crédito de la cuenta (costo, no fuga de datos).
- **`mp-auth`** (no reproducido el código completo acá, pero sigue el mismo patrón que `ml-auth`): mismo riesgo de secuestro de integración de Mercado Pago de otro cliente si no valida el `cliente_id` contra quien inició el OAuth.

**Por qué importa más que un bug menor**: estas funciones no son solo "endpoints públicos con datos públicos" (como sí es, correctamente, el flujo de `/consulta/:token`), son acciones administrativas (mandar comunicaciones masivas, escribir tokens de integraciones de terceros) pensadas para ser gatilladas únicamente desde botones del panel de admin logueado, pero técnicamente no hay nada que lo garantice.

**Fix aplicado**: las 5 funciones (`enviar-liquidacion-whatsapp`, `enviar-link-consulta`, `ml-auth`, `mp-auth`, `extraer-contrato-ia`) ahora validan `Authorization: Bearer <jwt-de-sesión>` con `supabase.auth.getUser(token)` dentro del código (sin sacarles `--no-verify-jwt`, que sigue teniendo sentido operativo), y las que reciben `cliente_id`/`consorcio_id`/`departamento_id` chequean que coincida con el `cliente_id` del perfil del usuario logueado — mismo patrón que ya usaba `whatsapp-service/src/middleware/auth.js`. `enviar-recordatorios-whatsapp` (el otro caso mencionado acá) se eliminó directamente, ver arriba.

**Nota sobre cómo se encontró este estado**: el código con el fix ya existía en el working tree desde antes de esta sesión (aparecía como `M` en `git status` sin explicación), pero nunca se había deployado a producción ni comiteado — se detectó recién cuando `extraer-contrato-ia` empezó a fallar en producción al probarse en vivo, momento en el que se deployaron las 5 funciones juntas. Quedan sin commitear — hacer `git add`/`commit` de estos cambios para no perder el fix si se descarta el working tree.

---

## 2. RESUELTO — `mp-webhook` no validaba la firma de Mercado Pago

`supabase/functions/mp-webhook/index.ts` hacía bien lo más importante (nunca confía en el `status` del payload, siempre re-consulta `GET /v1/payments/:id` contra la API de MP antes de marcar como aprobado), pero no validaba la firma del webhook (`x-signature` / `x-request-id`) que Mercado Pago permite verificar. El daño estaba acotado porque igual se revalidaba contra la API real de MP, pero la falta de verificación de firma era una desviación de la práctica recomendada por Mercado Pago.

**Fix aplicado**: se agregó `validarFirma()` en `mp-webhook/index.ts`, que recalcula el HMAC-SHA256 del template `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con el secret `MP_WEBHOOK_SECRET` y compara contra el hash `v1` del header `x-signature`. Si no matchea, corta con 401 antes de tocar la base o pegarle a la API de MP. Secret cargado y función deployada (`--no-verify-jwt`, sin cambios ahí — el gate real ahora es la firma). Confirmado con `curl` sin firma → `401 {"error":"Firma inválida."}`.

**Pendiente**: validar el camino feliz (firma correcta) con un pago real firmado por Mercado Pago — el simulador del panel de MP no sirve para esto porque pega a la "URL de producción" sin el query param `pago_id` que solo se agrega dinámicamente por preferencia en `mp-crear-preferencia`, así que la función corta antes en el chequeo de identificadores, no en la validación de firma. Queda para probarse con la primera transacción real en producción; si falla, revisar `npx supabase functions logs mp-webhook` para distinguir 401 (firma) de un fallo más adelante en la revalidación contra la API de MP.

## 3. RESUELTO — `portal_expensas_token` autenticaba solo con el token (sin segundo factor)

`portal_expensas_token(p_token uuid)`/`portal_alquiler_token(p_token uuid)`: a diferencia de `consultar_deuda_departamento` (que exige token **+ email + numeración**), estas RPCs devolvían toda la deuda, gastos y datos de otras unidades/contratos del mismo cliente con **solo el token** como credencial. Si ese link de WhatsApp se reenviaba, se filtraba en un chat grupal, o quedaba en el historial de un teléfono compartido, cualquiera con el link tenía acceso total sin más verificación.

**Fix aplicado**: `supabase/migrations/0032_portal_token_requiere_dni.sql` agrega el parámetro `p_dni` a ambas RPCs — devuelven `null` (mismo comportamiento que token inválido, para no filtrar cuál de los dos falló) si el DNI no coincide con `propietario_dni`/`inquilino_dni` de la unidad del token. En `PortalVecino.jsx`, el flujo por link (`/consulta/:token`) dejó de auto-cargar los datos al entrar: ahora muestra el mismo formulario de DNI que el flujo sin token, y **pide el DNI en cada visita** (decisión consciente del usuario: no se persiste en `localStorage`, prioriza seguridad — un dispositivo comprometido no debe seguir dando acceso — sobre la fricción de re-tipearlo). De paso se sacó la confirmación de DNI redundante que existía solo al momento de pagar (`UnidadCard`), porque ahora ya se pide al entrar.

## 4. RESUELTO — `email_for_username` era un oráculo de enumeración de usuarios

`supabase/migrations/0005_username_login_rpc.sql`: función `security definer`, callable por `anon`, sin rate limit propio. Devolvía `null` si el usuario no existía y el email si existía — permitía a un atacante enumerar `nombre_usuario` válidos probando strings comunes y confirmar el email asociado a cada uno (útil para phishing dirigido o para acotar un ataque de fuerza bruta solo a usuarios confirmados).

**Descartado**: rate-limitar dentro de la función SQL con `inet_client_addr()` — no funciona en este stack porque las RPCs pasan por PostgREST, que ve la IP del pooler, no la del atacante; terminaría rate-limitando a todos los usuarios juntos.

**Fix aplicado**: `supabase/migrations/0033_resolve_username_rate_limit.sql` elimina la RPC `email_for_username` (dejó de tener uso, ver abajo) y crea `resolve_username_intentos` (ip, created_at, sin policies — solo accesible con service-role key). La resolución username→email se movió a la Edge Function `supabase/functions/resolve-username/index.ts`, que consulta `usuarios` directo con la service-role key, ve la IP real del llamante (header `x-forwarded-for`), corta con 429 pasados 20 intentos en 15 minutos por IP, y agrega un delay parejo de 300ms exista o no el usuario (mitiga, no elimina, la enumeración por timing). `src/services/supabase.js` → `resolveEmailForUsername` pasó de `.rpc(...)` a `supabase.functions.invoke('resolve-username', ...)`; `AuthContext.login`/`requestPasswordReset` no cambiaron, consumen la misma función sin saber el detalle interno.

**Decisión consciente, pendiente**: se evaluó reemplazar el login por username por login directo con email (elimina el problema de raíz, sin necesidad de esta Edge Function ni de rate-limit propio, aprovechando el de GoTrue). Se decidió no hacerlo ahora — queda como mejora futura a evaluar por separado, no bloqueante para este fix.

## 5. RESUELTO — Bucket de Storage sin aislamiento por cliente

Ya estaba documentado como pendiente en el propio `CLAUDE.md`. Confirmado leyendo `0003_storage_authenticated_uploads.sql`: la policy de escritura del bucket `propiedades-imagenes` era `to authenticated using (bucket_id = 'propiedades-imagenes')`, sin condición sobre el path. **Cualquier usuario logueado de cualquier cliente podía sobrescribir o borrar fotos, logos o portadas de otro cliente** si conocía (o adivinaba) su `cliente_id` — de lectura pública (aparece en `/inmobiliaria/:clienteId`).

**Fix aplicado**: `supabase/migrations/0034_storage_aislamiento_cliente.sql` reemplaza esa policy por una que valida el `cliente_id` en el path contra `current_cliente_id()`, cubriendo los 3 patrones reales que usa `supabase.js` (`logos/{cliente_id}/...`, `portada/{cliente_id}/...`, `{cliente_id}/{propiedad_id}/...`). La lectura pública no se toca (sigue siendo por `getPublicUrl`, fuera de RLS).

**Hallazgo posterior, más grave — reclasificado a CRÍTICO**: al pedir `select ... from pg_policies where schemaname='storage' and tablename='objects'` en el proyecto real, apareció algo que no estaba en ninguna migración del repo (se había configurado a mano en el dashboard de Supabase en algún momento): 3 buckets con acceso **público sin login**, no solo sin aislamiento por cliente.
- `propiedades-imagenes`: además de la policy de `authenticated` de arriba, había policies de `anon` con `INSERT`/`DELETE` sin ninguna condición — cualquiera en internet podía subir o borrar archivos.
- `documentos-respaldatorios` (documentación respaldatoria de contratos/propiedades — potencialmente sensible): `SELECT`/`INSERT`/`DELETE` completamente abiertos a `anon`.
- `contratos-adjuntos`: `SELECT`/`INSERT`/`UPDATE`/`DELETE` abiertos al rol `public` (que en Postgres incluye `anon` **y** `authenticated` — sin distinción real).

Ninguno de estos dos últimos buckets se usa desde página pública alguna (`PropiedadPublica.jsx`, `InmobiliariaPublica.jsx`, `PortalVecino.jsx`) — solo desde componentes de admin logueado (`ContratoDetalleDrawer.jsx`, `DocumentacionRespaldatoriaSection.jsx`). No había ningún caso de uso legítimo para `anon`.

**Fix aplicado (Fase 1)**: `supabase/migrations/0035_storage_cerrar_acceso_anon.sql` borra todas las policies de `anon`/`public` de los 3 buckets y agrega policies `for all to authenticated` (sin condición de bucket_id) para `documentos-respaldatorios` y `contratos-adjuntos` — `propiedades-imagenes` ya tenía su policy de `authenticated` con aislamiento por cliente desde el fix de arriba.

**Fix aplicado (Fase 2)**: `supabase/migrations/0036_storage_fase2_contratos_documentos.sql` reemplaza las policies genéricas de `authenticated` de `contratos-adjuntos` y `documentos-respaldatorios` por unas que validan `cliente_id` con un `EXISTS` contra la tabla de negocio correspondiente (`contratos`, `pagos_contrato`, `propiedades`), ya que estos paths no incluyen `cliente_id` como sí hace `propiedades-imagenes`. Funciona porque en los dos flujos de subida la fila de negocio ya existe en la base **antes** de subir el archivo (se crea el contrato/propiedad/pago primero, recién con ese id ya generado se arma el path y se sube):
- `contratos-adjuntos`, patrón `{contrato_id}/...` (adjuntos del contrato, `createContrato`): valida contra `contratos.cliente_id`.
- `contratos-adjuntos`, patrón `comprobantes/{pago_id}/...` (`registrarPagoContrato`): valida contra `pagos_contrato → contratos.cliente_id`.
- `documentos-respaldatorios`, patrón `{entidadTipo}/{entidadId}/...` (`uploadDocumentoRespaldatorio`): valida contra `propiedades.cliente_id` o `contratos.cliente_id` según `entidadTipo`.

Con esto, los 3 buckets quedan cerrados a `anon` y aislados por `cliente_id` para `authenticated`. Punto 5 completamente resuelto.

**Pendiente de confirmar**: existen otros dos buckets (`contratos-adjuntos`, `documentos-respaldatorios`, usados por `CONTRATOS_BUCKET`/`DOCUMENTOS_BUCKET` en `supabase.js`) sin ninguna migración de RLS trackeada en el repo — se crearon a mano en el dashboard de Supabase en algún momento y no hay forma de confirmar sus policies actuales leyendo solo el código. Falta correr `select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects';` en el SQL Editor para ver si tienen el mismo problema y, si es así, aplicarles un fix análogo.

## 6. MEDIO — CORS abierto (`*`) en todas las Edge Functions

Todas las funciones (`mp-crear-preferencia`, `mp-webhook`, `ml-auth`, `enviar-*`, `extraer-contrato-ia`) devuelven `Access-Control-Allow-Origin: '*'`. Para las funciones realmente públicas (llamadas desde `PropiedadPublica.jsx`, `/consulta/:token`) tiene sentido. Para las que deberían llamarse solo desde el panel admin logueado, `*` no aporta ninguna protección real (ya que además no exigen JWT), pero conceptualmente conviene restringir el `Allow-Origin` al dominio de la app una vez que se resuelva el punto 1 — es defensa en profundidad, no el problema principal.

## 7. BAJO — Envío de mensajes de WhatsApp (Baileys) bien resuelto, con una salvedad

`whatsapp-service/src/middleware/auth.js` y `routes.js` sí están bien: validan el JWT del usuario contra `supabase.auth.getUser`, verifican que el `cliente_id` del perfil coincide con el de la URL, y hay rate-limit de 20 msj/min por cliente. Único detalle: el rate-limit (`sendLog`, un `Map` en memoria del proceso) se resetea en cada restart/redeploy de Railway y no es compartido si en algún momento se escala a más de una instancia — no es un problema de seguridad hoy (es un solo proceso), pero conviene tenerlo presente si se escala horizontalmente.

## 8. Cosas que están BIEN hechas (para que no se toquen sin necesidad)

- `mp-crear-preferencia`: nunca confía en montos mandados por el cliente, siempre recalcula del lado del servidor con los datos reales de la base. Correcto.
- `consultar_deuda_departamento`: doble factor (token no adivinable + email/número de unidad) para exponer datos de deuda a `anon`. Correcto.
- RLS por `cliente_id` vía `current_cliente_id()` aplicada de forma consistente en las tablas de negocio (según `0002`–`0004`).
- `.env` está en `.gitignore` y no se encontró comprometido en el repo.
- Ningún uso de `dangerouslySetInnerHTML`/`eval`/`innerHTML` en `src/`, no se ve superficie de XSS obvia del lado del frontend.
- Secrets (client secrets de ML/MP, `ANTHROPIC_API_KEY`, credenciales de Twilio/Resend) viven solo en secrets de Edge Functions, nunca hardcodeados en el frontend.

---

## Resumen priorizado (por dónde arrancar)

1. **Cerrar el punto 1** (autorización faltante en Edge Functions admin) — es lo más grave, plata y abuso de terceros (Twilio/Resend/Anthropic) en juego, y es explotable hoy por cualquiera sin cuenta.
2. Agregar validación de firma en `mp-webhook` (punto 2).
3. Decidir conscientemente el trade-off de `portal_expensas_token` (punto 3).
4. Los puntos 4–6 son mejoras de defensa en profundidad, se pueden agendar sin urgencia.
