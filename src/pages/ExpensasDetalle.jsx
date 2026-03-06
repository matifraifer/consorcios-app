import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  InputAdornment,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PaymentsIcon from '@mui/icons-material/Payments'
import PaidIcon from '@mui/icons-material/Paid'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  getPeriodoById,
  getGastosByPeriodo,
  createGasto,
  updateGasto,
  deleteGasto,
  getDepartamentosConCoeficiente,
  saveExpensasDepartamento,
  getExpensasDepartamento,
  registrarPago,
  closePeriodo,
} from '../services/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CATEGORIAS = ['sueldos','limpieza','mantenimiento','seguros','servicios','administracion','otros']
const TIPOS = ['ordinario','extraordinario']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const GASTO_VACIO = { nombre: '', monto: '', categoria: 'sueldos', tipo: 'ordinario', proveedor: '', comprobante: '' }

export default function ExpensasDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState(null)
  const [gastos, setGastos] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [tab, setTab] = useState(0)

  // Modal gasto
  const [gastoModal, setGastoModal] = useState({ open: false, gasto: null })
  const [gastoForm, setGastoForm] = useState(GASTO_VACIO)
  const [savingGasto, setSavingGasto] = useState(false)
  const [gastoError, setGastoError] = useState(null)

  // Liquidacion
  const [savingLiquidacion, setSavingLiquidacion] = useState(false)
  const [liquidacionGuardada, setLiquidacionGuardada] = useState(false)
  const [gastosCambiados, setGastosCambiados] = useState(false)
  const [expensasDep, setExpensasDep] = useState([])

  // Modal pago
  const [pagoModal, setPagoModal] = useState({ open: false, item: null })
  const [montoPagadoInput, setMontoPagadoInput] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  // Cerrar periodo
  const [confirmClose, setConfirmClose] = useState(false)
  const [closingPeriodo, setClosingPeriodo] = useState(false)

  useEffect(() => {
    Promise.all([getPeriodoById(id), getGastosByPeriodo(id), getExpensasDepartamento(id)])
      .then(([per, gas, expDep]) => {
        setPeriodo(per)
        setGastos(gas)
        setExpensasDep(expDep)
        if (expDep.length > 0) setLiquidacionGuardada(true)
        return getDepartamentosConCoeficiente(per.consorcio_id)
      })
      .then(setDepartamentos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Computed
  const abierto = periodo?.estado === 'abierto'
  const totalOrd = gastos.filter(g => g.tipo === 'ordinario').reduce((s, g) => s + Number(g.monto), 0)
  const totalExt = gastos.filter(g => g.tipo === 'extraordinario').reduce((s, g) => s + Number(g.monto), 0)
  const totalGral = totalOrd + totalExt

  const ningunCoeficiente = departamentos.length > 0 && departamentos.every(dep => !dep.coeficiente)
  const nDeps = departamentos.length || 1

  const liquidacion = departamentos.map(dep => {
    if (ningunCoeficiente) {
      return {
        departamento_id:      dep.id,
        numeracion:           dep.numeracion,
        propietario:          dep.propietarios ? `${dep.propietarios.apellido}, ${dep.propietarios.nombre}` : '-',
        coeficiente:          null,
        distribucionIgual:    true,
        monto_ordinario:      totalOrd / nDeps,
        monto_extraordinario: totalExt / nDeps,
        monto_total:          totalGral / nDeps,
      }
    }
    return {
      departamento_id:      dep.id,
      numeracion:           dep.numeracion,
      propietario:          dep.propietarios ? `${dep.propietarios.apellido}, ${dep.propietarios.nombre}` : '-',
      coeficiente:          dep.coeficiente,
      distribucionIgual:    false,
      monto_ordinario:      dep.coeficiente ? totalOrd * (Number(dep.coeficiente) / 100) : null,
      monto_extraordinario: dep.coeficiente ? totalExt * (Number(dep.coeficiente) / 100) : null,
      monto_total:          dep.coeficiente ? totalGral * (Number(dep.coeficiente) / 100) : null,
    }
  })

  const depsSinCoeficiente = ningunCoeficiente ? [] : liquidacion.filter(l => !l.coeficiente)

  const pagadoMap = Object.fromEntries(expensasDep.map(e => [e.departamento_id, e]))

  // --- Gasto modal ---
  function openNuevoGasto() {
    setGastoForm(GASTO_VACIO)
    setGastoModal({ open: true, gasto: null })
    setGastoError(null)
  }

  function openEditGasto(gasto) {
    setGastoForm({
      nombre:      gasto.nombre,
      monto:       gasto.monto,
      categoria:   gasto.categoria,
      tipo:        gasto.tipo,
      proveedor:   gasto.proveedor || '',
      comprobante: gasto.comprobante || '',
    })
    setGastoModal({ open: true, gasto })
    setGastoError(null)
  }

  function closeGastoModal() {
    setGastoModal({ open: false, gasto: null })
  }

  function handleGastoFormChange(e) {
    setGastoForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleGastoSubmit() {
    if (!gastoForm.nombre.trim() || !gastoForm.monto) return
    setSavingGasto(true)
    setGastoError(null)
    try {
      if (gastoModal.gasto) {
        const updated = await updateGasto(gastoModal.gasto.id, gastoForm)
        setGastos(prev => prev.map(g => g.id === updated.id ? updated : g))
      } else {
        const created = await createGasto({ ...gastoForm, periodo_id: id })
        setGastos(prev => [...prev, created])
      }
      if (liquidacionGuardada) setGastosCambiados(true)
      closeGastoModal()
    } catch (err) {
      setGastoError(err.message)
    } finally {
      setSavingGasto(false)
    }
  }

  async function handleDeleteGasto(gastoId) {
    try {
      await deleteGasto(gastoId)
      setGastos(prev => prev.filter(g => g.id !== gastoId))
      if (liquidacionGuardada) setGastosCambiados(true)
    } catch (err) {
      setError(err.message)
    }
  }

  function openPagoModal(l) {
    const entry = pagadoMap[l.departamento_id]
    setPagoModal({ open: true, item: l })
    setMontoPagadoInput(entry?.monto_pagado != null ? String(entry.monto_pagado) : l.monto_total != null ? String(Number(l.monto_total).toFixed(2)) : '')
  }

  function closePagoModal() {
    setPagoModal({ open: false, item: null })
  }

  async function handleRegistrarPago() {
    const entry = pagadoMap[pagoModal.item.departamento_id]
    if (!entry || !montoPagadoInput) return
    setSavingPago(true)
    try {
      await registrarPago(entry.id, { pagado: true, monto_pagado: Number(montoPagadoInput) })
      setExpensasDep(prev => prev.map(e => e.id === entry.id ? { ...e, pagado: true, monto_pagado: Number(montoPagadoInput) } : e))
      closePagoModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPago(false)
    }
  }

  async function handleAnularPago(departamentoId) {
    const entry = pagadoMap[departamentoId]
    if (!entry) return
    try {
      await registrarPago(entry.id, { pagado: false, monto_pagado: null })
      setExpensasDep(prev => prev.map(e => e.id === entry.id ? { ...e, pagado: false, monto_pagado: null } : e))
      closePagoModal()
    } catch (err) {
      setError(err.message)
    }
  }

  // --- Liquidacion ---
  async function handleSaveLiquidacion() {
    setSavingLiquidacion(true)
    try {
      const items = liquidacion
        .filter(l => l.coeficiente || l.distribucionIgual)
        .map(l => ({
          periodo_id:           Number(id),
          departamento_id:      l.departamento_id,
          monto_ordinario:      l.monto_ordinario,
          monto_extraordinario: l.monto_extraordinario,
          monto_total:          l.monto_total,
          pagado:               pagadoMap[l.departamento_id]?.pagado ?? false,
          monto_pagado:         pagadoMap[l.departamento_id]?.monto_pagado ?? null,
        }))
      await saveExpensasDepartamento(id, items)
      const newExpensasDep = await getExpensasDepartamento(id)
      setExpensasDep(newExpensasDep)
      setLiquidacionGuardada(true)
      setGastosCambiados(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingLiquidacion(false)
    }
  }

  async function handleClosePeriodo() {
    setClosingPeriodo(true)
    try {
      await closePeriodo(id)
      setPeriodo(prev => ({ ...prev, estado: 'cerrado' }))
      setConfirmClose(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setClosingPeriodo(false)
    }
  }

  function handleExportPDF() {
    const doc = new jsPDF()
    const nombreConsorcio = periodo.consorcios?.nombre ?? ''
    const nombrePeriodo = `${MESES[periodo.mes - 1]} ${periodo.anio}`

    doc.setFontSize(16)
    doc.text(nombreConsorcio, 14, 20)
    doc.setFontSize(12)
    doc.text(`Liquidación de Expensas — ${nombrePeriodo}`, 14, 30)
    doc.setFontSize(9)
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-AR')}`, 14, 38)

    doc.setFontSize(12)
    doc.text('Resumen de Gastos', 14, 48)
    autoTable(doc, {
      startY: 52,
      head: [['Nombre', 'Categoría', 'Tipo', 'Proveedor', 'Comprobante', 'Monto']],
      body: gastos.map(g => [
        g.nombre,
        g.categoria,
        g.tipo,
        g.proveedor || '-',
        g.comprobante || '-',
        fmt(g.monto),
      ]),
      foot: [
        ['Total Ordinario', '', '', '', '', fmt(totalOrd)],
        ['Total Extraordinario', '', '', '', '', fmt(totalExt)],
        ['Total General', '', '', '', '', fmt(totalGral)],
      ],
      footStyles: { fontStyle: 'bold' },
    })

    const y = doc.lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text('Liquidación por Departamento', 14, y)
    autoTable(doc, {
      startY: y + 4,
      head: [['Depto.', 'Propietario', 'Coeficiente', 'Ordinario', 'Extraordinario', 'Total']],
      body: liquidacion.filter(l => l.coeficiente || l.distribucionIgual).map(l => [
        l.numeracion,
        l.propietario,
        l.distribucionIgual ? 'Igualitaria' : `${l.coeficiente}%`,
        fmt(l.monto_ordinario),
        fmt(l.monto_extraordinario),
        fmt(l.monto_total),
      ]),
    })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        'Documento generado por el sistema de administración',
        14,
        doc.internal.pageSize.height - 10
      )
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - 40,
        doc.internal.pageSize.height - 10
      )
    }

    doc.save(`expensas-${nombreConsorcio}-${periodo.mes}-${periodo.anio}.pdf`)
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (!periodo) return <Alert severity="error">{error ?? 'Período no encontrado'}</Alert>

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/expensas')} sx={{ mb: 2 }}>
        Volver a Expensas
      </Button>

      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Typography variant="h5" fontWeight="bold">
          {MESES[periodo.mes - 1]} {periodo.anio}
        </Typography>
        <Chip
          label={periodo.estado}
          size="small"
          color={periodo.estado === 'abierto' ? 'primary' : 'default'}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Consorcio: <strong>{periodo.consorcios?.nombre}</strong>
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Gastos" />
        <Tab label="Liquidación" />
      </Tabs>

      {/* ── Tab Gastos ── */}
      {tab === 0 && (
        <Box>
          <Box mb={2} display="flex" gap={2}>
            {abierto && (
              <Button variant="contained" onClick={openNuevoGasto}>
                + Agregar Gasto
              </Button>
            )}
            <Button
              variant="contained"
              color="secondary"
              onClick={handleSaveLiquidacion}
              disabled={savingLiquidacion || liquidacion.length === 0}
              startIcon={savingLiquidacion ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {savingLiquidacion ? 'Guardando...' : 'Guardar Liquidación'}
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Nombre</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Categoría</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tipo</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Proveedor</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Comprobante</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Monto</TableCell>
                  {abierto && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {gastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={abierto ? 7 : 6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No hay gastos cargados.
                    </TableCell>
                  </TableRow>
                ) : (
                  gastos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.nombre}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{g.categoria}</TableCell>
                      <TableCell>
                        <Chip
                          label={g.tipo}
                          size="small"
                          color={g.tipo === 'ordinario' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>{g.proveedor || '-'}</TableCell>
                      <TableCell>{g.comprobante || '-'}</TableCell>
                      <TableCell align="right">{fmt(g.monto)}</TableCell>
                      {abierto && (
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton size="small" onClick={() => openEditGasto(g)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteGasto(g.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {gastos.length > 0 && (
            <Box mt={2} display="flex" gap={4} justifyContent="flex-end">
              <Typography variant="body2">
                Total Ordinario: <strong>{fmt(totalOrd)}</strong>
              </Typography>
              <Typography variant="body2">
                Total Extraordinario: <strong>{fmt(totalExt)}</strong>
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                Total General: {fmt(totalGral)}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── Tab Liquidacion ── */}
      {tab === 1 && (
        <Box>
          {ningunCoeficiente && departamentos.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ningún departamento tiene coeficiente asignado. Los gastos se distribuirán en partes iguales entre los {departamentos.length} departamentos.
            </Alert>
          )}

          {depsSinCoeficiente.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Los siguientes departamentos no tienen coeficiente y no se incluiran en el calculo:{' '}
              <strong>{depsSinCoeficiente.map(d => d.numeracion).join(', ')}</strong>
            </Alert>
          )}

          {liquidacionGuardada && gastosCambiados && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Los gastos fueron modificados. La liquidacion guardada puede estar desactualizada — guarda nuevamente para actualizarla.
            </Alert>
          )}

          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Coeficiente</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Ord.</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Ext.</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Pagado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {liquidacion.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No hay departamentos en este consorcio.
                    </TableCell>
                  </TableRow>
                ) : (
                  liquidacion.map((l) => (
                    <TableRow key={l.departamento_id} sx={{ opacity: (l.coeficiente || l.distribucionIgual) ? 1 : 0.4 }}>
                      <TableCell>
                        <Chip label={l.numeracion} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{l.propietario}</TableCell>
                      <TableCell align="right">{l.distribucionIgual ? 'Igualitaria' : l.coeficiente ? `${l.coeficiente}%` : '-'}</TableCell>
                      <TableCell align="right">{l.monto_ordinario != null ? fmt(l.monto_ordinario) : '-'}</TableCell>
                      <TableCell align="right">{l.monto_extraordinario != null ? fmt(l.monto_extraordinario) : '-'}</TableCell>
                      <TableCell align="right">{l.monto_total != null ? fmt(l.monto_total) : '-'}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={
                          abierto
                            ? 'Cerrá el período primero para registrar pagos'
                            : !pagadoMap[l.departamento_id]
                              ? 'Guardá la liquidación primero'
                              : pagadoMap[l.departamento_id]?.pagado
                                ? 'Pago registrado — clic para editar'
                                : 'Registrar pago'
                        }>
                          <span>
                            <IconButton
                              size="small"
                              color={pagadoMap[l.departamento_id]?.pagado ? 'success' : 'default'}
                              onClick={() => openPagoModal(l)}
                              disabled={abierto || !pagadoMap[l.departamento_id]}
                            >
                              {pagadoMap[l.departamento_id]?.pagado
                                ? <PaidIcon fontSize="small" />
                                : <PaymentsIcon fontSize="small" />
                              }
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" gap={2} flexWrap="wrap">
            <Button variant="outlined" onClick={handleExportPDF}>
              Exportar PDF
            </Button>

            {abierto && (
              <Button variant="outlined" color="error" onClick={() => setConfirmClose(true)}>
                Cerrar Período
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* ── Modal Gasto ── */}
      <Dialog open={gastoModal.open} onClose={closeGastoModal} maxWidth="sm" fullWidth>
        <DialogTitle>{gastoModal.gasto ? 'Editar Gasto' : 'Agregar Gasto'}</DialogTitle>
        <DialogContent>
          {gastoError && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{gastoError}</Alert>}

          <TextField
            label="Nombre"
            name="nombre"
            fullWidth
            margin="normal"
            value={gastoForm.nombre}
            onChange={handleGastoFormChange}
            required
            autoFocus
          />

          <TextField
            label="Monto"
            name="monto"
            type="number"
            fullWidth
            margin="normal"
            value={gastoForm.monto}
            onChange={handleGastoFormChange}
            required
            inputProps={{ min: 0, step: '0.01' }}
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Categoría</InputLabel>
            <Select name="categoria" value={gastoForm.categoria} label="Categoría" onChange={handleGastoFormChange}>
              {CATEGORIAS.map((c) => (
                <MenuItem key={c} value={c} sx={{ textTransform: 'capitalize' }}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Tipo</InputLabel>
            <Select name="tipo" value={gastoForm.tipo} label="Tipo" onChange={handleGastoFormChange}>
              {TIPOS.map((t) => (
                <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Proveedor"
            name="proveedor"
            fullWidth
            margin="normal"
            value={gastoForm.proveedor}
            onChange={handleGastoFormChange}
          />

          <TextField
            label="Comprobante"
            name="comprobante"
            fullWidth
            margin="normal"
            value={gastoForm.comprobante}
            onChange={handleGastoFormChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGastoModal}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGastoSubmit}
            disabled={savingGasto}
            startIcon={savingGasto ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {savingGasto ? 'Guardando...' : gastoModal.gasto ? 'Guardar Cambios' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal Pago ── */}
      <Dialog open={pagoModal.open} onClose={closePagoModal} maxWidth="xs" fullWidth>
        <DialogTitle>
          {pagadoMap[pagoModal.item?.departamento_id]?.pagado ? 'Editar pago registrado' : 'Registrar pago'}
        </DialogTitle>
        <DialogContent>
          {pagoModal.item && (
            <Box>
              <Box display="flex" gap={1} alignItems="center" mb={1} mt={1}>
                <Chip label={pagoModal.item.numeracion} size="small" variant="outlined" />
                <Typography variant="body2" color="text.secondary">
                  {pagoModal.item.propietario}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Monto esperado: <strong>{pagoModal.item.monto_total != null ? fmt(pagoModal.item.monto_total) : '-'}</strong>
              </Typography>
              {pagadoMap[pagoModal.item.departamento_id]?.pagado && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Pago registrado por <strong>{fmt(pagadoMap[pagoModal.item.departamento_id]?.monto_pagado ?? 0)}</strong>
                </Alert>
              )}
              <TextField
                label="Monto recibido"
                type="number"
                fullWidth
                value={montoPagadoInput}
                onChange={e => setMontoPagadoInput(e.target.value)}
                inputProps={{ min: 0, step: '0.01' }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {pagadoMap[pagoModal.item?.departamento_id]?.pagado && (
            <Button color="error" onClick={() => handleAnularPago(pagoModal.item?.departamento_id)} sx={{ mr: 'auto' }}>
              Anular pago
            </Button>
          )}
          <Button onClick={closePagoModal}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleRegistrarPago}
            disabled={savingPago || !montoPagadoInput}
            startIcon={savingPago ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {savingPago ? 'Guardando...' : 'Confirmar pago'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirmar cierre ── */}
      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)}>
        <DialogTitle>Cerrar período</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que querés cerrar el período{' '}
            <strong>{MESES[periodo.mes - 1]} {periodo.anio}</strong>?
            Una vez cerrado, no se podrán agregar ni modificar gastos.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleClosePeriodo}
            disabled={closingPeriodo}
          >
            {closingPeriodo ? 'Cerrando...' : 'Cerrar Período'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
