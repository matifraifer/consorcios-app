# Consorcio App — Contexto para Claude

## Stack
- React + Vite
- Material UI (MUI v5)
- React Router v6
- Supabase (base de datos principal — CRUD completo, y autenticación via Supabase Auth)

## Preferencias
- **Idioma**: español en la UI, inglés en el código
- **Comunicación**: responder siempre en español
- **UI**: Material UI en todos los componentes nuevos
- No usar emojis
- Respuestas concisas

## Estructura de archivos
```
src/
  theme.js                        # Fuente Poppins, colores MUI
  main.jsx
  App.jsx                         # Rutas con React Router v6
  contexts/
    AuthContext.jsx                # Login/logout via Supabase Auth (signInWithPassword), perfil (rol/cliente_id) desde tabla usuarios
  services/
    supabase.js                   # CRUD principal (consorcios, departamentos, propietarios, expensas, reclamos, CRM, MercadoLibre) + auth
  components/
    Layout.jsx                    # Sidebar + Outlet
    Sidebar.jsx                   # Colapsable, color activo #065F46, secciones: Gestión comercial / Base de datos / Gestión de contratos
    ProtectedRoute.jsx
    PropiedadFormDrawer.jsx       # Alta/edición de propiedad + carga de fotos (Supabase Storage)
    PropiedadDetalleDrawer.jsx    # Detalle de propiedad
    contactos/ContactoFormDrawer.jsx
    contratos/ContratoFormDrawer.jsx
    consultas/ConsultaDetalleDrawer.jsx
    prospectos/                   # ProspectoFormDrawer, ContactoDrawer (detalle seguimiento), VisitaDrawer, NegociacionDrawer, CierreDrawer
    dashboard/                    # DashboardFiltros, DashboardKPIs, DeudaPorConsorcioTable, CRMSection
  pages/
    Login.jsx
    CambiarPassword.jsx           # ruta /cambiar-password — fuera de ProtectedRoute pero requiere sesión; forzada cuando mustChangePassword es true
    Dashboard.jsx                 # CRMSection (hero + consultas web + propiedades + seguimiento + visitas); tabla cobros oculta temporalmente
    Configuracion.jsx             # Config. general (pendiente) + Integraciones (MercadoLibre, ZonaProp) — ruta /configuracion
    Consorcios.jsx                # Drawer detalle + Drawer nuevo consorcio
    NuevoConsorcio.jsx            # (ruta legacy, la creación ahora es por drawer)
    ConsorcioDetalle.jsx            # Tabs: Unidades funcionales (ex "Departamentos", la pestaña "Propietarios" se eliminó por redundante) / Expensas / Liquidaciones
    NuevoDepartamento.jsx
    NuevoDepartamentoGlobal.jsx
    Departamentos.jsx
    Propietarios.jsx              # Drawer nuevo + Drawer importación Excel masiva
    NuevoPropietario.jsx          # (ruta legacy)
    Reclamos.jsx
    NuevoReclamo.jsx
    ReclamoDetalle.jsx
    Expensas.jsx                  # Lista de períodos
    NuevoPeriodo.jsx
    ExpensasDetalle.jsx           # Gastos + Liquidación + Pagos por depto
    Propiedades.jsx               # CRUD de propiedades + integración MercadoLibre (conectar/probar/desconectar)
    Prospectos.jsx                # "Seguimiento de contactos" — Kanban drag&drop por etapas (dnd-kit)
    Contactos.jsx                 # Base de datos de contactos
    ConsultasWeb.jsx               # Consultas entrantes desde la web pública (PropiedadPublica)
    PropiedadPublica.jsx          # Página PÚBLICA (sin auth) de UNA propiedad — ruta /p/:id, con modal de contacto
    InmobiliariaPublica.jsx       # Página PÚBLICA (sin auth) catálogo de TODAS las propiedades de un cliente — ruta /inmobiliaria/:clienteId, con filtros (operación/tipo/provincia/búsqueda); cada card navega a /p/:id
    MlCallback.jsx                # Callback OAuth de MercadoLibre — ruta /ml-callback (fuera de ProtectedRoute)
    MpCallback.jsx                 # Callback OAuth de Mercado Pago — ruta /mp-callback (fuera de ProtectedRoute)
    Contratos.jsx
    WhatsApp.jsx                   # ruta /whatsapp — lista de mensajes + envío (MVP de la integración WhatsApp)
supabase/
  migrations/                    # SQL manuales, se corren a mano en el SQL Editor de Supabase
  functions/                      # Edge Functions (Deno) — deployadas con --no-verify-jwt
    ml-auth/                      # Intercambia code de OAuth por access_token/refresh_token (usa ML_CLIENT_SECRET)
    ml-test/                      # Valida el token guardado llamando a /users/me de MercadoLibre
    mp-auth/                       # Intercambia code de OAuth de Mercado Pago por tokens (usa MP_CLIENT_SECRET), upsert en mp_tokens
    mp-test/                       # Valida el token guardado llamando a /users/me de Mercado Pago
    mp-crear-preferencia/          # Pública (anon) — valida identidad por token_consulta+email+numeración, calcula el monto por período (con mora) server-side y crea la preferencia de Checkout Pro
    mp-webhook/                    # Pública — recibe la notificación de pago, confirma el estado real contra la API de MP y marca expensas_departamento como pagado
    enviar-link-consulta/          # Reenvía por email (Resend) el link de consulta de deuda de un departamento — usada desde ConsorcioDetalle.jsx (botón reenviar / al cargar email por primera vez)
    enviar-recordatorios-whatsapp/ # Recordatorio automático de vencimiento por WhatsApp (Twilio) — ver sección "Integración Twilio"
    enviar-liquidacion-whatsapp/   # Envío manual, a pedido del admin, del saldo total adeudado por WhatsApp a todas las unidades con teléfono y deuda — botón en ConsorcioDetalle.jsx (tab Liquidaciones)
whatsapp-service/                 # Proceso Node persistente (Baileys) — deployado aparte en Railway, ver sección "Integración WhatsApp"
  src/
    index.js, sessions.js, authState.js, routes.js, supabaseAdmin.js, middleware/auth.js
```

