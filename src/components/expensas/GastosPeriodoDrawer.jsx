import { useEffect, useState } from 'react'
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
  Drawer,
  Divider,
  TextField,
  IconButton,
  Checkbox,
  ListItemText,
  Collapse,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import {
  getGastosByPeriodo, createGasto, updateGasto, deleteGasto,
  getDepartamentosConCoeficiente,
  getExpensasDepartamento, saveExpensasDepartamento,
} from '../../services/supabase'
import { calcLiquidacion } from '../../utils/calcLiquidacion'

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const CATEGORIAS = ['sueldos','limpieza','mantenimiento','seguros','servicios','administracion','otros']
const TIPOS = ['ordinario','extraordinario']
const GASTO_VACIO = { nombre: '', monto: '', categoria: 'sueldos', tipo: 'ordinario', proveedor: '', comprobante: '', departamentos_ids: [] }

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'
const ACCENT_BORDER= '#A7F3D0'
const CLOSED_COLOR = '#94A3B8'

const labelSx = { fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}
const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Drawer con la lista de gastos de un período + alta/edición siempre visible.
// El cierre de período y el registro de pagos viven fuera de este drawer
// (grilla de períodos y pestaña Liquidaciones, respectivamente).
// periodo: { id, mes, anio, estado, consorcio_id }
export default function GastosPeriodoDrawer({ open, periodo, subtitle, onClose, onGastosChange, onLiquidacionChange }) {
  const [gastosPeriodo, setGastosPeriodo] = useState([])
  const [departamentosPeriodo, setDepartamentosPeriodo] = useState([])
  const [loadingGastos, setLoadingGastos] = useState(false)
  const [gastosError, setGastosError] = useState(null)

  // Formulario de gasto — siempre visible en el drawer (alta o edición)
  const [editingGasto, setEditingGasto] = useState(null)
  const [gastoForm, setGastoForm] = useState(GASTO_VACIO)
  const [savingGasto, setSavingGasto] = useState(false)
  const [gastoFormError, setGastoFormError] = useState(null)
  const [formCollapsed, setFormCollapsed] = useState(false)

  // Liquidación (guardado de montos por departamento, sin grilla acá)
  const [expensasDep, setExpensasDep] = useState([])
  const [liquidacionGuardada, setLiquidacionGuardada] = useState(false)
  const [gastosCambiados, setGastosCambiados] = useState(false)
  const [savingLiquidacion, setSavingLiquidacion] = useState(false)

  const periodoAbierto = periodo?.estado === 'abierto'

  useEffect(() => {
    if (!open || !periodo) return
    setGastosError(null)
    setGastoFormError(null)
    setEditingGasto(null)
    setFormCollapsed(false)
    setGastoForm(GASTO_VACIO)
    setGastosCambiados(false)
    setLoadingGastos(true)
    Promise.all([
      getGastosByPeriodo(periodo.id),
      getDepartamentosConCoeficiente(periodo.consorcio_id),
      getExpensasDepartamento(periodo.id),
    ])
      .then(([gastos, deptos, expDep]) => {
        setGastosPeriodo(gastos)
        setDepartamentosPeriodo(deptos)
        setGastoForm(prev => ({ ...prev, departamentos_ids: deptos.filter(d => d.activo !== false).map(d => d.id) }))
        setExpensasDep(expDep)
        setLiquidacionGuardada(expDep.length > 0)
      })
      .catch(err => setGastosError(err.message))
      .finally(() => setLoadingGastos(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodo?.id])

  function syncGastos(updatedGastos) {
    setGastosPeriodo(updatedGastos)
    onGastosChange?.(periodo.id, updatedGastos)
    if (liquidacionGuardada) setGastosCambiados(true)
  }

  // ── Formulario de gasto (alta / edición, siempre visible) ───────────────

  function resetGastoForm() {
    setEditingGasto(null)
    setGastoForm({ ...GASTO_VACIO, departamentos_ids: departamentosPeriodo.filter(d => d.activo !== false).map(d => d.id) })
    setGastoFormError(null)
  }

  function startEditGasto(gasto) {
    setEditingGasto(gasto)
    setGastoForm({
      nombre: gasto.nombre,
      monto: gasto.monto,
      categoria: gasto.categoria,
      tipo: gasto.tipo,
      proveedor: gasto.proveedor || '',
      comprobante: gasto.comprobante || '',
      departamentos_ids: gasto.departamentos_ids?.length
        ? gasto.departamentos_ids
        : departamentosPeriodo.filter(d => d.activo !== false).map(d => d.id),
    })
    setGastoFormError(null)
    setFormCollapsed(false)
  }

  function handleGastoFormChange(e) {
    setGastoForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleGastoSubmit() {
    if (!gastoForm.nombre.trim() || !gastoForm.monto) return
    setSavingGasto(true)
    setGastoFormError(null)
    try {
      let updatedGastos
      if (editingGasto) {
        const updated = await updateGasto(editingGasto.id, gastoForm)
        updatedGastos = gastosPeriodo.map(g => g.id === updated.id ? updated : g)
      } else {
        const created = await createGasto({ ...gastoForm, periodo_id: periodo.id })
        updatedGastos = [...gastosPeriodo, created]
      }
      syncGastos(updatedGastos)
      resetGastoForm()
    } catch (err) {
      setGastoFormError(err.message)
    } finally {
      setSavingGasto(false)
    }
  }

  async function handleDeleteGasto(gastoId) {
    try {
      await deleteGasto(gastoId)
      syncGastos(gastosPeriodo.filter(g => g.id !== gastoId))
      if (editingGasto?.id === gastoId) resetGastoForm()
    } catch (err) {
      setGastosError(err.message)
    }
  }

  // ── Guardar cambios (liquidación) ────────────────────────────────────────

  async function handleGuardarCambios() {
    setSavingLiquidacion(true)
    setGastosError(null)
    try {
      const items = liquidacion.map(l => ({
        periodo_id: Number(periodo.id),
        departamento_id: l.departamento_id,
        monto_ordinario: l.monto_ordinario,
        monto_extraordinario: l.monto_extraordinario,
        monto_total: l.monto_total,
        pagado: pagadoMap[l.departamento_id]?.pagado ?? false,
        monto_pagado: pagadoMap[l.departamento_id]?.monto_pagado ?? null,
      }))
      await saveExpensasDepartamento(periodo.id, items)
      setLiquidacionGuardada(true)
      setGastosCambiados(false)
      onLiquidacionChange?.(periodo.id)
      onClose?.()
    } catch (err) {
      setGastosError(err.message)
    } finally {
      setSavingLiquidacion(false)
    }
  }

  const deptoNumMap = Object.fromEntries(departamentosPeriodo.map(d => [d.id, d.numeracion]))
  // Unidades inactivas: no se les asigna un gasto nuevo por defecto ni aparecen
  // como opción en el selector, pero si ya tenían un gasto asignado de antes
  // siguen participando en calcLiquidacion (abajo, con `departamentosPeriodo`
  // completo) para no perder esa deuda.
  const departamentosActivos = departamentosPeriodo.filter(d => d.activo !== false)
  const totalOrdDrawer = gastosPeriodo.filter(g => g.tipo === 'ordinario').reduce((s, g) => s + Number(g.monto), 0)
  const totalExtDrawer = gastosPeriodo.filter(g => g.tipo === 'extraordinario').reduce((s, g) => s + Number(g.monto), 0)
  const totalGralDrawer = totalOrdDrawer + totalExtDrawer
  const liquidacion = calcLiquidacion(departamentosPeriodo, gastosPeriodo)
  const depsExcluidos = liquidacion.filter(l => l.hasProblematicGastos)
  const pagadoMap = Object.fromEntries(expensasDep.map(e => [e.departamento_id, e]))

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 620, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      {periodo && (
        <>
          <Box sx={{ p: 3, pb: 2, flexShrink: 0 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    {MESES_LABEL[periodo.mes - 1]} {periodo.anio}
                  </Typography>
                  <Chip
                    label={periodoAbierto ? 'Abierto' : 'Cerrado'}
                    size="small"
                    sx={{
                      height: 20, fontSize: '0.65rem', fontWeight: 700,
                      bgcolor: periodoAbierto ? ACCENT_LIGHT : '#F1F5F9',
                      color: periodoAbierto ? ACCENT : CLOSED_COLOR,
                      border: 'none',
                    }}
                  />
                </Box>
                {subtitle && (
                  <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                    {subtitle}
                  </Typography>
                )}
              </Box>
              <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </Box>

            <Divider sx={{ borderColor: '#F3F4F6' }} />
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
          {gastosError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{gastosError}</Alert>}

          {loadingGastos ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress size={28} sx={{ color: ACCENT }} />
            </Box>
          ) : (
            <>
              {periodoAbierto && (
                <Box mb={3}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    onClick={() => setFormCollapsed(prev => !prev)}
                    sx={{ cursor: 'pointer', userSelect: 'none', mb: formCollapsed ? 0 : 1.5 }}
                  >
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: ACCENT }}>
                      {editingGasto ? 'Editar gasto' : 'Nuevo gasto'}
                    </Typography>
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 18, color: ACCENT,
                        transition: 'transform 0.2s ease',
                        transform: formCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </Box>

                  <Collapse in={!formCollapsed}>
                  {gastoFormError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{gastoFormError}</Alert>}

                  <Box mb={1.5}>
                    <Typography sx={labelSx}>Descripción del gasto</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      name="nombre"
                      value={gastoForm.nombre}
                      onChange={handleGastoFormChange}
                      required
                      placeholder="Ej: Sueldo encargado"
                      sx={fieldSx}
                    />
                  </Box>

                  <Box mb={1.5}>
                    <Typography sx={labelSx}>Monto</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      name="monto"
                      value={gastoForm.monto}
                      onChange={handleGastoFormChange}
                      required
                      inputProps={{ min: 0, step: '0.01' }}
                      placeholder="0.00"
                      sx={fieldSx}
                    />
                  </Box>

                  <Box display="flex" gap={1.5} mb={1.5}>
                    <Box flex={1}>
                      <Typography sx={labelSx}>Categoría</Typography>
                      <FormControl fullWidth size="small">
                        <Select name="categoria" value={gastoForm.categoria} onChange={handleGastoFormChange} sx={selectSx}>
                          {CATEGORIAS.map((c) => (
                            <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{c}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box flex={1}>
                      <Typography sx={labelSx}>Tipo</Typography>
                      <FormControl fullWidth size="small">
                        <Select name="tipo" value={gastoForm.tipo} onChange={handleGastoFormChange} sx={selectSx}>
                          {TIPOS.map((t) => (
                            <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{t}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>

                  <Box mb={1.5}>
                    <Typography sx={labelSx}>Departamentos asignados</Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        multiple
                        displayEmpty
                        value={gastoForm.departamentos_ids}
                        onChange={(e) => {
                          const val = e.target.value
                          // "__all__" es el valor especial del item de seleccionar/deseleccionar
                          if (val.includes('__all__')) {
                            setGastoForm(prev => ({
                              ...prev,
                              departamentos_ids: prev.departamentos_ids.length === departamentosActivos.length
                                ? []
                                : departamentosActivos.map(d => d.id),
                            }))
                          } else {
                            setGastoForm(prev => ({ ...prev, departamentos_ids: val }))
                          }
                        }}
                        sx={selectSx}
                        renderValue={(selected) => {
                          if (selected.length === 0) return <span style={{ color: '#9CA3AF' }}>Ninguno seleccionado</span>
                          if (selected.length === departamentosActivos.length) return 'Todos los departamentos'
                          return (
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {selected.map(depId => (
                                <Chip key={depId} label={deptoNumMap[depId] ?? depId} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />
                              ))}
                            </Box>
                          )
                        }}
                      >
                        <MenuItem value="__all__">
                          <Checkbox
                            size="small"
                            checked={gastoForm.departamentos_ids.length === departamentosActivos.length}
                            indeterminate={gastoForm.departamentos_ids.length > 0 && gastoForm.departamentos_ids.length < departamentosActivos.length}
                          />
                          <ListItemText
                            primary={gastoForm.departamentos_ids.length === departamentosActivos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                          />
                        </MenuItem>
                        {departamentosActivos.map((dep) => (
                          <MenuItem key={dep.id} value={dep.id}>
                            <Checkbox size="small" checked={gastoForm.departamentos_ids.includes(dep.id)} />
                            <ListItemText
                              primary={dep.numeracion}
                              secondary={dep.propietario_apellido ? `${dep.propietario_apellido}, ${dep.propietario_nombre}` : 'Sin propietario'}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box display="flex" gap={1.5} mb={2}>
                    <Box flex={1}>
                      <Typography sx={labelSx}>Proveedor</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        name="proveedor"
                        value={gastoForm.proveedor}
                        onChange={handleGastoFormChange}
                        placeholder="Opcional"
                        sx={fieldSx}
                      />
                    </Box>
                    <Box flex={1}>
                      <Typography sx={labelSx}>Comprobante</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        name="comprobante"
                        value={gastoForm.comprobante}
                        onChange={handleGastoFormChange}
                        placeholder="Opcional"
                        sx={fieldSx}
                      />
                    </Box>
                  </Box>

                  <Box display="flex" gap={1.5}>
                    <Button
                      variant="contained"
                      onClick={handleGastoSubmit}
                      disabled={savingGasto}
                      startIcon={savingGasto ? <CircularProgress size={14} color="inherit" /> : <AddIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                        fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                        '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                      }}
                    >
                      {savingGasto ? 'Guardando...' : editingGasto ? 'Guardar cambios' : 'Agregar gasto'}
                    </Button>
                    {editingGasto && (
                      <Button
                        variant="outlined"
                        onClick={resetGastoForm}
                        sx={{
                          borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                          fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
                          '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
                        }}
                      >
                        Cancelar edición
                      </Button>
                    )}
                  </Box>
                  </Collapse>

                  <Divider sx={{ mt: formCollapsed ? 0 : 3, borderColor: ACCENT_BORDER }} />
                </Box>
              )}

              <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                        {['Nombre', 'Tipo', 'Departamentos', 'Monto', ''].map(h => (
                          <TableCell
                            key={h}
                            sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.25, borderBottom: '1px solid #E5E7EB' }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {gastosPeriodo.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center', border: 0 }}>
                            <ReceiptLongIcon sx={{ fontSize: 28, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                              No hay gastos cargados.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        gastosPeriodo.map(g => {
                          const todosAsignados = !g.departamentos_ids?.length || g.departamentos_ids.length === departamentosPeriodo.length
                          const enEdicion = editingGasto?.id === g.id
                          return (
                            <TableRow
                              key={g.id}
                              sx={{
                                bgcolor: enEdicion ? ACCENT_LIGHT : 'transparent',
                                '&:last-child td': { border: 0 },
                                '& td': { borderBottom: '1px solid #F3F4F6' },
                              }}
                            >
                              <TableCell sx={{ py: 1.25 }}>
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>{g.nombre}</Typography>
                                <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{g.categoria}</Typography>
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                <Chip
                                  label={g.tipo}
                                  size="small"
                                  sx={{
                                    height: 20, fontSize: '0.65rem', fontWeight: 600, textTransform: 'capitalize', border: 'none',
                                    bgcolor: g.tipo === 'ordinario' ? ACCENT_LIGHT : '#FEF3C7',
                                    color: g.tipo === 'ordinario' ? ACCENT : '#B45309',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                {todosAsignados ? (
                                  <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Todos</Typography>
                                ) : (
                                  <Box display="flex" gap={0.5} flexWrap="wrap">
                                    {g.departamentos_ids.map(depId => (
                                      <Chip key={depId} label={deptoNumMap[depId] ?? depId} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell sx={{ py: 1.25 }}>
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                                  {fmt(g.monto)}
                                </Typography>
                              </TableCell>
                              {periodoAbierto && (
                                <TableCell sx={{ py: 1.25 }} align="right">
                                  <IconButton size="small" onClick={() => startEditGasto(g)} sx={{ color: enEdicion ? ACCENT : '#9CA3AF', '&:hover': { color: ACCENT } }}>
                                    <EditIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => handleDeleteGasto(g.id)} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {gastosPeriodo.length > 0 && (
                <Box display="flex" gap={3} justifyContent="flex-end" mt={2}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    Ordinario: <strong>{fmt(totalOrdDrawer)}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    Extraordinario: <strong>{fmt(totalExtDrawer)}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
                    Total: {fmt(totalGralDrawer)}
                  </Typography>
                </Box>
              )}

              {departamentosPeriodo.length > 0 && (
                <>
                  {depsExcluidos.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2.5, borderRadius: '8px', fontSize: '0.78rem' }}>
                      Sin coeficiente, excluidos de algunos gastos: {depsExcluidos.map(d => d.numeracion).join(', ')}
                    </Alert>
                  )}
                  {liquidacionGuardada && gastosCambiados && (
                    <Alert severity="info" sx={{ mt: 2.5, borderRadius: '8px', fontSize: '0.78rem' }}>
                      Los gastos cambiaron — volvé a guardar los cambios para actualizar la liquidación.
                    </Alert>
                  )}

                  <Divider sx={{ my: 2.5, borderColor: '#F3F4F6' }} />
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleGuardarCambios}
                    disabled={savingLiquidacion || liquidacion.length === 0}
                    startIcon={savingLiquidacion ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{
                      bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                      fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                      '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                    }}
                  >
                    {savingLiquidacion ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </>
              )}
            </>
          )}
          </Box>
        </>
      )}
    </Drawer>
  )
}
