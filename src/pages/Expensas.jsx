import { useEffect, useMemo, useState } from 'react'
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Drawer,
  Divider,
  TextField,
  IconButton,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { getPeriodos, getConsorcios, createPeriodo } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import GastosPeriodoDrawer from '../components/expensas/GastosPeriodoDrawer'

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const MESES_SELECT = MESES_LABEL.map((label, i) => ({ value: i + 1, label }))

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'
const ACCENT_BORDER= '#A7F3D0'
const CLOSED_COLOR = '#94A3B8'

function calcTotal(gastos) {
  return (gastos || []).reduce((s, g) => s + Number(g.monto), 0)
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, accent = ACCENT, sub }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: 'white',
        border: '1px solid #E5E7EB',
        borderTop: `3px solid ${accent}`,
        borderRadius: '12px',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box sx={{ color: accent, display: 'flex', fontSize: 18 }}>{icon}</Box>
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#9CA3AF',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: '2.2rem',
          fontWeight: 800,
          color: '#0F172A',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mt: 0.5 }}>
          {sub}
        </Typography>
      )}
    </Box>
  )
}

// ── Fila de período ───────────────────────────────────────────────────────────
function PeriodoRow({ periodo, onClick }) {
  const isAbierto = periodo.estado === 'abierto'
  const total = calcTotal(periodo.gastos)

  return (
    <TableRow
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        bgcolor: isAbierto ? 'rgba(6,95,70,0.018)' : 'transparent',
        '&:last-child td': { border: 0 },
        '& td': { borderBottom: '1px solid #F3F4F6' },
        '&:hover': {
          bgcolor: isAbierto ? 'rgba(6,95,70,0.04)' : '#F9FAFB',
          '& .row-arrow': { opacity: 1 },
        },
      }}
    >
      {/* Indicador de estado */}
      <TableCell sx={{ py: 0, pr: 0, pl: 0, width: 4, border: 'none !important' }}>
        <Box
          sx={{
            width: 3,
            height: 48,
            borderRadius: '0 3px 3px 0',
            bgcolor: isAbierto ? ACCENT : '#E2E8F0',
          }}
        />
      </TableCell>

      {/* Período */}
      <TableCell sx={{ py: 1.75, pl: 2.5 }}>
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#111827',
            lineHeight: 1.2,
          }}
        >
          {MESES_LABEL[periodo.mes - 1]} {periodo.anio}
        </Typography>
      </TableCell>

      {/* Consorcio */}
      <TableCell sx={{ py: 1.75 }}>
        <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
          {periodo.consorcios?.nombre ?? '—'}
        </Typography>
      </TableCell>

      {/* Total */}
      <TableCell align="right" sx={{ py: 1.75 }}>
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: total > 0 ? '#0F172A' : '#D1D5DB',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {total > 0 ? fmt(total) : '—'}
        </Typography>
      </TableCell>

      {/* Estado */}
      <TableCell sx={{ py: 1.75 }}>
        {isAbierto ? (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              bgcolor: ACCENT_LIGHT,
              border: `1px solid ${ACCENT_BORDER}`,
              borderRadius: '20px',
              px: 1.25,
              py: 0.4,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: ACCENT,
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Abierto
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              bgcolor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              px: 1.25,
              py: 0.4,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: CLOSED_COLOR }} />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: CLOSED_COLOR, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Cerrado
            </Typography>
          </Box>
        )}
      </TableCell>

      {/* Arrow */}
      <TableCell align="right" sx={{ py: 1.75, pr: 2.5, width: 32 }}>
        <ArrowForwardIosIcon
          className="row-arrow"
          sx={{ fontSize: 12, color: ACCENT, opacity: 0, transition: 'opacity 0.15s' }}
        />
      </TableCell>
    </TableRow>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Expensas() {
  const { clienteId, user } = useAuth()

  const [periodos, setPeriodos]         = useState([])
  const [consorcios, setConsorcios]     = useState([])
  const [filtroConsorcio, setFiltroConsorcio] = useState('')
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  // Drawer nuevo período
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [loadingCons, setLoadingCons]   = useState(false)
  const [form, setForm] = useState({
    consorcio_id: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
  })
  const [creating, setCreating]         = useState(false)
  const [formError, setFormError]       = useState(null)
  const [successMsg, setSuccessMsg]     = useState(false)

  // Drawer gastos del período
  const [gastosDrawerOpen, setGastosDrawerOpen] = useState(false)
  const [selectedPeriodo, setSelectedPeriodo]   = useState(null)

  useEffect(() => {
    Promise.all([getPeriodos(clienteId), getConsorcios(clienteId)])
      .then(([per, cons]) => { setPeriodos(per); setConsorcios(cons) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  function openDrawer() {
    setForm({ consorcio_id: '', mes: new Date().getMonth() + 1, anio: new Date().getFullYear() })
    setFormError(null)
    setDrawerOpen(true)
    if (consorcios.length === 0) {
      setLoadingCons(true)
      getConsorcios(clienteId)
        .then(setConsorcios)
        .catch(err => setFormError(err.message))
        .finally(() => setLoadingCons(false))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.consorcio_id || !form.mes || !form.anio) return
    setCreating(true)
    setFormError(null)
    try {
      const periodo = await createPeriodo({ ...form, cliente_id: clienteId, usuario_id: user.id })
      const consorcioNombre = consorcios.find(c => c.id === periodo.consorcio_id)?.nombre
      const periodoConNombre = { ...periodo, consorcios: { nombre: consorcioNombre }, gastos: [] }
      setPeriodos(prev => [...prev, periodoConNombre])
      setDrawerOpen(false)
      openGastosDrawer(periodoConNombre)
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique') || err.code === '23505') {
        setFormError('Ya existe un período para este consorcio en ese mes y año.')
      } else {
        setFormError(err.message)
      }
    } finally {
      setCreating(false)
    }
  }

  // ── Drawer gastos del período ────────────────────────────────────────────

  function openGastosDrawer(periodo) {
    setSelectedPeriodo(periodo)
    setGastosDrawerOpen(true)
  }

  function closeGastosDrawer() {
    setGastosDrawerOpen(false)
  }

  function syncPeriodoGastos(periodoId, gastos) {
    setPeriodos(prev => prev.map(p =>
      p.id === periodoId ? { ...p, gastos: gastos.map(g => ({ monto: g.monto })) } : p
    ))
  }

  function syncPeriodoClosed(periodoId) {
    setPeriodos(prev => prev.map(p => p.id === periodoId ? { ...p, estado: 'cerrado' } : p))
  }

  // ── Cómputos ──────────────────────────────────────────────────────────────

  const periodosFiltrados = useMemo(() =>
    filtroConsorcio
      ? periodos.filter(p => p.consorcio_id === filtroConsorcio)
      : periodos,
    [periodos, filtroConsorcio]
  )

  const kpis = useMemo(() => {
    const abiertos  = periodosFiltrados.filter(p => p.estado === 'abierto').length
    const cerrados  = periodosFiltrados.filter(p => p.estado === 'cerrado').length
    const totalGastos = periodosFiltrados.reduce((s, p) => s + calcTotal(p.gastos), 0)
    return { abiertos, cerrados, totalGastos }
  }, [periodosFiltrados])

  // Agrupar por año, orden descendente
  const grouped = useMemo(() => {
    const sorted = [...periodosFiltrados].sort((a, b) =>
      b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes
    )
    const map = new Map()
    for (const p of sorted) {
      if (!map.has(p.anio)) map.set(p.anio, [])
      map.get(p.anio).push(p)
    }
    return [...map.entries()]
  }, [periodosFiltrados])

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <Box display="flex" justifyContent="center" mt={6}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  )
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* ── Header ── */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: ACCENT, mb: 0.5,
          }}>
            Gestión financiera
          </Typography>
          <Typography sx={{
            fontSize: '1.6rem', fontWeight: 800, color: '#0F172A',
            letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            Expensas
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openDrawer}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          Nuevo período
        </Button>
      </Box>

      {/* ── KPIs ── */}
      <Box display="flex" gap={2} mb={4}>
        <KPICard
          icon={<LockOpenOutlinedIcon fontSize="inherit" />}
          label="Períodos abiertos"
          value={kpis.abiertos}
          accent={ACCENT}
          sub="en curso"
        />
        <KPICard
          icon={<LockOutlinedIcon fontSize="inherit" />}
          label="Períodos cerrados"
          value={kpis.cerrados}
          accent="#94A3B8"
          sub="liquidados"
        />
        <KPICard
          icon={<ReceiptLongIcon fontSize="inherit" />}
          label="Total en gastos"
          value={fmt(kpis.totalGastos)}
          accent="#F97316"
          sub={`${periodosFiltrados.length} período${periodosFiltrados.length !== 1 ? 's' : ''}`}
        />
      </Box>

      {/* ── Filtro ── */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel sx={{ fontSize: '0.82rem' }}>Consorcio</InputLabel>
          <Select
            value={filtroConsorcio}
            label="Consorcio"
            onChange={e => setFiltroConsorcio(e.target.value)}
            sx={{
              fontSize: '0.82rem', borderRadius: '8px', bgcolor: 'white',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
            }}
          >
            <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
              Todos los consorcios
            </MenuItem>
            {consorcios.map(c => (
              <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.82rem' }}>
                {c.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {periodosFiltrados.length} período{periodosFiltrados.length !== 1 ? 's' : ''}
          {filtroConsorcio ? ' en este consorcio' : ' en total'}
        </Typography>
      </Box>

      {/* ── Tabla agrupada por año ── */}
      {grouped.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ borderRadius: '12px', border: '1px solid #E5E7EB', py: 8, textAlign: 'center' }}
        >
          <ReceiptLongIcon sx={{ fontSize: 36, color: '#E5E7EB', mb: 1.5, display: 'block', mx: 'auto' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#6B7280', mb: 0.5 }}>
            No hay períodos registrados
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
            Creá el primer período para comenzar a registrar gastos.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                  {/* spacer para el indicador */}
                  <TableCell sx={{ width: 4, py: 1.5, pr: 0, pl: 0, borderBottom: '1px solid #E5E7EB' }} />
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, pl: 2.5, borderBottom: '1px solid #E5E7EB' }}>
                    Período
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                    Consorcio
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                    Total gastos
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                    Estado
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #E5E7EB', width: 32 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {grouped.map(([anio, rows]) => {
                  const yearTotal = rows.reduce((s, p) => s + calcTotal(p.gastos), 0)
                  return [
                    /* ── Fila separador de año ── */
                    <TableRow key={`year-${anio}`} sx={{ bgcolor: '#FAFAFA', '&:hover': { bgcolor: '#FAFAFA' } }}>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: '1px solid #E5E7EB', px: 0 }}>
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ px: 2.5, py: 1.25 }}
                        >
                          <Box display="flex" alignItems="center" gap={2}>
                            <Typography
                              sx={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                color: '#D1D5DB',
                              }}
                            >
                              {anio}
                            </Typography>
                            <Box sx={{ height: 1, width: 32, bgcolor: '#E5E7EB' }} />
                            <Typography sx={{ fontSize: '0.65rem', color: '#D1D5DB', fontWeight: 600 }}>
                              {rows.length} período{rows.length !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          {yearTotal > 0 && (
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#9CA3AF',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {fmt(yearTotal)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>,

                    /* ── Filas de períodos ── */
                    ...rows.map(p => (
                      <PeriodoRow
                        key={p.id}
                        periodo={p}
                        onClick={() => openGastosDrawer(p)}
                      />
                    )),
                  ]
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Drawer Nuevo Período ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Nuevo período
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
              Seleccioná consorcio, mes y año
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDrawerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {formError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Consorcio */}
          <Box mb={2.5}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
              Consorcio
            </Typography>
            <FormControl fullWidth size="small" required disabled={loadingCons}>
              <Select
                value={form.consorcio_id}
                displayEmpty
                onChange={e => setForm(f => ({ ...f, consorcio_id: e.target.value }))}
                sx={{
                  fontSize: '0.875rem', borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
                }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
                  {loadingCons ? 'Cargando...' : 'Seleccionar consorcio'}
                </MenuItem>
                {consorcios.map(c => (
                  <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.875rem' }}>
                    {c.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Mes */}
          <Box mb={2.5}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
              Mes
            </Typography>
            <FormControl fullWidth size="small" required>
              <Select
                value={form.mes}
                onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
                sx={{
                  fontSize: '0.875rem', borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
                }}
              >
                {MESES_SELECT.map(m => (
                  <MenuItem key={m.value} value={m.value} sx={{ fontSize: '0.875rem' }}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Año */}
          <Box mb={3}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
              Año
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              value={form.anio}
              onChange={e => setForm(f => ({ ...f, anio: Number(e.target.value) }))}
              required
              inputProps={{ min: 2020, max: 2099 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px', fontSize: '0.875rem',
                  '& fieldset': { borderColor: '#E5E7EB' },
                  '&:hover fieldset': { borderColor: ACCENT },
                  '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
                },
              }}
            />
          </Box>

          <Box display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={creating || loadingCons || !form.consorcio_id}
              startIcon={creating ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
              }}
            >
              {creating ? 'Creando...' : 'Crear período'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setDrawerOpen(false)}
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
                '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
              }}
            >
              Cancelar
            </Button>
          </Box>
        </form>
      </Drawer>

      {/* ── Drawer Gastos del Período ── */}
      <GastosPeriodoDrawer
        open={gastosDrawerOpen}
        periodo={selectedPeriodo}
        subtitle={selectedPeriodo?.consorcios?.nombre}
        onClose={closeGastosDrawer}
        onGastosChange={syncPeriodoGastos}
        onPeriodoClosed={syncPeriodoClosed}
      />

      <Snackbar
        open={successMsg}
        autoHideDuration={3000}
        onClose={() => setSuccessMsg(false)}
        message="Período creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