## Páginas públicas (sin autenticación)
- `/p/:id` → `PropiedadPublica.jsx`: ficha pública de una propiedad individual, con modal de contacto que crea registros en `consultas_web`
- `/inmobiliaria/:clienteId` → `InmobiliariaPublica.jsx`: catálogo público con todas las propiedades disponibles de un cliente (excluye Baja/Vendida), filtros por operación/tipo/provincia/búsqueda, cards clickeables que navegan a `/p/:id`
- `/consulta/:token` → `ConsultaDeudaPublica.jsx`: consulta de deuda por unidad (valida email + número de unidad contra el `token_consulta` no adivinable, RPC `consultar_deuda_departamento`), con selección de períodos adeudados y pago vía Mercado Pago (ver sección "Integración Mercado Pago")
- `/ml-callback` → `MlCallback.jsx`: recibe el `code` de OAuth de MercadoLibre y llama a la Edge Function `ml-auth`
- `/mp-callback` → `MpCallback.jsx`: recibe el `code` de OAuth de Mercado Pago y llama a la Edge Function `mp-auth`

## Supabase — Tablas
(relevado directo del proyecto via MCP de Supabase — `list_tables`)

### Consorcios / expensas
- `consorcios`: id (UUID PK), nombre, cliente_id (FK clientes_servicio), tasa_mora (numeric, default 0), comision_plataforma_fee (numeric, nullable — fee fijo de la plataforma por pago vía Mercado Pago; null/0 = sin cargo), permite_pagos_parciales (bool, default true — si false, el propietario solo puede pagar el total adeudado, no períodos sueltos), dias_recordatorio_previo (integer, nullable — días antes del `fecha_vencimiento` del período en que se manda el recordatorio automático por WhatsApp vía Twilio; null = desactivado. Se edita en `ConsorcioDetalle.jsx`, junto a `tasa_mora`)
- `departamentos`: id (serial PK), numeracion, propietario (text libre, legacy, sin uso), inquilino, id_propietario (FK propietarios, legacy — ya no se escribe desde ningún formulario, se mantiene por datos históricos), propietario_nombre, propietario_apellido, propietario_dni (text, nullable — dato del propietario cargado directo en el departamento, reemplaza al desplegable de `propietarios` en los formularios de alta; misma convención que `contratos.propietario_nombre/apellido/dni`), id_consorcio (UUID FK), coeficiente, email, telefono (text, nullable — formato E.164, usado por los recordatorios de WhatsApp vía Twilio), token_consulta (UUID unique — link de consulta sin login para el propietario/inquilino), activo (boolean, default true — baja lógica: "Eliminar" en la UI nunca borra la fila, solo pone `activo=false`)
- `propietarios`: id (serial PK), dni, nombre, apellido, id_consorcio (UUID FK), cliente_id
- `usuarios`: id (serial PK), nombre_usuario, rol, cliente_id, email (login), auth_user_id (FK a `auth.users.id`) — ya no tiene columna `password`, la autenticación es 100% Supabase Auth (ver sección Autenticación)
- `reclamos`: id, descripcion, estado, fecha, propietario_id, consorcio_id, departamento_id, usuario_id, cliente_id
- `periodos_expensas`: id, consorcio_id, mes, anio, estado ('abierto'|'cerrado'), usuario_id (text), cliente_id, created_at, fecha_vencimiento
- `gastos`: id, periodo_id, nombre, monto, categoria, tipo, proveedor, comprobante, departamentos_ids (INTEGER[]), created_at
- `expensas_departamento`: id, periodo_id, departamento_id, monto_ordinario, monto_extraordinario, monto_total, pagado (bool), monto_pagado

