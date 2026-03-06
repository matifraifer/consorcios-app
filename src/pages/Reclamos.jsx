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
  Alert,
  CircularProgress,
  Chip,
  Button,
} from '@mui/material'
import { getReclamos } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const estadoColor = {
  pendiente:  'warning',
  resuelto:   'success',
  descartado: 'default',
}

function formatFecha(fecha) {
  if (!fecha) return '-'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export default function Reclamos() {
  const [reclamos, setReclamos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getReclamos(user.id)
      .then(setReclamos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Reclamos
        </Typography>
        <Button variant="contained" onClick={() => navigate('/reclamos/nuevo')}>
          + Nuevo Reclamo
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ID</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Consorcio</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fecha</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reclamos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay reclamos registrados.
                </TableCell>
              </TableRow>
            ) : (
              reclamos.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/reclamos/${r.id}`)}
                >
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    {r.propietarios
                      ? `${r.propietarios.apellido}, ${r.propietarios.nombre}`
                      : '-'}
                  </TableCell>
                  <TableCell>{r.consorcios?.nombre ?? '-'}</TableCell>
                  <TableCell>{r.departamentos?.numeracion ?? '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={r.estado}
                      size="small"
                      color={estadoColor[r.estado] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>{formatFecha(r.fecha)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
