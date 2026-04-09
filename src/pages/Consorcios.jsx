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
  TextField,
  Snackbar,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getConsorcios, getConsorcioById, getDepartamentosByConsorcio, createConsorcio } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const DRAWER_WIDTH = 520

export default function Consorcios() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [consorcios, setConsorcios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Drawer detalle
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [departamentos, setDepartamentos] = useState([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)

  // Drawer nuevo consorcio
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getConsorcios(user.id)
      .then(setConsorcios)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  function openDetalle(id) {
    setDetalleOpen(true)
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

  function openNuevo() {
    setNombre('')
    setFormError(null)
    setNuevoOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await createConsorcio({ nombre: nombre.trim(), id_administrador: user.id })
      setSuccess(true)
      setNuevoOpen(false)
      // Recargar lista
      setLoading(true)
      const data = await getConsorcios(user.id)
      setConsorcios(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Consorcios
        </Typography>
        <Button variant="contained" onClick={openNuevo}>
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
                    <Button size="small" variant="outlined" onClick={() => openDetalle(c.id)}>
                      Ver Detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Drawer Nuevo Consorcio */}
      <Drawer
        anchor="right"
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        PaperProps={{ sx: { width: 400, p: 3 } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">Nuevo Consorcio</Typography>
          <IconButton onClick={() => setNuevoOpen(false)}><CloseIcon /></IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Nombre del Consorcio"
            fullWidth
            margin="normal"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
            placeholder="Ej: Edificio San Martin"
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {saving ? 'Guardando...' : 'Crear Consorcio'}
            </Button>
            <Button variant="outlined" onClick={() => setNuevoOpen(false)}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Drawer>

      {/* Drawer Detalle */}
      <Drawer
        anchor="right"
        open={detalleOpen}
        onClose={() => setDetalleOpen(false)}
        PaperProps={{ sx: { width: DRAWER_WIDTH, p: 3 } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            {detalle?.nombre ?? 'Detalle del consorcio'}
          </Typography>
          <IconButton onClick={() => setDetalleOpen(false)}>
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
              <Button
                size="small"
                variant="contained"
                onClick={() => navigate(`/consorcios/${detalle.id}/departamentos/nuevo`)}
              >
                + Departamento
              </Button>
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

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Consorcio creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