### Propiedades / CRM inmobiliario
- `propiedades`: id (UUID), cliente_id, titulo, tipo_propiedad, tipo_operacion ('Venta'/'Alquiler'), estado (Disponible/Reservada/Vendida/Baja), precio_publicacion, moneda, direccion, localidad, provincia, latitud, longitud, ambientes, dormitorios, banios, cochera, metros_cubiertos, metros_totales, descripcion, observaciones_internas, propietario_id (text libre), contacto_id (FK contactos), comprador_nombre/dni/telefono, fecha_venta, precio_final_venta, visitas_count, ml_item_id, ml_status, created_at, updated_at
- `propiedades_imagenes`: id, propiedad_id, storage_path, orden, created_at — fotos en Supabase Storage (bucket público), URL via `getPublicImageUrl()`
- `propiedades_ext`: id, anuncio_id (unique), url, titulo, precio/precio_moneda/precio_valor, zona, visitas, descripcion, dormitorios, banos, metros_cubiertos, metros_terreno, antiguedad, apta_credito, barrio_privado, estado, contacto_nombre, contacto_tel, contacto_id (FK contactos), scrapeado_en, actualizado_en — listados de terceros scrapeados (~3150 filas), sin `cliente_id` propio, compartida entre todos los clientes
- `contactos`: id (serial), cliente_id, nombre, apellido, dni, telefono, email, notas, activo, origen (default 'APP'), creado_por, asignado_nombre, tipo (text legacy, singular), tipos (text[], reemplaza a `tipo`), tipo_propiedad_busca (text[]), tipo_operacion, presupuesto, moneda_presupuesto (default 'ARS'), zona_interes (text[])
- `contactos_propiedades`: tabla puente contacto↔propiedad (id, contacto_id, propiedad_id, tipo, created_at)
- `contactos_propiedades_ext`: tabla puente contacto↔propiedad_ext (PK compuesta contacto_id+propiedad_ext_id, cliente_id)
- `prospectos` (= "seguimientos" en la UI): id (UUID), cliente_id, nombre, apellido, telefono, email, tipo_operacion, etapa_id (FK etapas_crm), propiedad_id, contacto_id, presupuesto, zona, zona_interes, tipo_inmueble, credito_hipotecario, asignado_nombre, cerrado, cierre_exitoso, origen_web, created_at, updated_at
- `etapas_crm`: id, nombre, orden (unique) — etapas del Kanban de seguimiento (colores: azul/ámbar/violeta/verde por orden)
- `visitas`: id, prospecto_id, propiedad_id, fecha, hora, created_at
- `propiedades_interes`: id, prospecto_id, propiedad_id, monto_propuesto, forma_pago, created_at — ofertas/propuestas de un prospecto sobre una propiedad
- `historial_prospectos`: id, prospecto_id, usuario_nombre, accion, created_at
- `consultas_web`: id, cliente_id, propiedad_id, contacto_id, dni, nombre, apellido, telefono, email, presupuesto, provincia, zona_interes, estado ('pendiente'/'convertida'/'inactiva'), mensaje, created_at — alimentada desde `PropiedadPublica.jsx`

### Contratos (alquileres)
- `contratos`: id (UUID), cliente_id, propiedad_id, inquilino_nombre/apellido/dni, propietario_nombre/apellido/dni, fecha_inicio, fecha_fin, monto_base, tipo_actualizacion, plazo_actualizacion, dia_vencimiento, observaciones, finalizado (bool), created_at, updated_at
- `pagos_contrato`: id, contrato_id, periodo_numero, periodo_inicio, periodo_fin, monto_base, es_periodo_actualizacion (bool), estado (default 'pendiente'), monto_pagado, fecha_pago, comprobante_path, created_at — un registro por período/mes de alquiler
- `cargos_extra_contrato`: id, pago_id (FK pagos_contrato), descripcion, monto, created_at — cargos adicionales sobre un pago puntual (expensas, reparaciones, etc.)
- `contratos_adjuntos`: id, contrato_id, nombre, storage_path, created_at
- `indices_actualizacion`: id, tipo, mes, anio, valor, cliente_id — índices (IPC/ICL/etc.) usados para calcular actualizaciones de `monto_base` en `pagos_contrato`
- `tipos_documentacion`: id, cliente_id, nombre, orden, created_at — tipos configurables de documentación (usados por `documentos_respaldatorios`)
- `documentos_respaldatorios`: id, cliente_id, propiedad_id, contrato_id, titulo, tipo_documentacion_id (FK), tipo_personalizado, storage_path, nombre_archivo, mime_type, created_at

