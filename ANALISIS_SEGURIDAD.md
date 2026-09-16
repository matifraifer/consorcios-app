# Análisis de seguridad — Consorcio App

Fecha: 2026-09-16
Alcance: revisión manual de Edge Functions (`supabase/functions/`), RLS/RPCs (`supabase/migrations/`) y `whatsapp-service/`. No se ejecutó un pentest activo (no se probó contra el proyecto real desplegado), es lectura de código.

Convención de severidad: **Crítico** (explotable hoy, impacto directo en plata/datos de terceros) / **Alto** / **Medio** / **Bajo**.

---

## 1. ✅ RESUELTO (verificado 2026-09-16) — Edge Functions administrativas sin ninguna autorización

**Estado**: corregido y verificado leyendo el código actualizado. Las 7 funciones afectadas (`enviar-link-consulta`, `enviar-liquidacion-whatsapp`, `enviar-recordatorios-whatsapp`, `extraer-contrato-ia`, `ml-auth`, `mp-auth`) ahora tienen una función `validarAcceso` que exige el JWT del usuario logueado y compara su `cliente_id` contra el recurso pedido, antes de ejecutar cualquier acción. `enviar-recordatorios-whatsapp` además soporta correctamente el modo cron (sin `consorcio_id`) exigiendo un header `x-cron-secret` en vez de JWT, y la migración `0015_recordatorios_whatsapp.sql` quedó documentada con ese secret. Pendiente solo un paso operativo (no de código): cargar el secret `CRON_SECRET` en Supabase antes de activar el bloque de `pg_cron` comentado en la migración.

Se deja el detalle original del hallazgo abajo como referencia histórica.

<details>
<summary>Hallazgo original (ya corregido)</summary>

Varias funciones están deployadas con `--no-verify-jwt` (según indica el propio CLAUDE.md) porque se llaman con la `anon key` en vez del JWT de sesión. El problema es que **ninguna de ellas valida después, dentro del código, que quien llama tiene permiso sobre el `cliente_id`/`consorcio_id`/`departamento_id` que le pasan como parámetro**. La `anon key` es pública (está en el bundle del frontend, cualquiera la puede extraer con las devtools), así que en la práctica estos endpoints son invocables por cualquier persona en internet con un simple `curl`, sin login y sin pertenecer a ningún cliente.

Funciones afectadas y qué puede hacer un atacante sin autenticarse:

- **`enviar-liquidacion-whatsapp`** (`supabase/functions/enviar-liquidacion-whatsapp/index.ts`): recibe `{ consorcio_id }` y manda WhatsApp (Twilio) a **todos** los teléfonos con deuda de ese consorcio. Sin ningún chequeo de que quien llama es admin de ese cliente. `consorcio_id` es un UUID pero no hace falta adivinarlo: alcanza con mirar la red del navegador logueado como cualquier cliente, o simplemente probar. Impacto: spam masivo a vecinos de cualquier consorcio, agotar el saldo de Twilio, dañar la reputación del número de WhatsApp (riesgo de ban, que ya está documentado como riesgo pero acá se vuelve trivial de gatillar por un tercero).
- **`enviar-recordatorios-whatsapp`**: mismo problema, y encima soporta invocarse **sin ningún body** (`consorcio_id` opcional) — en ese caso corre sobre **todos los consorcios de la plataforma** que tengan `dias_recordatorio_previo` configurado. Un atacante externo puede disparar el job completo de recordatorios cuando quiera, tantas veces como quiera (la deduplicación por `recordatorios_whatsapp_enviados` evita reenviar el mismo período, pero no evita el abuso ni el consumo de la API de Twilio).
- **`enviar-link-consulta`**: recibe `{ departamento_id }` (un `serial` int, trivialmente enumerable: 1, 2, 3...) y manda un email a la casilla cargada en ese departamento, sin validar quién pidió el envío. Permite bombardear de mails a cualquier propietario/inquilino de cualquier cliente de la plataforma, o simplemente barrer el rango de IDs para confirmar cuáles existen y a qué mail están asociados (aunque el mail no se devuelve en la respuesta, sí se filtra si existe o no vía el mensaje de error "no tiene email cargado" vs éxito).
- **`ml-auth`**: recibe `{ code, redirect_uri, cliente_id }` y hace `upsert` en `ml_tokens` con `onConflict: cliente_id`. Sin validar que el `cliente_id` pertenece a quien está haciendo el flujo OAuth. Un atacante que arranque su propio flujo de OAuth de MercadoLibre (con su propia cuenta ML) puede terminar el intercambio pasando el `cliente_id` **de otro cliente** de la plataforma, pisando el token de integración de MercadoLibre de esa otra inmobiliaria con el suyo propio. Esto no roba plata directamente, pero secuestra la integración de otro tenant (puede publicar/leer con la cuenta de ML del atacante en nombre del cliente correcto, o simplemente romperle la integración).
- **`extraer-contrato-ia`**: acepta cualquier texto y lo manda a la API de Anthropic con la key del proyecto. No hay ningún control de cuota/autenticación — es un proxy abierto a la API de Claude pagado por vos. Un atacante puede automatizar llamadas para consumir el crédito de la cuenta (costo, no fuga de datos).
- **`mp-auth`** (no reproducido el código completo acá, pero sigue el mismo patrón que `ml-auth`): mismo riesgo de secuestro de integración de Mercado Pago de otro cliente si no valida el `cliente_id` contra quien inició el OAuth.

