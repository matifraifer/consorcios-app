import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login             from './pages/Login'
import Dashboard         from './pages/Dashboard'
import Consorcios        from './pages/Consorcios'
import ConsorcioDetalle  from './pages/ConsorcioDetalle'
import NuevoDepartamento       from './pages/NuevoDepartamento'
import NuevoDepartamentoGlobal from './pages/NuevoDepartamentoGlobal'
import Departamentos           from './pages/Departamentos'
import Propietarios      from './pages/Propietarios'
import NuevoPropietario  from './pages/NuevoPropietario'
import Reclamos         from './pages/Reclamos'
import NuevoReclamo     from './pages/NuevoReclamo'
import ReclamoDetalle   from './pages/ReclamoDetalle'
import Expensas         from './pages/Expensas'
import NuevoPeriodo     from './pages/NuevoPeriodo'
import ExpensasDetalle  from './pages/ExpensasDetalle'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"                          element={<Dashboard />} />
          <Route path="/consorcios"                         element={<Consorcios />} />
          <Route path="/consorcios/:id"                     element={<ConsorcioDetalle />} />
          <Route path="/consorcios/:id/departamentos/nuevo" element={<NuevoDepartamento />} />
          <Route path="/departamentos"                      element={<Departamentos />} />
          <Route path="/departamentos/nuevo"                element={<NuevoDepartamentoGlobal />} />
          <Route path="/propietarios"                       element={<Propietarios />} />
          <Route path="/propietarios/nuevo"                 element={<NuevoPropietario />} />
          <Route path="/reclamos"                           element={<Reclamos />} />
          <Route path="/reclamos/nuevo"                     element={<NuevoReclamo />} />
          <Route path="/reclamos/:id"                       element={<ReclamoDetalle />} />
          <Route path="/expensas"                           element={<Expensas />} />
          <Route path="/expensas/nuevo"                     element={<NuevoPeriodo />} />
          <Route path="/expensas/:id"                       element={<ExpensasDetalle />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