### Integraciones
- `ml_tokens`: id, cliente_id (UNIQUE), access_token, refresh_token, ml_user_id, expires_at, created_at — tokens OAuth de MercadoLibre por cliente
- `mp_tokens`: cliente_id (PK), access_token, refresh_token, public_key, mp_user_id, expires_at, created_at — tokens OAuth de Mercado Pago por cliente (cada consorcio cobra a su propia cuenta)
- `mp_pagos`: id (UUID), cliente_id, departamento_id, periodos_ids (INTEGER[] — períodos de `periodos_expensas` cubiertos por ese pago), monto (total cobrado al propietario, incluye la tarifa de servicio si aplica), comision_plataforma (numeric, nullable — cuánto de `comision_plataforma_fee` se cobró en ese pago), recargo_mp (numeric, nullable — cuánto del recargo corresponde a la comisión de Mercado Pago), preference_id, mp_payment_id, estado ('pendiente'|'aprobado'|'rechazado'), created_at, updated_at — un registro por intento de pago iniciado desde `/consulta/:token`
- `whatsapp_sesiones`: cliente_id (PK), estado ('qr_pendiente'|'conectado'|'desconectado'), qr, numero, auth_state (jsonb — credenciales Baileys serializadas), updated_at
- `whatsapp_mensajes`: id, cliente_id, telefono, direction ('entrante'|'saliente'), body, wa_message_id, created_at
- `recordatorios_whatsapp_enviados`: id (UUID), cliente_id, periodo_id (FK periodos_expensas), departamento_id (FK departamentos), telefono, estado ('enviado'|'error'), error_detalle, created_at — log de recordatorios de vencimiento ya enviados por WhatsApp (Twilio), con `unique(periodo_id, departamento_id)` para no reenviar dos veces el mismo aviso (ver sección "Integración Twilio")

### Otras
- `clientes_servicio` (ojo: singular): id, nombre, logo_url, sobre_nosotros, email_contacto, whatsapp, telefono, coordenadas (texto "lat, lng"), redes_sociales (JSONB array de `{tipo, valor}`, tipo ∈ Instagram/Página web/Otro, máx 3), estado (default 'activo'), fecha_alta, extension (text, unique), portada_urls (text[]), titulo_pagina, color_principal, color_secundario, color_acentuaciones — configurado desde `Configuracion.jsx`, consumido por `InmobiliariaPublica.jsx`. Logo se sube al bucket `propiedades-imagenes` bajo `logos/{cliente_id}/`

RLS por `cliente_id`/`auth.uid()` en todas las tablas (ver sección Autenticación → RLS). Excepciones sin `cliente_id` (compartidas entre todos los clientes, solo lectura para `authenticated`): `etapas_crm`, `propiedades_ext`

## Integración MercadoLibre
- App ID: `3889570283764172` (público, hardcodeado en frontend). Client secret SOLO vive en Supabase Edge Functions (`ML_CLIENT_SECRET`), nunca en el frontend.
- Redirect URI fija: `https://consorcios-app.vercel.app/ml-callback` (ML no acepta localhost; testear siempre contra Vercel)
- Flujo OAuth: botón conectar → `auth.mercadolibre.com.ar/authorization` → `/ml-callback` → Edge Function `ml-auth` intercambia code por tokens → guarda en `ml_tokens`
- Edge Functions deployadas con `--no-verify-jwt` (se llaman con la anon key, no con el JWT de sesión del usuario)
- `ml-test`: llama a `GET /users/me` de ML con el token guardado para validar que la conexión sigue activa
- Conexión/desconexión visible en `Propiedades.jsx` (botones) y en `Configuracion.jsx` (switch en card de integración)
- Pendiente: Edge Function `ml-publish` para publicar propiedades (esperando que ML habilite la cuenta como inmobiliaria); usuarios de prueba de ML ya no se pueden crear desde el dashboard — usar cuenta secundaria real para testing

