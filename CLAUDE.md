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
    AuthContext.jsx                # Login/logout, user en contexto global
  services/
    airtable.js                   # Login contra Airtable
    supabase.js                   # CRUD principal (consorcios, departamentos, propietarios, expensas, reclamos)
  components/
    Layout.jsx                    # Sidebar + Outlet
    Sidebar.jsx                   # Colapsable, color activo #065F46
    ProtectedRoute.jsx
  pages/
    Login.jsx
    Dashboard.jsx                 # KPIs + tabla cobros pendientes con filtros
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
```

## Supabase — Tablas
- `consorcios`: id (UUID PK), nombre, id_administrador (UUID FK a usuarios)
- `departamentos`: id (serial PK), numeracion, inquilino, id_propietario (FK), id_consorcio (UUID FK), coeficiente
- `propietarios`: id (serial PK), dni, nombre, apellido, id_consorcio (UUID FK)
- `usuarios`: id (UUID PK), nombre_usuario, password, rol
- `reclamos`: id, descripcion, estado, fecha, propietario_id, consorcio_id, departamento_id, usuario_id
- `periodos_expensas`: id, consorcio_id, mes, anio, estado ('abierto'|'cerrado'), usuario_id
- `gastos`: id, periodo_id, nombre, monto, categoria, tipo, proveedor, comprobante, departamentos_ids (INTEGER[])
- `expensas_departamento`: id, periodo_id, departamento_id, monto_ordinario, monto_extraordinario, monto_total, pagado (bool), monto_pagado
- RLS habilitado con políticas abiertas (auth manejada externamente)

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
