import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useAuth } from '../contexts/AuthContext'
import { getExpensasPendientes } from '../services/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroConsorcio, setFiltroConsorcio] = useState('')

  useEffect(() => {
    getExpensasPendientes(user.id)
      .then(setPendientes)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  // Opciones únicas para los filtros
  const periodos = useMemo(() => {
    const seen = new Set()
    return pendientes
      .map(i => {
        const mes = i.periodos_expensas?.mes
        const anio = i.periodos_expensas?.anio
        const key = `${mes}-${anio}`
        return { key, label: `${MESES[(mes ?? 1) - 1]} ${anio}` }
      })
      .filter(({ key }) => {
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [pendientes])

  const consorcios = useMemo(() => {
    const seen = new Set()
    return pendientes
      .map(i => i.periodos_expensas?.consorcios?.nombre ?? 'Sin consorcio')
      .filter(nombre => {
        if (seen.has(nombre)) return false
        seen.add(nombre)
        return true
      })
  }, [pendientes])

  // Datos filtrados
  const filtrados = useMemo(() => {
    return pendientes.filter(item => {
      const mes = item.periodos_expensas?.mes
      const anio = item.periodos_expensas?.anio
      const consorcio = item.periodos_expensas?.consorcios?.nombre ?? 'Sin consorcio'
      const matchPeriodo = !filtroPeriodo || `${mes}-${anio}` === filtroPeriodo
      const matchConsorcio = !filtroConsorcio || consorcio === filtroConsorcio
      return matchPeriodo && matchConsorcio
    })
  }, [pendientes, filtroPeriodo, filtroConsorcio])

  const totalFiltrado = filtrados.reduce((s, i) => s + Number(i.monto_total ?? 0), 0)
  const totalPendiente = pendientes.reduce((s, i) => s + Number(i.monto_total ?? 0), 0)

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Bienvenido, {user?.nombre_usuario}
      </Typography>

      {loading && <Box display="flex" justifyContent="center" mt={2}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <>
          {/* KPIs */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderLeft: 4, borderColor: pendientes.length > 0 ? 'warning.main' : 'success.main' }}>
                {pendientes.length > 0
                  ? <WarningAmberIcon color="warning" sx={{ fontSize: 40 }} />
                  : <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40 }} />
                }
                <Box>
                  <Typography variant="h4" fontWeight="bold">{pendientes.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pendientes.length === 1 ? 'departamento pendiente' : 'Departamentos pendientes'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderLeft: 4, borderColor: totalPendiente > 0 ? 'warning.main' : 'success.main' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{fmt(totalPendiente)}</Typography>
                  <Typography variant="body2" color="text.secondary">Monto total pendiente</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Tabla cobros pendientes */}
          <Paper sx={{ p: 3 }}>
            {/* Título y descripción */}
            <Typography variant="h6" fontWeight="bold">
              Cobros pendientes
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Detalle de los departamentos que aún no han abonado sus expensas en períodos cerrados.
            </Typography>

            {pendientes.length === 0 ? (
              <Box textAlign="center" py={4}>
                <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Todas las expensas están al día.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Filtros */}
                <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                  <FormControl sx={{ width: '25%', minWidth: 160 }}>
                    <InputLabel>Período</InputLabel>
                    <Select
                      value={filtroPeriodo}
                      label="Período"
                      onChange={e => setFiltroPeriodo(e.target.value)}
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {periodos.map(({ key, label }) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ width: '25%', minWidth: 160 }}>
                    <InputLabel>Consorcio</InputLabel>
                    <Select
                      value={filtroConsorcio}
                      label="Consorcio"
                      onChange={e => setFiltroConsorcio(e.target.value)}
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {consorcios.map(nombre => (
                        <MenuItem key={nombre} value={nombre}>{nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Consorcio</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Período</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Departamento</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Monto</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            No hay resultados para los filtros seleccionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtrados.map(item => (
                          <TableRow
                            key={item.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate('/expensas')}
                          >
                            <TableCell>{item.periodos_expensas?.consorcios?.nombre ?? '-'}</TableCell>
                            <TableCell>
                              {MESES[(item.periodos_expensas?.mes ?? 1) - 1]} {item.periodos_expensas?.anio}
                            </TableCell>
                            <TableCell>
                              <Chip label={item.departamentos?.numeracion ?? '-'} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">{fmt(item.monto_total ?? 0)}</TableCell>
                            <TableCell align="center">
                              <Chip
  label="PENDIENTE"
  size="small"
  variant="outlined"
  color="warning"
  sx={{ bgcolor: '#FFF7ED' }}
/>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Total filtrado */}
                {(filtroPeriodo || filtroConsorcio) && (
                  <Box display="flex" justifyContent="flex-end" mt={1}>
                    <Typography variant="body2" color="text.secondary">
                      Total filtrado:{' '}
                      <Typography component="span" fontWeight="bold" color="warning.main">
                        {fmt(totalFiltrado)}
                      </Typography>
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Paper>
        </>
      )}
    </Box>
  )
}