## Integración Mercado Pago (Checkout Pro, cobro de expensas)
- Modelo: **cada consorcio/cliente conecta su propia cuenta de Mercado Pago** vía OAuth Connect (mismo patrón que MercadoLibre) — el dinero entra directo a esa cuenta, la app no centraliza fondos de terceros
- App ID: pendiente de reemplazar `MP_CLIENT_ID` (constante en `Configuracion.jsx`, hoy `'REEMPLAZAR_MP_CLIENT_ID'`) por el Client ID real de una app de Mercado Pago Developers tipo "Marketplace/Plataforma". Client secret SOLO vive en Supabase Edge Functions (`MP_CLIENT_SECRET`). Client ID/Secret solo aparecen en la pestaña "Credenciales de producción" del panel de MP (no en la de prueba)
- Secret opcional `MP_TEST_MODE=true` en `mp-auth`: agrega `test_token=true` al intercambio OAuth para recibir un access_token tipo `TEST` (sandbox) sin necesitar la cuenta de producción activada — sacarlo (o ponerlo en `false`) al pasar a producción real
- Redirect URI fija: `https://consorcios-app.vercel.app/mp-callback`
- Flujo OAuth: botón conectar en `Configuracion.jsx` → `auth.mercadopago.com.ar/authorization` → `/mp-callback` (`MpCallback.jsx`) → Edge Function `mp-auth` intercambia code por tokens → guarda en `mp_tokens`
- `mp-test`: llama a `GET /users/me` de MP con el token guardado para validar que la conexión sigue activa
- Flujo de cobro (desde `/consulta/:token`, sin login): el propietario/inquilino elige qué períodos adeudados pagar (checkbox por período) → `mp-crear-preferencia` revalida la identidad igual que la RPC `consultar_deuda_departamento`, recalcula el monto de cada período (saldo + mora prorateada) del lado del servidor — nunca confía en montos del cliente —, crea una fila en `mp_pagos` y una preferencia de Checkout Pro con `notification_url=mp-webhook?pago_id=<id>`, y devuelve `init_point` para redirigir al checkout hosteado por MP
- `mp-webhook`: recibe la notificación de MP, busca `mp_pagos` por `pago_id`, y con el `access_token` del cliente dueño de ese pago confirma el estado real contra `GET /v1/payments/:id` (nunca confía en el payload del webhook a ciegas). Si `approved`, marca `mp_pagos.estado` y actualiza `expensas_departamento` (`pagado=true`) de cada período cubierto
- Edge Functions deployadas con `--no-verify-jwt` (se llaman con la anon key)
- Pendiente: crear la app real en Mercado Pago Developers y cargar `MP_CLIENT_ID`/`MP_CLIENT_SECRET`; correr `supabase/migrations/0013_mercadopago.sql` a mano en el SQL Editor
- **Tarifa de servicio (comisión de la plataforma)**: si el consorcio tiene `comision_plataforma_fee` configurado (a mano en la base, no es editable por el cliente desde la UI — es tu modelo de negocio), `mp-crear-preferencia` le recarga al propietario `(deuda + fee) / (1 − 6,19%)` en vez de cobrar solo la deuda. Esto hace que, después de que Mercado Pago descuente su propia comisión (6,19%, constante `MP_COMISION_PCT` en el código — no varía por consorcio), al consorcio le llegue el 100% de la deuda real y a la plataforma le llegue `fee` completo vía el campo `marketplace_fee` de la preferencia (Mercado Pago lo paga aparte, sin que la comisión de MP lo toque). El propietario ve el desglose como "Monto de la expensa" + "Tarifa por servicio" + "Total a pagar" en `ConsultaDeudaPublica.jsx`. Si `comision_plataforma_fee` es null/0, el consorcio sigue funcionando exactamente como antes (sin recargo)
- **Pagos parciales**: `consorcios.permite_pagos_parciales` (default `true`). En `false`, `ConsultaDeudaPublica.jsx` no muestra checkboxes por período — solo el total adeudado con un botón único "Pagar total" — y `mp-crear-preferencia` rechaza la preferencia si no se piden **todos** los períodos impagos

