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
import { getDepartamentos } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Departamentos() {
  const [departamentos, setDepartamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { clienteId } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getDepartamentos(clienteId)
      .then(setDepartamentos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Departamentos
        </Typography>
        <Button variant="contained" onClick={() => navigate('/departamentos/nuevo')}>
          + Nuevo Departamento
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Numeracion</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Inquilino</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Consorcio</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
                  <TableCell>{dep.consorcios?.nombre ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
