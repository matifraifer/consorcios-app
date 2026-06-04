import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login             from './pages/Login'
import Dashboard         from './pages/Dashboard'
import Consorcios        from './pages/Consorcios'
import ConsorcioDetalle  from './pages/ConsorcioDetalle'
import NuevoConsorcio    from './pages/NuevoConsorcio'
import NuevoDepartamento       from './pages/NuevoDepartamento'
import NuevoDepartamentoGlobal from './pages/NuevoDepartamentoGlobal'
import Departamentos           from './pages/Departamentos'
import Propietarios      from './pages/Propietarios'
import NuevoPropietario  from './pages/NuevoPropietario'
import Reclamos         from './pages/Reclamos'
import NuevoReclamo     from './pages/NuevoReclamo'
import ReclamoDetalle   from './pages/ReclamoDetalle'
import Propiedades      from './pages/Propiedades'
import Prospectos       from './pages/Prospectos'
import Expensas         from './pages/Expensas'
import NuevoPeriodo     from './pages/NuevoPeriodo'
import ExpensasDetalle  from './pages/ExpensasDetalle'
import PropiedadPublica from './pages/PropiedadPublica'
import Contratos        from './pages/Contratos'
import Contactos        from './pages/Contactos'
import ConsultasWeb     from './pages/ConsultasWeb'
import MlCallback       from './pages/MlCallback'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/p/:id" element={<PropiedadPublica />} />
      <Route path="/ml-callback" element={<MlCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"                          element={<Dashboard />} />
          <Route path="/consorcios"                         element={<Consorcios />} />
          <Route path="/consorcios/nuevo"                   element={<NuevoConsorcio />} />
          <Route path="/consorcios/:id"                     element={<ConsorcioDetalle />} />
          <Route path="/consorcios/:id/departamentos/nuevo" element={<NuevoDepartamento />} />
          <Route path="/departamentos"                      element={<Departamentos />} />
          <Route path="/departamentos/nuevo"                element={<NuevoDepartamentoGlobal />} />
          <Route path="/propietarios"                       element={<Propietarios />} />
          <Route path="/propietarios/nuevo"                 element={<NuevoPropietario />} />
          <Route path="/reclamos"                           element={<Reclamos />} />
          <Route path="/reclamos/nuevo"                     element={<NuevoReclamo />} />
          <Route path="/reclamos/:id"                       element={<ReclamoDetalle />} />
          <Route path="/propiedades"                        element={<Propiedades />} />
          <Route path="/prospectos"                         element={<Prospectos />} />
          <Route path="/expensas"                           element={<Expensas />} />
          <Route path="/expensas/nuevo"                     element={<NuevoPeriodo />} />
          <Route path="/expensas/:id"                       element={<ExpensasDetalle />} />
          <Route path="/contratos"                          element={<Contratos />} />
          <Route path="/contactos"                          element={<Contactos />} />
          <Route path="/consultas-web"                      element={<ConsultasWeb />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