## Integración Twilio (recordatorios automáticos de expensas por WhatsApp)
- Canal aparte de la integración Baileys de abajo (mensajería manual) — este es solo para el recordatorio automático de vencimiento, vía la API oficial de WhatsApp Business de Twilio
- A diferencia de MercadoLibre/Mercado Pago, **no es por cliente**: hay una sola cuenta de Twilio (un solo número de WhatsApp) para toda la plataforma. Las credenciales (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`) viven como secrets de la Edge Function, igual que `RESEND_API_KEY` en `enviar-link-consulta` — no hay tabla ni card en `Configuracion.jsx` para esto
- **Plantilla de WhatsApp (obligatoria)**: WhatsApp Business API no permite texto libre cuando la empresa inicia la conversación (fuera de la ventana de 24hs desde el último mensaje del usuario) — hay que usar una plantilla (Content Template) aprobada por Meta desde Twilio Content Template Builder. El Content SID vive en el secret `TWILIO_TEMPLATE_SID` y ambas funciones (`enviar-recordatorios-whatsapp` y `enviar-liquidacion-whatsapp`) mandan `ContentSid`+`ContentVariables` en vez de `Body`. Plantilla actual: "Hola Vecino/a! Te enviamos el saldo de expensas impago al dia de la fecha del consorcio {{1}}. Saldo total {{2}} fecha de vencimiento del periodo {{3}}", con un botón de URL de base fija `https://app.granito.com.ar/consulta/{{4}}` (variable 4 = solo el `token_consulta`, no la URL completa). Si se edita el texto/orden de variables de la plantilla en Twilio, hay que actualizar el `contentVariables` de ambas funciones para que sigan matcheando
- Cada consorcio activa el envío seteando `consorcios.dias_recordatorio_previo` (días antes del `fecha_vencimiento` del período) en `ConsorcioDetalle.jsx`, al lado de `tasa_mora`. Null = desactivado para ese consorcio
- Cada departamento necesita `telefono` cargado (formato E.164, ej. `+5491122334455`) para poder recibir el recordatorio — campo nuevo en el drawer de edición de departamento, al lado del email
- Edge Function `enviar-recordatorios-whatsapp`: pensada para invocarse una vez por día (vía `pg_cron`/`pg_net`, ver más abajo). Por cada consorcio con `dias_recordatorio_previo` configurado, busca períodos cerrados cuyo `fecha_vencimiento` caiga exactamente en "hoy + esos días", y por cada departamento con `telefono` y saldo impago en ese período le manda un WhatsApp (vía la API de Twilio, `POST /Messages.json`) con el saldo total adeudado (mismo cálculo de mora que `enviar-link-consulta`/`calcularSaldosMora.js`, duplicado en la función por la misma razón: las Edge Functions no comparten bundle con el frontend) y el link de `/consulta/:token`. Cada envío se registra en `recordatorios_whatsapp_enviados`, con `unique(periodo_id, departamento_id)` para no duplicar el aviso si el cron corre más de una vez el mismo día
- Programación: `supabase/migrations/0015_recordatorios_whatsapp.sql` trae, comentado, el `create extension pg_cron`/`pg_net` + `cron.schedule` que invoca la función todos los días a las 12:00 UTC — **pendiente**, hay que reemplazar `<PROJECT_REF>`/`<ANON_KEY>` por los valores reales y correrlo a mano recién después de probar la función manualmente
- Si en algún momento se vuelve a probar contra el número sandbox de Twilio (`+14155238886`) en vez del número de producción, el destino tiene que unirse antes mandando `join <código-sandbox>` desde WhatsApp — si no, Twilio no entrega el mensaje
- **Envío manual**: además del recordatorio automático de arriba, en `ConsorcioDetalle.jsx` (tab Liquidaciones) hay un botón "Enviar liquidación por WhatsApp" al lado de "Descargar PDF" que dispara la Edge Function `enviar-liquidacion-whatsapp` a demanda — manda el saldo total adeudado (mismo cálculo de mora, sin importar `dias_recordatorio_previo` ni fechas de vencimiento) a todas las unidades del consorcio con `telefono` cargado y deuda pendiente. No queda registrado en `recordatorios_whatsapp_enviados` (esa tabla es solo para la deduplicación del envío automático) y se puede reenviar las veces que haga falta; el botón pide confirmación antes de disparar el envío masivo

## Integración WhatsApp (Baileys, MVP)
- Librería `@whiskeysockets/baileys` (login por QR, protocolo no oficial). No corre en el frontend ni en una Edge Function — necesita un proceso Node persistente, primero de este tipo en el proyecto: `whatsapp-service/` (carpeta nueva en este mismo repo, deployada como servicio aparte en **Railway**, Root Directory = `whatsapp-service`)
- Multi-tenant: cada `cliente_id` conecta su propio número, un socket de Baileys en memoria por cliente dentro del mismo proceso (`whatsapp-service/src/sessions.js`)
- Persistencia de sesión: en vez de `useMultiFileAuthState` (disco efímero en Railway), las credenciales de Baileys se guardan serializadas en `whatsapp_sesiones.auth_state` (jsonb) — `whatsapp-service/src/authState.js`. Así un restart no obliga a re-escanear el QR
- Tablas: `whatsapp_sesiones` (1 fila por cliente_id: estado, qr, numero, auth_state) y `whatsapp_mensajes` (log de mensajes entrante/saliente) — ver `supabase/migrations/0011_whatsapp.sql`. El servicio Node escribe con la service-role key (bypassa RLS); el frontend lee con la anon key (RLS por `current_cliente_id()`)
- Frontend: card en `Configuracion.jsx` (conectar/desconectar + Dialog con QR, poll cada 2s a `whatsapp_sesiones`) y página `/whatsapp` (`WhatsApp.jsx`, lista de mensajes + envío, poll cada 5s). Funciones en `supabase.js`: `getWhatsappSesion`, `connectWhatsapp`, `disconnectWhatsapp`, `sendWhatsappMensaje`, `getWhatsappMensajes` — las de connect/disconnect/send llaman al servicio Node (`VITE_WHATSAPP_SERVICE_URL`) con el access token del usuario, no con la anon key
- **MVP intencionalmente acotado**: sin auto-crear `contactos`/`prospectos` desde números entrantes, sin Realtime (polling, como el resto de la app), sin normalización de teléfono con código de país. Ver fase 2 en el plan original si hace falta retomarlo
- Riesgo de ban del número por ser protocolo no oficial — `/send` tiene rate-limit (20 msj/min por cliente) en `whatsapp-service/src/routes.js`

## Autenticación (Supabase Auth)
- Login por **nombre de usuario** (no email) — el frontend resuelve `nombre_usuario` → `email` con la RPC `email_for_username` (SECURITY DEFINER, callable por `anon`, ver `0005_username_login_rpc.sql`) y recién ahí llama a `supabase.auth.signInWithPassword`
- La tabla `usuarios` guarda el perfil de negocio (rol, cliente_id, nombre_usuario) y se vincula a `auth.users` via `usuarios.auth_user_id`
- `AuthContext.jsx`: restaura sesión con `supabase.auth.getSession()` + `onAuthStateChange`, y busca el perfil con `getUsuarioByAuthId()` en `supabase.js`
- Alta de usuarios: manual desde el dashboard de Supabase (Authentication → Users), no hay flujo de self-signup
- **Cambio de contraseña obligatorio**: el flag `must_change_password` vive en `auth.users.raw_user_meta_data` (no en `usuarios`). `AuthContext` lo expone como `mustChangePassword`; `ProtectedRoute.jsx` redirige a `/cambiar-password` (`CambiarPassword.jsx`) mientras esté en `true`. Se limpia al guardar la nueva contraseña (`changePassword()` → `supabase.auth.updateUser`). **Default: `true`** — todo usuario nuevo lo exige automáticamente aunque no se toque el campo "User Metadata" al crearlo (`mustChangePassword` es `true` salvo que el metadata diga explícitamente `{"must_change_password": false}`)
- **RLS**: función `public.current_cliente_id()` (SECURITY DEFINER) resuelve `auth.uid()` → `usuarios.cliente_id`. Todas las tablas tienen policies `for all to authenticated using (cliente_id = current_cliente_id())` (directo o vía `EXISTS` subquery cuando la tabla no tiene `cliente_id` propio, ej. `departamentos` valida contra `consorcios`). `usuarios` y `tipos_documentacion` son solo-lectura para `authenticated` (el frontend no escribe ahí). `propiedades`, `propiedades_imagenes` y `clientes_servicio` además permiten `select` a `anon` (páginas públicas); `consultas_web` permite `insert` a `anon` (formulario de contacto) pero no lectura. Ver `supabase/migrations/0001` a `0004`
- Bucket de Storage `propiedades-imagenes`: policy que permite `insert/update/delete` a `authenticated` (no segmentada por cliente_id todavía); lectura pública porque el bucket es público
- **Pendiente (prioridad baja)**: segmentar por `cliente_id` la escritura en el bucket `propiedades-imagenes`. Hoy cualquier usuario autenticado (de cualquier cliente) puede subir/editar/borrar archivos en la carpeta de storage de OTRO cliente si conoce/adivina su `cliente_id` (es adivinable: `clientes_servicio.id` es de lectura pública y aparece en la URL de `/inmobiliaria/:clienteId`). No es fuga de datos (el bucket ya es público para lectura, eso no cambia), es riesgo de que un usuario logueado de la inmobiliaria A borre/reemplace fotos de la inmobiliaria B. Al implementarlo, la policy tiene que cubrir 3 patrones de path distintos: `logos/{cliente_id}/...`, `portada/{cliente_id}/...`, `{cliente_id}/{propiedad_id}/...`

## Variables de entorno (.env) — NO commitear
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WHATSAPP_SERVICE_URL=   # URL pública del servicio Railway de whatsapp-service
```

## Patrones de diseño establecidos
- **Drawers laterales** (anchor="right") en lugar de navegación a páginas nuevas para: nuevo consorcio, detalle consorcio, nuevo propietario, importar propietarios
- **Color activo sidebar**: #065F46 con borde izquierdo + fondo suave
- **Chips de estado**: variant="outlined" con color semántico + fondo claro mediante sx
- **Modales (Dialog)**: para formularios de gastos, registro de pagos, confirmación de cierre de período
- Todos los formularios validan en cliente antes de llamar a Supabase

## Lógica de liquidación (ExpensasDetalle)
- Cada gasto puede asignarse a un subconjunto de departamentos via `departamentos_ids INTEGER[]`
- NULL en `departamentos_ids` = aplica a todos los departamentos
- Distribución por coeficiente normalizado al subconjunto asignado; si ninguno tiene coeficiente → distribución igualitaria
- `saveExpensasDepartamento`: delete + re-insert preservando pagado/monto_pagado
- **Unidades inactivas (`departamentos.activo = false`)**: `getDepartamentosConCoeficiente` sigue devolviendo TODAS las unidades (activas e inactivas) — no filtra en el server — porque `calcLiquidacion`/`saveExpensasDepartamento` necesitan la lista completa para no perder la liquidación ya guardada de una unidad que se inactivó después de tener gastos asignados (el delete+re-insert de arriba borraría esa fila si se las excluyera acá). El filtro "no ofrecer unidades inactivas para asignar un gasto nuevo" se hace en la UI: `ExpensasDetalle.jsx` y `GastosPeriodoDrawer.jsx` derivan `departamentosActivos = departamentos.filter(d => d.activo !== false)` y lo usan solo para el `<Select>` de "Departamentos asignados" y los defaults de "seleccionar todos" — el resto (`calcLiquidacion`, `deptoNumMap`, el chip "Todos" de un gasto ya guardado) sigue usando la lista completa

## Importación masiva por Excel (Unidad / Propietario / DNI)
- Librería: SheetJS (`xlsx`). Mismas columnas esperadas (Unidad, Propietario "Apellido Nombre", DNI) y misma lógica de "si la Unidad no existe se crea el departamento" en las dos variantes de abajo — solo cambia qué tabla actualizan.
- `importarPropietarios(filas, id_consorcio, cliente_id)` en `supabase.js`: crea una fila en `propietarios` y linkea por `departamentos.id_propietario`. La usa **solo** la página global `/propietarios` (`Propietarios.jsx`).
- `importarDepartamentosExcel(filas, id_consorcio)` en `supabase.js`: no toca `propietarios`, escribe `propietario_nombre/apellido/dni` directo en `departamentos`. La usa **solo** la pestaña "Unidades funcionales" de `ConsorcioDetalle.jsx` (botón "Importar desde Excel").

## Migraciones SQL pendientes / aplicadas
```sql
-- Ejecutar en Supabase si no están aplicadas:
ALTER TABLE gastos ADD COLUMN departamentos_ids INTEGER[];
```
- `supabase/migrations/0001_auth_migration.sql`: agrega `email`/`auth_user_id` a `usuarios` y los vincula a `auth.users` — correr a mano en el SQL Editor (ver pasos en el archivo)
- `supabase/migrations/0002_rls_propiedades_clientes.sql`, `0003_storage_authenticated_uploads.sql`, `0004_rls_resto_tablas.sql`: aplicadas — RLS por `cliente_id` en todas las tablas (ver sección Autenticación → RLS)
- `supabase/migrations/0005_username_login_rpc.sql`, `0006_force_password_change.sql`: aplicadas — login por `nombre_usuario` y cambio de contraseña obligatorio
- `supabase/migrations/0011_whatsapp.sql`: **pendiente** — crea `whatsapp_sesiones`/`whatsapp_mensajes` + RLS, correr a mano antes de deployar `whatsapp-service/`
- `supabase/migrations/0013_mercadopago.sql`: **pendiente** — crea `mp_tokens`/`mp_pagos` + RLS, correr a mano antes de deployar las Edge Functions `mp-*`
- `supabase/migrations/0014_comision_plataforma.sql`: **pendiente** — agrega `comision_plataforma_fee`/`permite_pagos_parciales` a `consorcios`, columnas nuevas en `mp_pagos`, y actualiza la RPC `consultar_deuda_departamento` para devolver esos campos
- `supabase/migrations/0015_recordatorios_whatsapp.sql`: **pendiente** — agrega `telefono` a `departamentos` y `dias_recordatorio_previo` a `consorcios`, crea `recordatorios_whatsapp_enviados`; el bloque de `pg_cron`/`pg_net` para automatizar el envío diario queda comentado dentro del archivo, correr aparte y a mano después de probar la Edge Function `enviar-recordatorios-whatsapp` (y de cargar los secrets `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_NUMBER`)
- `supabase/migrations/0016_propietario_departamento_texto.sql`: **pendiente** — agrega `propietario_nombre`/`propietario_apellido`/`propietario_dni` a `departamentos` y hace backfill desde el propietario ya vinculado por `id_propietario` (que queda como FK legacy, sin escribirse más desde los formularios)
- `supabase/migrations/0017_departamentos_activo.sql`: **pendiente** — agrega `departamentos.activo` (default true) para la baja lógica de unidades funcionales
