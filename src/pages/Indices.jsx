import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, CircularProgress, Select, MenuItem, FormControl,
} from '@mui/material'
import TimelineIcon from '@mui/icons-material/Timeline'
import { getIndicesActualizacion } from '../features/contratos/services/contratos'
import { useAuth } from '../contexts/AuthContext'
import GraficoIndices from '../components/contratos/GraficoIndices'
import { agruparIndices, labelPeriodoLargo, PERIODOS } from '../utils/agruparIndices'

const ACCENT = '#065F46'

const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px', bgcolor: 'white',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function TablaIndices({ titulo, fuente, color, filas, periodo }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB', flex: 1, minWidth: 280 }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #E5E7EB' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{titulo}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mt: 0.3, ml: 2.25 }}>{fuente}</Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {['Período', 'Valor'].map(label => (
                <TableCell key={label} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.25, borderBottom: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} sx={{ py: 4, textAlign: 'center', border: 0 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Sin registros.</Typography>
                </TableCell>
              </TableRow>
            ) : filas.map(f => (
              <TableRow key={`${f.anio}-${f.mesInicio}`} sx={{ '&:last-child td': { border: 0 }, '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                <TableCell sx={{ py: 1.25 }}>
                  <Typography sx={{ fontSize: '0.82rem', color: '#374151' }}>
                    {labelPeriodoLargo(f, periodo)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                    {f.valor.toFixed(2)}%
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default function Indices() {
  const { clienteId } = useAuth()
  const [indices, setIndices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodo, setPeriodo] = useState('mensual')

  useEffect(() => {
    getIndicesActualizacion(clienteId)
      .then(setIndices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  const ipc = useMemo(() => agruparIndices(indices.filter(i => i.tipo === 'IPC'), periodo), [indices, periodo])
  const icl = useMemo(() => agruparIndices(indices.filter(i => i.tipo === 'ICL'), periodo), [indices, periodo])

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" flexWrap="wrap" gap={2} mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Gestión de alquileres
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Índices
          </Typography>
        </Box>

        {indices.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select value={periodo} onChange={e => setPeriodo(e.target.value)} sx={selectSx}>
              {Object.entries(PERIODOS).map(([key, { label }]) => (
                <MenuItem key={key} value={key} sx={{ fontSize: '0.82rem' }}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {indices.length === 0 && !loading ? (
        <Paper variant="outlined" sx={{ borderRadius: '12px', border: '1px solid #E5E7EB', py: 8, textAlign: 'center' }}>
          <TimelineIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
            No hay índices cargados. Se cargan desde el botón "Índices" en la pantalla de Contratos.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Gráfico */}
          <Box mb={3}>
            <GraficoIndices indices={indices} periodo={periodo} />
          </Box>

          {/* Tablas */}
          <Box display="flex" gap={2.5} flexWrap="wrap">
            <TablaIndices titulo="Índices IPC" fuente="Datos obtenidos de INDEC" color="#2a78d6" filas={ipc} periodo={periodo} />
            <TablaIndices titulo="Índices ICL" fuente="Datos obtenidos de BCRA" color="#eb6834" filas={icl} periodo={periodo} />
          </Box>
        </>
      )}
    </Box>
  )
}
