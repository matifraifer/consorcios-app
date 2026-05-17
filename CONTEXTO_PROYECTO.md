# Contexto del Proyecto — Consorcios App

## Descripcion general

Aplicacion web de gestion inmobiliaria y administracion de consorcios. Tiene dos modulos principales:

1. **CRM Inmobiliario**: gestion de propiedades en venta/alquiler, prospectos (leads), visitas, contratos de alquiler y contactos.
2. **Administracion de consorcios**: gestion de consorcios, departamentos, propietarios, expensas y reclamos.

Es una aplicacion multi-tenant: cada cliente (inmobiliaria/administradora) tiene sus propios datos aislados via `cliente_id`.

---

## Stack tecnologico

- **Frontend**: React + Vite, Material UI v5, React Router v6
- **Backend/DB**: Supabase (PostgreSQL con RLS habilitado, politicas abiertas — auth externa)
- **Auth**: Login contra tabla `usuarios` en Supabase (password en texto plano, sin JWT nativo de Supabase)
- **Storage**: Supabase Storage (imagenes de propiedades en bucket `propiedades-imagenes`, adjuntos de contratos en `contratos-adjuntos`)
- **Deploy**: Vercel (SPA rewrites configurados)

---

## Estructura de carpetas

```
src/
  App.jsx                          # Rutas principales
  theme.js                         # Fuente Poppins, colores MUI
  main.jsx
  contexts/
    AuthContext.jsx                 # Usuario global (cliente_id, rol, nombre)
  services/
    supabase.js                    # Todo el CRUD de la app
    airtable.js                    # (legacy, ya no se usa para auth)
  components/
    Layout.jsx                     # Sidebar + Outlet
    Sidebar.jsx                    # Colapsable, activo en verde #065F46
    ProtectedRoute.jsx
    ContactoPicker.jsx             # Dialog reutilizable para seleccionar contacto
    PropiedadFormDrawer.jsx        # Drawer alta/edicion de propiedad
    PropiedadDetalleDrawer.jsx     # Drawer detalle de propiedad
    contactos/
      ContactoFormDrawer.jsx       # Drawer alta/edicion de contacto
    contratos/
      ContratoFormDrawer.jsx       # Drawer alta/edicion de contrato
      ContratoDetalleDrawer.jsx    # Drawer detalle con pagos y adjuntos
      IndicesDialog.jsx            # Dialog para cargar indices ICL/IPC/RIPTE
    dashboard/
      CRMSection.jsx               # KPIs CRM + proximas visitas
      DashboardKPIs.jsx            # KPIs de expensas (oculto por ahora)
      DashboardFiltros.jsx         # (oculto por ahora)
      DeudaPorConsorcioTable.jsx   # (oculto por ahora)
    prospectos/
      ProspectoFormDrawer.jsx      # Drawer nuevo prospecto
      NegociacionDrawer.jsx        # Drawer etapa negociacion (propiedades de interes, ofertas)
      VisitaDrawer.jsx             # Drawer agendar visita
      ContactoDrawer.jsx           # Drawer primer contacto
      CierreDrawer.jsx             # Drawer cierre (exitoso o negativo)
  pages/
    Login.jsx
    Dashboard.jsx                  # CRM dashboard (KPIs cobranzas ocultos)
    Propiedades.jsx                # Grilla de propiedades con filtros
    Prospectos.jsx                 # Kanban de prospectos (venta/alquiler)
    Contratos.jsx                  # Lista de contratos con detalle
    Contactos.jsx                  # Lista de contactos (nuevo modulo)
    PropiedadPublica.jsx           # Pagina publica por propiedad (/p/:id)
    Consorcios.jsx                 # Lista de consorcios (sidebar oculto por ahora)
    ConsorcioDetalle.jsx
    Departamentos.jsx
    Propietarios.jsx
    Reclamos.jsx / ReclamoDetalle.jsx / NuevoReclamo.jsx
    Expensas.jsx / ExpensasDetalle.jsx / NuevoPeriodo.jsx
```

---

## Base de datos — Tablas Supabase

### Multi-tenant
Todas las tablas principales tienen `cliente_id` (UUID) para aislar datos por cliente.

### Modulo CRM (inmobiliaria)

**`propiedades`**
- `id`, `titulo`, `descripcion`, `direccion`, `localidad`, `provincia`
- `tipo_operacion`: `'venta'` | `'alquiler'`
- `tipo_inmueble`: string libre (casa, departamento, local, etc.)
- `estado`: `'Disponible'` | `'Reservada'` | `'Vendida'` | `'Alquilada'` | `'Baja'`
- `precio_publicacion`, `moneda` (`'USD'` | `'ARS'`)
- `superficie_total`, `superficie_cubierta`, `ambientes`, `dormitorios`, `banos`
- `comprador_nombre`, `comprador_telefono`, `fecha_venta`
- `propietario_id` (FK a propietarios), `cliente_id`
- `created_at`, `updated_at`

