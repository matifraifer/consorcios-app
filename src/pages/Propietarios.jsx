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
} from '@mui/material'
import { getPropietarios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Propietarios() {
  const [propietarios, setPropietarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    getPropietarios(user.id)
      .then(setPropietarios)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Propietarios
        </Typography>
        <Button variant="contained" onClick={() => navigate('/propietarios/nuevo')}>
          + Nuevo Propietario
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DNI</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Complejo</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {propietarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay propietarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              propietarios.map((p) => {
                const deptos = p.departamentos ?? []
                const numeraciones = deptos.map((d) => d.numeracion).join(', ')
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.apellido}, {p.nombre}</TableCell>
                    <TableCell>{p.dni}</TableCell>
                    <TableCell>{p.consorcios?.nombre ?? '-'}</TableCell>
                    <TableCell>{numeraciones || '-'}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