**Por qué importa más que un bug menor**: estas funciones no son solo "endpoints públicos con datos públicos" (como sí es, correctamente, el flujo de `/consulta/:token`), son acciones administrativas (mandar comunicaciones masivas, escribir tokens de integraciones de terceros) pensadas para ser gatilladas únicamente desde botones del panel de admin logueado, pero técnicamente no hay nada que lo garantice.

**Cómo corregirlo** (sin cambiar el modelo `--no-verify-jwt`, que tiene sentido para las funciones realmente públicas):
- Para las que se llaman **desde el panel logueado** (`enviar-liquidacion-whatsapp`, `enviar-recordatorios-whatsapp` cuando se dispare manualmente, `ml-auth`, `mp-auth`, `extraer-contrato-ia`): exigir el JWT del usuario (sacarles `--no-verify-jwt`, o si se necesita igual por algún motivo, validar el `Authorization: Bearer <jwt-de-sesión>` a mano dentro de la función con `supabase.auth.getUser(token)` + chequear que el `cliente_id` del perfil coincide con el parámetro recibido — exactamente el patrón que ya usan en `whatsapp-service/src/middleware/auth.js`, que está bien hecho).
- Para `enviar-recordatorios-whatsapp` en su modo cron (llamada automática diaria sin usuario logueado): protegerla con un secret compartido (header custom tipo `x-cron-secret`) que solo conozca el propio `pg_cron`, en vez de dejarla abierta a cualquiera.

</details>

---

## 2. ALTO — `mp-webhook` no valida la firma de Mercado Pago

`supabase/functions/mp-webhook/index.ts` hace bien lo más importante (nunca confía en el `status` del payload, siempre re-consulta `GET /v1/payments/:id` contra la API de MP antes de marcar como aprobado). Pero:

- No valida la firma del webhook (`x-signature` / `x-request-id`) que Mercado Pago permite verificar. Sin eso, cualquiera puede pegarle al endpoint con `pago_id` + `paymentId` arbitrarios. El daño está acotado porque igual se revalida contra la API real de MP con el `access_token` del cliente dueño del pago — pero si un atacante logra un `payment_id` real (por ejemplo, de un pago propio, chico, aprobado en la cuenta de MP de un consorcio) podría enviarlo con un `pago_id` ajeno para intentar cruzar estados de pagos entre departamentos distintos, aunque el `access_token` usado siempre es el del `cliente_id` dueño de `pago_id`, así que el intento de pago de un `payment_id` de OTRA cuenta de MP fallaría al consultar. En la práctica el vector real explotable es más limitado, pero la falta de verificación de firma es una desviación de la práctica recomendada por Mercado Pago y vale la pena cerrarla.

## 3. ALTO — `portal_expensas_token` autentica solo con el token (sin segundo factor)

`supabase/migrations/0028_portal_expensas_token_cliente.sql`, función `portal_expensas_token(p_token uuid)`: a diferencia de `consultar_deuda_departamento` (que exige token **+ email + numeración**), esta RPC devuelve toda la deuda, gastos y datos de otras unidades del mismo cliente con **solo el token** como credencial. Es consistente con el uso previsto (link de WhatsApp que ya "sabe" quién es), pero si ese link se reenvía, se filtra en un chat grupal, o queda en el historial de un teléfono compartido, cualquiera con el link tiene acceso total sin más verificación. Vale la pena decidir conscientemente si se acepta ese trade-off (UX vs. seguridad) o se le agrega una validación liviana adicional (por ejemplo pedir el DNI la primera vez y dejarlo en `localStorage` del lado del portal).

## 4. MEDIO — `email_for_username` es un oráculo de enumeración de usuarios

`supabase/migrations/0005_username_login_rpc.sql`: función `security definer`, callable por `anon`, sin rate limit propio (más allá del rate limit genérico de Supabase Auth). Devuelve `null` si el usuario no existe y el email si existe. Permite a un atacante enumerar `nombre_usuario` válidos de la plataforma probando strings comunes, y de paso confirmar el email asociado a cada uno (útil para un ataque de phishing dirigido o para intentar el login por fuerza bruta solo contra usuarios confirmados). Es una superficie chica pero real. Sugerencia: agregar un delay artificial o, mejor, mover la resolución username→email a una Edge Function con rate-limit propio en vez de una RPC de Postgres sin control de frecuencia.

## 5. MEDIO — Bucket de Storage sin aislamiento por cliente

Ya está documentado como pendiente en el propio `CLAUDE.md`, lo confirmo leyendo `0003_storage_authenticated_uploads.sql`: la policy de escritura del bucket `propiedades-imagenes` es `to authenticated using (bucket_id = 'propiedades-imagenes')`, sin condición sobre el path. **Cualquier usuario logueado de cualquier cliente puede sobrescribir o borrar fotos, logos o portadas de otro cliente** si conoce (o adivina) su `cliente_id` — y `cliente_id` es de lectura pública (aparece en la URL `/inmobiliaria/:clienteId` y es un UUID secuencial de Supabase, no criptográficamente random en el sentido de ser "capability", pero tampoco es trivial de fuerza bruta por ser UUID v4). El riesgo real es más bajo que "cualquiera de internet" (hace falta estar logueado con alguna cuenta de la plataforma), pero sigue siendo un usuario de la inmobiliaria A pudiendo dañar contenido de la inmobiliaria B. Confirma que sigue sin resolverse.

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
