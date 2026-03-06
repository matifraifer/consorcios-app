import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Drawer,
  Divider,
  Chip,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getConsorcios, getConsorcioById, getDepartamentosByConsorcio } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const DRAWER_WIDTH = 520

export default function Consorcios() {
  const [consorcios, setConsorcios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [departamentos, setDepartamentos] = useState([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)

  useEffect(() => {
    getConsorcios(user.id)
      .then(setConsorcios)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  function openDetalle(id) {
    setDrawerOpen(true)
    setDetalle(null)
    setDepartamentos([])
    setErrorDetalle(null)
    setLoadingDetalle(true)
    Promise.all([getConsorcioById(id), getDepartamentosByConsorcio(id)])
      .then(([cons, deps]) => {
        setDetalle(cons)
        setDepartamentos(deps)
      })
      .catch((err) => setErrorDetalle(err.message))
      .finally(() => setLoadingDetalle(false))
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Consorcios
        </Typography>
        <Button variant="contained" onClick={() => navigate('/consorcios/nuevo')}>
          + Nuevo Consorcio
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Nombre</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Administrador</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consorcios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay consorcios registrados.
                </TableCell>
              </TableRow>
            ) : (
              consorcios.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell>{c.usuarios?.nombre_usuario ?? '-'}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openDetalle(c.id)}
                    >
                      Ver Detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Drawer lateral */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{ sx: { width: DRAWER_WIDTH, p: 3 } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            {detalle?.nombre ?? 'Detalle del consorcio'}
          </Typography>
          <IconButton onClick={closeDrawer}>
            <CloseIcon />
          </IconButton>
        </Box>

        {loadingDetalle && (
          <Box display="flex" justifyContent="center" mt={4}>
            <CircularProgress />
          </Box>
        )}

        {errorDetalle && <Alert severity="error">{errorDetalle}</Alert>}

        {!loadingDetalle && detalle && (
          <>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Administrador: <strong>{detalle.usuarios?.nombre_usuario ?? '-'}</strong>
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight="bold">Departamentos</Typography>
                <Chip label={departamentos.length} size="small" color="primary" />
              </Box>
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/propietarios/nuevo?consorcio=${detalle.id}`)}
                >
                  + Propietario
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => navigate(`/consorcios/${detalle.id}/departamentos/nuevo`)}
                >
                  + Departamento
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Numeración</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Propietario</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Inquilino</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No hay departamentos registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    departamentos.map((dep) => (
                      <TableRow key={dep.id} hover>
                        <TableCell>
                          <Chip label={dep.numeracion} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {dep.propietarios
                            ? `${dep.propietarios.apellido}, ${dep.propietarios.nombre}`
                            : '-'}
                        </TableCell>
                        <TableCell>{dep.inquilino || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Drawer>
    </Box>
  )
}