**`propiedades_imagenes`**
- `id`, `propiedad_id`, `storage_path`, `orden`

**`prospectos`**
- `id`, `nombre`, `apellido`, `telefono`, `email`
- `etapa_id` (FK a etapas_crm)
- `tipo_operacion`: `'venta'` | `'alquiler'`
- `presupuesto`, `zona_interes`, `tipo_inmueble`, `credito_hipotecario` (bool)
- `propiedad_id` (propiedad de origen cuando viene de pagina publica)
- `asignado_nombre` (usuario asignado)
- `cerrado` (bool), `cierre_exitoso` (bool)
- `origen_web` (bool — creado desde pagina publica)
- `cliente_id`, `created_at`, `updated_at`

**`etapas_crm`**
- `id`, `nombre`, `orden`
- Etapas tipicas: 1=Nuevo, 2=Primer contacto, 3=Visita, 4=Negociacion, 5=Cierre

**`visitas`**
- `id`, `prospecto_id`, `propiedad_id`, `fecha`, `hora`

**`propiedades_interes`**
- `id`, `prospecto_id`, `propiedad_id`, `monto_propuesto`, `forma_pago`

**`historial_prospectos`**
- `id`, `prospecto_id`, `usuario_nombre`, `accion`, `created_at`

**`contratos`**
- `id`, `propiedad_id`, `propietario_id`, `inquilino_id` (FKs a contactos)
- `inquilino_nombre`, `inquilino_apellido`, `inquilino_dni`, `inquilino_telefono`, `inquilino_email`
- `propietario_nombre`, `propietario_apellido`, `propietario_dni`, `propietario_telefono`, `propietario_email`
- `fecha_inicio`, `fecha_fin`
- `monto_base`, `moneda` (`'ARS'` | `'USD'`)
- `plazo_actualizacion`: `'Mensual'` | `'Trimestral'` | `'Cuatrimestral'` | `'Semestral'` | `'Anual'` | `'Otro'`
- `indice_actualizacion`: `'ICL'` | `'IPC'` | `'RIPTE'` | `'Otro'`
- `garantia`, `observaciones`, `finalizado` (bool)
- `cliente_id`, `created_at`, `updated_at`

**`pagos_contrato`**
- `id`, `contrato_id`, `periodo_numero`, `periodo_inicio`, `periodo_fin`
- `monto_base`, `estado` (`'pendiente'` | `'pagado'`)
- `monto_pagado`, `fecha_pago`, `comprobante_path`
- `es_periodo_actualizacion` (bool)

**`cargos_extra_contrato`**
- `id`, `pago_id`, `descripcion`, `monto`, `created_at`

**`contratos_adjuntos`**
- `id`, `contrato_id`, `nombre`, `storage_path`, `created_at`

**`indices_actualizacion`**
- `id`, `tipo` (`'ICL'` | `'IPC'` | `'RIPTE'`), `mes` (1-12), `anio`, `valor`, `cliente_id`
- Constraint unico: `(tipo, mes, anio, cliente_id)`

**`contactos`**
- `id`, `tipo` (`'Propietario'` | `'Inquilino'` | `'Vendedor'` | `'Comprador'`)
- `nombre`, `apellido`, `dni`, `telefono`, `email`, `notas`
- `cliente_id`, `created_at`

### Modulo Consorcios

**`consorcios`** — `id` (UUID), `nombre`, `cliente_id`

**`departamentos`** — `id`, `numeracion`, `inquilino`, `id_propietario` (FK), `id_consorcio` (UUID FK), `coeficiente`

**`propietarios`** — `id`, `dni`, `nombre`, `apellido`, `id_consorcio` (UUID FK), `cliente_id`

**`reclamos`** — `id`, `descripcion`, `estado`, `fecha`, `propietario_id`, `consorcio_id`, `departamento_id`, `cliente_id`

**`periodos_expensas`** — `id`, `consorcio_id`, `mes`, `anio`, `estado` (`'abierto'` | `'cerrado'`), `cliente_id`

**`gastos`** — `id`, `periodo_id`, `nombre`, `monto`, `categoria`, `tipo`, `proveedor`, `comprobante`, `departamentos_ids` (INTEGER[])

**`expensas_departamento`** — `id`, `periodo_id`, `departamento_id`, `monto_ordinario`, `monto_extraordinario`, `monto_total`, `pagado` (bool), `monto_pagado`

### Auth

**`usuarios`** — `id`, `nombre_usuario`, `password`, `rol`, `cliente_id`

**`clientes_servicio`** — `id`, `nombre` (el cliente/empresa que usa el sistema)

---

## Rutas de la aplicacion

