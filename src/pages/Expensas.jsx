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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { getPeriodos, getConsorcios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function calcTotal(gastos) {
  return (gastos || []).reduce((sum, g) => sum + Number(g.monto), 0)
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Expensas() {
  const [periodos, setPeriodos] = useState([])
  const [consorcios, setConsorcios] = useState([])
  const [filtroConsorcio, setFiltroConsorcio] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getPeriodos(user.id), getConsorcios(user.id)])
      .then(([per, cons]) => {
        setPeriodos(per)
        setConsorcios(cons)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  const periodosFiltrados = filtroConsorcio
    ? periodos.filter((p) => p.consorcio_id === filtroConsorcio)
    : periodos

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Expensas
        </Typography>
        <Button variant="contained" onClick={() => navigate('/expensas/nuevo')}>
          + Nuevo Período
        </Button>
      </Box>

      <FormControl sx={{ minWidth: 260, mb: 3 }} size="small">
        <InputLabel>Filtrar por consorcio</InputLabel>
        <Select
          value={filtroConsorcio}
          label="Filtrar por consorcio"
          onChange={(e) => setFiltroConsorcio(e.target.value)}
        >
          <MenuItem value=""><em>Todos</em></MenuItem>
          {consorcios.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Período</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Consorcio</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total Gastos</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {periodosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay períodos registrados.
                </TableCell>
              </TableRow>
            ) : (
              periodosFiltrados.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/expensas/${p.id}`)}
                >
                  <TableCell>{MESES[p.mes - 1]} {p.anio}</TableCell>
                  <TableCell>{p.consorcios?.nombre ?? '-'}</TableCell>
                  <TableCell align="right">{fmt(calcTotal(p.gastos))}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.estado.toUpperCase()}
                      size="small"
                      color={p.estado === 'abierto' ? 'primary' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
