# Consorcio App — Contexto para Claude

## Stack
- React + Vite
- Material UI (MUI v5)
- React Router v6
- Supabase (base de datos principal — CRUD completo)
- Airtable (solo autenticación/login)

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
    AuthContext.jsx                # Login/logout, user en contexto global (custom, no Supabase Auth)
  services/
    airtable.js                   # Login contra Airtable
    supabase.js                   # CRUD principal (consorcios, departamentos, propietarios, expensas, reclamos, CRM, MercadoLibre)
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
    Dashboard.jsx                 # CRMSection (hero + consultas web + propiedades + seguimiento + visitas); tabla cobros oculta temporalmente
    Configuracion.jsx             # Config. general (pendiente) + Integraciones (MercadoLibre, ZonaProp) — ruta /configuracion
    Consorcios.jsx                # Drawer detalle + Drawer nuevo consorcio
    NuevoConsorcio.jsx            # (ruta legacy, la creación ahora es por drawer)
    ConsorcioDetalle.jsx
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
    Contratos.jsx
supabase/
  functions/                      # Edge Functions (Deno) — deployadas con --no-verify-jwt (la app no usa Supabase Auth)
    ml-auth/                      # Intercambia code de OAuth por access_token/refresh_token (usa ML_CLIENT_SECRET)
    ml-test/                      # Valida el token guardado llamando a /users/me de MercadoLibre
```

## Páginas públicas (sin autenticación)
- `/p/:id` → `PropiedadPublica.jsx`: ficha pública de una propiedad individual, con modal de contacto que crea registros en `consultas_web`
- `/inmobiliaria/:clienteId` → `InmobiliariaPublica.jsx`: catálogo público con todas las propiedades disponibles de un cliente (excluye Baja/Vendida), filtros por operación/tipo/provincia/búsqueda, cards clickeables que navegan a `/p/:id`
- `/ml-callback` → `MlCallback.jsx`: recibe el `code` de OAuth de MercadoLibre y llama a la Edge Function `ml-auth`

## Supabase — Tablas
- `consorcios`: id (UUID PK), nombre, id_administrador (UUID FK a usuarios)
- `departamentos`: id (serial PK), numeracion, inquilino, id_propietario (FK), id_consorcio (UUID FK), coeficiente
- `propietarios`: id (serial PK), dni, nombre, apellido, id_consorcio (UUID FK)
- `usuarios`: id (UUID PK), nombre_usuario, password, rol
- `reclamos`: id, descripcion, estado, fecha, propietario_id, consorcio_id, departamento_id, usuario_id
- `periodos_expensas`: id, consorcio_id, mes, anio, estado ('abierto'|'cerrado'), usuario_id
- `gastos`: id, periodo_id, nombre, monto, categoria, tipo, proveedor, comprobante, departamentos_ids (INTEGER[])
- `expensas_departamento`: id, periodo_id, departamento_id, monto_ordinario, monto_extraordinario, monto_total, pagado (bool), monto_pagado
- `propiedades`: id, cliente_id, titulo, tipo_propiedad (Casa/Departamento/Terreno/Local/Oficina), tipo_operacion ('Venta'/'Alquiler', con mayúscula), estado (Disponible/Reservada/Vendida/Baja), precio_publicacion, moneda, direccion, localidad, provincia, ambientes, dormitorios, banios, cochera, metros_cubiertos, metros_totales, descripcion, ml_item_id, ml_status
- `propiedades_imagenes`: id, propiedad_id, storage_path, orden — fotos en Supabase Storage (bucket público), URL via `getPublicImageUrl()`
- `contactos`: id, cliente_id, nombre, apellido, dni, telefono, email, tipos[], tipo_operacion, presupuesto, zona_interes[]
- `contactos_propiedades`: tabla puente contacto↔propiedad (un contacto puede tener varias propiedades vinculadas)
- `prospectos` (= "seguimientos" en la UI): id, cliente_id, nombre, apellido, telefono, email, etapa_id, asignado_nombre, cerrado, cierre_exitoso, contacto_id, propiedad_id, tipo_operacion, origen_web
- `etapas_crm`: id, nombre, orden — etapas del Kanban de seguimiento (colores: azul/ámbar/violeta/verde por orden)
- `visitas`: id, prospecto_id, propiedad_id, fecha, hora
- `consultas_web`: id, cliente_id, nombre, apellido, dni, telefono, email, propiedad_id, estado ('pendiente'/'convertida'/'inactiva'), presupuesto, zona_interes, mensaje — alimentada desde `PropiedadPublica.jsx`
- `historial_prospectos`: id, prospecto_id, usuario_nombre, accion, created_at
- `ml_tokens`: id, cliente_id (UNIQUE), access_token, refresh_token, ml_user_id, expires_at — tokens OAuth de MercadoLibre por cliente
- `clientes_servicio` (ojo: singular): id, nombre, logo_url, sobre_nosotros, email_contacto, whatsapp, telefono, coordenadas (texto "lat, lng"), redes_sociales (JSONB array de `{tipo, valor}`, tipo ∈ Instagram/Página web/Otro, máx 3) — configurado desde `Configuracion.jsx`, consumido por `InmobiliariaPublica.jsx`. Logo se sube al bucket `propiedades-imagenes` bajo `logos/{cliente_id}/`
- RLS habilitado con políticas abiertas (auth manejada externamente)

## Integración MercadoLibre
- App ID: `3889570283764172` (público, hardcodeado en frontend). Client secret SOLO vive en Supabase Edge Functions (`ML_CLIENT_SECRET`), nunca en el frontend.
- Redirect URI fija: `https://consorcios-app.vercel.app/ml-callback` (ML no acepta localhost; testear siempre contra Vercel)
- Flujo OAuth: botón conectar → `auth.mercadolibre.com.ar/authorization` → `/ml-callback` → Edge Function `ml-auth` intercambia code por tokens → guarda en `ml_tokens`
- Edge Functions deployadas con `--no-verify-jwt` (la app no usa Supabase Auth, así que no hay JWT de sesión válido para Supabase)
- `ml-test`: llama a `GET /users/me` de ML con el token guardado para validar que la conexión sigue activa
- Conexión/desconexión visible en `Propiedades.jsx` (botones) y en `Configuracion.jsx` (switch en card de integración)
- Pendiente: Edge Function `ml-publish` para publicar propiedades (esperando que ML habilite la cuenta como inmobiliaria); usuarios de prueba de ML ya no se pueden crear desde el dashboard — usar cuenta secundaria real para testing

## Airtable — Tabla usuarios
- Campos: nombre_usuario, password, rol
- Login: busca por nombre_usuario, compara password en cliente

## Variables de entorno (.env) — NO commitear
```
VITE_AIRTABLE_API_KEY=
VITE_AIRTABLE_BASE_ID=
VITE_AIRTABLE_USUARIOS_TABLE=usuarios
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
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

## Importación masiva de propietarios (Excel)
- Librería: SheetJS (`xlsx`)
- Columnas esperadas: Unidad, Propietario (Apellido Nombre), DNI
- Si la Unidad no existe en el consorcio → se crea el departamento automáticamente
- Función: `importarPropietarios(filas, id_consorcio)` en supabase.js

## Migraciones SQL pendientes / aplicadas
```sql
-- Ejecutar en Supabase si no están aplicadas:
ALTER TABLE gastos ADD COLUMN departamentos_ids INTEGER[];
```
