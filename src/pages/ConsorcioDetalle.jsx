import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getConsorcioById, getDepartamentosByConsorcio } from '../services/supabase'

export default function ConsorcioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [consorcio, setConsorcio] = useState(null)
  const [departamentos, setDepartamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getConsorcioById(id), getDepartamentosByConsorcio(id)])
      .then(([cons, deps]) => {
        setConsorcio(cons)
        setDepartamentos(deps)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/consorcios')}
        sx={{ mb: 2 }}
      >
        Volver a Consorcios
      </Button>

      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {consorcio?.nombre}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Administrador: <strong>{consorcio?.usuarios?.nombre_usuario ?? '-'}</strong>
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">Departamentos</Typography>
          <Chip label={departamentos.length} size="small" color="primary" />
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={() => navigate(`/propietarios/nuevo?consorcio=${id}`)}
          >
            + Propietario
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate(`/consorcios/${id}/departamentos/nuevo`)}
          >
            + Departamento
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Numeracion</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Inquilino</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay departamentos registrados para este consorcio.
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
    </Box>
  )
}
