import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './shared/components/ProtectedRoute'
import Layout from './shared/components/Layout'

import Login             from './features/auth/pages/Login.jsx'
import OlvidePassword    from './features/auth/pages/OlvidePassword.jsx'
import CambiarPassword   from './features/auth/pages/CambiarPassword.jsx'
import Dashboard         from './features/dashboard/pages/Dashboard.jsx'
import Consorcios        from './features/consorcios/pages/Consorcios.jsx'
import ConsorcioDetalle  from './features/consorcios/pages/ConsorcioDetalle.jsx'
import NuevoConsorcio    from './features/consorcios/pages/NuevoConsorcio.jsx'
import NuevoDepartamento       from './features/consorcios/pages/NuevoDepartamento.jsx'
import Departamentos           from './features/consorcios/pages/Departamentos.jsx'
import Propietarios      from './features/consorcios/pages/Propietarios.jsx'
import NuevoPropietario  from './features/consorcios/pages/NuevoPropietario.jsx'
import Reclamos         from './features/reclamos/pages/Reclamos.jsx'
import Propiedades      from './features/propiedades/pages/Propiedades.jsx'
import Prospectos       from './features/crm/pages/Prospectos.jsx'
import Expensas         from './features/expensas/pages/Expensas.jsx'
import NuevoPeriodo     from './features/expensas/pages/NuevoPeriodo.jsx'
import ExpensasDetalle  from './features/expensas/pages/ExpensasDetalle.jsx'
import PropiedadPublica from './features/propiedades/pages/PropiedadPublica.jsx'
import InmobiliariaPublica from './features/propiedades/pages/InmobiliariaPublica.jsx'
import PortalVecino from './features/portal/pages/PortalVecino.jsx'
import PortalSelector from './features/portal/pages/PortalSelector.jsx'
import Contratos        from './features/contratos/pages/Contratos.jsx'
import Indices          from './features/contratos/pages/Indices.jsx'
import Contactos        from './features/crm/pages/Contactos.jsx'
import ConsultasWeb     from './features/crm/pages/ConsultasWeb.jsx'
import WhatsApp         from './features/integraciones/pages/WhatsApp.jsx'
// import MlCallback       from './features/integraciones/pages/MlCallback.jsx' // MercadoLibre — deshabilitado temporalmente
import MpCallback       from './features/integraciones/pages/MpCallback.jsx'
import Configuracion          from './features/integraciones/pages/Configuracion.jsx'
import PropiedadesComunidad  from './features/propiedades/pages/PropiedadesComunidad.jsx'
import Proyectos        from './features/proyectos/pages/Proyectos.jsx'
import ProyectoDetalle  from './features/proyectos/pages/ProyectoDetalle.jsx'
import DiagramaGantt    from './features/proyectos/pages/DiagramaGantt.jsx'
import CostosProyecto   from './features/proyectos/pages/CostosProyecto.jsx'

export default function App() {
  return (
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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
