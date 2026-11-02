import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ProtectedRoute from './shared/components/ProtectedRoute'
import Layout from './shared/components/Layout'
import PageLoader from './shared/components/PageLoader'

// Cada página se descarga recién al entrar a su ruta (code splitting): así las páginas
// públicas (/p, /inmobiliaria, /consulta, /portal) no cargan el código del panel.
const Login             = lazy(() => import('./features/auth/pages/Login.jsx'))
const OlvidePassword    = lazy(() => import('./features/auth/pages/OlvidePassword.jsx'))
const CambiarPassword   = lazy(() => import('./features/auth/pages/CambiarPassword.jsx'))
const Dashboard         = lazy(() => import('./features/dashboard/pages/Dashboard.jsx'))
const Consorcios        = lazy(() => import('./features/consorcios/pages/Consorcios.jsx'))
const ConsorcioDetalle  = lazy(() => import('./features/consorcios/pages/ConsorcioDetalle.jsx'))
const NuevoConsorcio    = lazy(() => import('./features/consorcios/pages/NuevoConsorcio.jsx'))
const NuevoDepartamento = lazy(() => import('./features/consorcios/pages/NuevoDepartamento.jsx'))
const Departamentos     = lazy(() => import('./features/consorcios/pages/Departamentos.jsx'))
const Propietarios      = lazy(() => import('./features/consorcios/pages/Propietarios.jsx'))
const NuevoPropietario  = lazy(() => import('./features/consorcios/pages/NuevoPropietario.jsx'))
const Reclamos          = lazy(() => import('./features/reclamos/pages/Reclamos.jsx'))
const Propiedades       = lazy(() => import('./features/propiedades/pages/Propiedades.jsx'))
const Prospectos        = lazy(() => import('./features/crm/pages/Prospectos.jsx'))
const Expensas          = lazy(() => import('./features/expensas/pages/Expensas.jsx'))
const NuevoPeriodo      = lazy(() => import('./features/expensas/pages/NuevoPeriodo.jsx'))
const ExpensasDetalle   = lazy(() => import('./features/expensas/pages/ExpensasDetalle.jsx'))
const PropiedadPublica  = lazy(() => import('./features/propiedades/pages/PropiedadPublica.jsx'))
const InmobiliariaPublica = lazy(() => import('./features/propiedades/pages/InmobiliariaPublica.jsx'))
const PortalVecino      = lazy(() => import('./features/portal/pages/PortalVecino.jsx'))
const PortalSelector    = lazy(() => import('./features/portal/pages/PortalSelector.jsx'))
const Contratos         = lazy(() => import('./features/contratos/pages/Contratos.jsx'))
const Indices           = lazy(() => import('./features/contratos/pages/Indices.jsx'))
const Contactos         = lazy(() => import('./features/crm/pages/Contactos.jsx'))
const ConsultasWeb      = lazy(() => import('./features/crm/pages/ConsultasWeb.jsx'))
const WhatsApp          = lazy(() => import('./features/integraciones/pages/WhatsApp.jsx'))
// const MlCallback     = lazy(() => import('./features/integraciones/pages/MlCallback.jsx')) // MercadoLibre — deshabilitado temporalmente
const MpCallback        = lazy(() => import('./features/integraciones/pages/MpCallback.jsx'))
const Configuracion     = lazy(() => import('./features/integraciones/pages/Configuracion.jsx'))
const PropiedadesComunidad = lazy(() => import('./features/propiedades/pages/PropiedadesComunidad.jsx'))
const Proyectos         = lazy(() => import('./features/proyectos/pages/Proyectos.jsx'))
const ProyectoDetalle   = lazy(() => import('./features/proyectos/pages/ProyectoDetalle.jsx'))
const DiagramaGantt     = lazy(() => import('./features/proyectos/pages/DiagramaGantt.jsx'))
const CostosProyecto    = lazy(() => import('./features/proyectos/pages/CostosProyecto.jsx'))

// Los links de recuperación enviados desde el dashboard de Supabase vuelven a la
// Site URL (raíz) con el token en el hash; se conserva el hash para que
// supabase-js pueda leerlo y se va directo a cambiar la contraseña.
function FallbackRedirect() {
  const { hash } = useLocation()
  if (hash.includes('type=recovery')) return <Navigate to={{ pathname: '/cambiar-password', hash }} replace />
  return <Navigate to={{ pathname: '/login', hash }} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader fullScreen />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/cambiar-password" element={<CambiarPassword />} />
      <Route path="/p/:id" element={<PropiedadPublica />} />
      <Route path="/inmobiliaria/:clienteId" element={<InmobiliariaPublica />} />
      <Route path="/consulta/:token" element={<PortalVecino />} />
      <Route path="/portal" element={<PortalSelector />} />
      <Route path="/portal/:clienteId" element={<PortalVecino />} />
      {/* <Route path="/ml-callback" element={<MlCallback />} /> */}{/* MercadoLibre — deshabilitado temporalmente */}
      <Route path="/mp-callback" element={<MpCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"                          element={<Dashboard />} />
          <Route path="/consorcios"                         element={<Consorcios />} />
          <Route path="/consorcios/nuevo"                   element={<NuevoConsorcio />} />
          <Route path="/consorcios/:id"                     element={<ConsorcioDetalle />} />
          <Route path="/consorcios/:id/departamentos/nuevo" element={<NuevoDepartamento />} />
          <Route path="/departamentos"                      element={<Departamentos />} />
          <Route path="/propietarios"                       element={<Propietarios />} />
          <Route path="/propietarios/nuevo"                 element={<NuevoPropietario />} />
          <Route path="/reclamos"                           element={<Reclamos />} />
          <Route path="/propiedades"                        element={<Propiedades />} />
          <Route path="/prospectos"                         element={<Prospectos />} />
          <Route path="/expensas"                           element={<Expensas />} />
          <Route path="/expensas/nuevo"                     element={<NuevoPeriodo />} />
          <Route path="/expensas/:id"                       element={<ExpensasDetalle />} />
          <Route path="/contratos"                          element={<Contratos />} />
          <Route path="/indices"                            element={<Indices />} />
          <Route path="/contactos"                          element={<Contactos />} />
          <Route path="/consultas-web"                      element={<ConsultasWeb />} />
          <Route path="/whatsapp"                           element={<WhatsApp />} />
          <Route path="/propiedades-comunidad"              element={<PropiedadesComunidad />} />
          <Route path="/configuracion"                      element={<Configuracion />} />
          <Route path="/proyectos"                          element={<Proyectos />} />
          <Route path="/proyectos/gantt"                    element={<DiagramaGantt />} />
          <Route path="/proyectos/costos"                   element={<CostosProyecto />} />
          <Route path="/proyectos/:id"                      element={<ProyectoDetalle />} />
        </Route>
      </Route>

      <Route path="*" element={<FallbackRedirect />} />
    </Routes>
    </Suspense>
  )
}