| Ruta | Componente | Descripcion |
|------|-----------|-------------|
| `/login` | Login | Publica |
| `/p/:id` | PropiedadPublica | Publica, pagina de propiedad |
| `/dashboard` | Dashboard | CRM KPIs + proximas visitas |
| `/propiedades` | Propiedades | Grilla con filtros |
| `/prospectos` | Prospectos | Kanban por etapa |
| `/contratos` | Contratos | Lista con detalle en drawer |
| `/contactos` | Contactos | Lista de contactos |
| `/consorcios` | Consorcios | (sidebar oculto temporalmente) |
| `/consorcios/:id` | ConsorcioDetalle | Detalle con departamentos |
| `/departamentos` | Departamentos | Global |
| `/propietarios` | Propietarios | Con importacion Excel masiva |
| `/reclamos` | Reclamos | Lista |
| `/reclamos/:id` | ReclamoDetalle | Detalle |
| `/expensas` | Expensas | Lista de periodos |
| `/expensas/:id` | ExpensasDetalle | Gastos + liquidacion + pagos |

---

## Patrones de UI establecidos

- **Color principal**: `#065F46` (verde oscuro) — botones primarios, acentos, sidebar activo
- **Drawers laterales** (`anchor="right"`) para: alta/edicion de entidades, detalles
- **Dialogs (Dialog MUI)** para: confirmaciones, formularios cortos (gastos, pagos, indices)
- **Chips/badges de estado**: `variant="outlined"` con colores semanticos en `sx`
- **Snackbar** para feedback de operaciones
- **Sin emojis** en la UI
- **Fuente**: Poppins (via theme.js)
- **Idioma UI**: espanol

---

## Funcionalidades clave por modulo

### Propiedades
- Alta/edicion via `PropiedadFormDrawer` con galeria de imagenes
- Filtros en frontend: tipo operacion, estado, localidad, precio min/max
- Columnas: titulo, operacion (badge), tipo inmueble, localidad, precio, estado, acciones
- Baja logica (estado `'Baja'`, no se muestra en grilla ni en pagina publica)
- Reactivar propiedad posible
- Seleccion de propietario via `ContactoPicker` (tipoSugerido="Propietario")

### Prospectos (Kanban)
- Tabs: Venta / Alquiler
- Columnas = etapas CRM (orden configurable en DB)
- Cards arrastrables entre etapas (`updateProspectoEtapa`)
- Cada etapa tiene un drawer especifico:
  - **Primer Contacto** (ContactoDrawer): info basica
  - **Visita** (VisitaDrawer): agendar visitas, fecha minima = hoy
  - **Negociacion** (NegociacionDrawer): propiedades de interes, ofertas, comparacion con presupuesto
  - **Cierre** (CierreDrawer): exitoso o negativo, actualiza estado de propiedad
- Prospecto desde pagina publica: `etapa_id=1`, `origen_web=true`, `tipo_operacion` en lowercase
- Seleccion de contacto via `ContactoPicker` en `ProspectoFormDrawer`

### Contratos
- Lista con badge de estado (Vigente / Finalizado) y dias restantes
- Drawer detalle: informacion del contrato, tabla de pagos mensuales, adjuntos
- Registro de pago con comprobante (upload a Storage)
- Cargos extra por periodo
- Indices de actualizacion: ICL / IPC / RIPTE por mes/ano, aislados por cliente
- Propietario se autocompletada desde propiedad seleccionada (campos bloqueados si ya tiene propietario)
- Seleccion de inquilino y propietario via `ContactoPicker`

### Contactos (nuevo modulo)
- Lista con filtro por nombre/apellido/DNI/telefono/email y por tipo
- Tipos: Propietario / Inquilino / Vendedor / Comprador
- CRUD completo via `ContactoFormDrawer`
- `ContactoPicker`: dialog reutilizable que se usa en Propiedades, Prospectos y Contratos

### Expensas
- Periodos por consorcio (mes/ano), estado abierto/cerrado
- Carga de gastos con categoria, tipo, proveedor y asignacion a subconjunto de departamentos
- Liquidacion automatica por coeficiente (normalizado al subconjunto asignado)
- Registro de pagos por departamento
- Cierre de periodo

### Pagina publica de propiedad (`/p/:id`)
- Sin autenticacion
- Muestra imagenes, descripcion, precio y caracteristicas
- Formulario de contacto que crea un prospecto en el sistema
- Label dinamico: "Quiero alquilar" / "Quiero comprar" segun `tipo_operacion`

---

## Variables de entorno necesarias

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

(Las variables de Airtable son legacy y ya no se usan activamente)

---

## Estado actual del desarrollo (mayo 2026)

- Modulo CRM completamente funcional (propiedades, prospectos, contratos, contactos)
- Modulo Consorcios funcional pero oculto en sidebar temporalmente
- Dashboard muestra solo seccion CRM (KPIs de expensas ocultos)
- Indices de actualizacion aislados por cliente (constraint unico `tipo,mes,anio,cliente_id`)
- Contactos integrados como picker en Propiedades, Prospectos y Contratos
- Pagina publica envia correctamente `tipo_operacion`, `propiedad_id` y `etapa_id=1`
