import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'
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
  Drawer,
  Divider,
  TextField,
  IconButton,
  Snackbar,
  Chip,
  LinearProgress,
  InputAdornment,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PersonIcon from '@mui/icons-material/Person'
import ApartmentIcon from '@mui/icons-material/Apartment'
import EditIcon from '@mui/icons-material/Edit'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PaymentsIcon from '@mui/icons-material/Payments'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  getConsorcioById,
  updateConsorcio,
  getPropietariosConDetalle,
  createPropietario,
  updatePropietario,
  importarPropietarios,
  getDepartamentosByConsorcio,
  createDepartamento,
  updateDepartamento,
  getPeriodosByConsorcio,
  createPeriodo,
  closePeriodo,
  getDepartamentosConCoeficiente,
  getGastosByPeriodo,
  getExpensasDepartamento,
  saveExpensasDepartamento,
  getLiquidacionesConsorcio,
  enviarLinkConsultaDeuda,
} from '../services/supabase'
import GastosPeriodoDrawer from '../components/expensas/GastosPeriodoDrawer'
import PagosDepartamentoDialog from '../components/expensas/PagosDepartamentoDialog'
import { calcLiquidacion } from '../utils/calcLiquidacion'
import { calcularSaldosMora } from '../utils/calcularSaldosMora'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const FORM_INICIAL = { dni: '', nombre: '', apellido: '' }
const DEPTO_FORM_INICIAL = { numeracion: '', id_propietario: '', inquilino: '', email: '', coeficiente: '' }

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const MESES_SELECT = MESES_LABEL.map((label, i) => ({ value: i + 1, label }))
const PERIODO_FORM_INICIAL = { mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), fecha_vencimiento: '' }

function calcTotalGastos(gastos) {
  return (gastos || []).reduce((s, g) => s + Number(g.monto), 0)
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Monto del pago más reciente registrado (pagado = true) para un departamento,
// recorriendo los períodos de más nuevo a más viejo (ya vienen ordenados desc).
function getUltimoPago(periodos, expensas, departamentoId) {
  for (const periodo of periodos) {
    const exp = expensas.find(e => e.periodo_id === periodo.id && e.departamento_id === departamentoId)
    if (exp?.pagado) return Number(exp.monto_pagado ?? exp.monto_total ?? 0)
  }
  return null
}

export default function ConsorcioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clienteId, user } = useAuth()
  const fileInputRef = useRef(null)

  const [consorcio, setConsorcio] = useState(null)
  const [propietarios, setPropietarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDepto, setBusquedaDepto] = useState('')
  const [tab, setTab] = useState(0)

  // Drawer nuevo/editar propietario
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [editingPropId, setEditingPropId] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Drawer nuevo/editar departamento
  const [nuevoDeptoOpen, setNuevoDeptoOpen] = useState(false)
  const [editingDeptoId, setEditingDeptoId] = useState(null)
  const [deptoForm, setDeptoForm] = useState(DEPTO_FORM_INICIAL)
  const [savingDepto, setSavingDepto] = useState(false)
  const [deptoFormError, setDeptoFormError] = useState(null)
  const [successDepto, setSuccessDepto] = useState(false)

  // Link de consulta de deuda (copiar / reenviar por email)
  const [linkSnack, setLinkSnack] = useState('')
  const [reenviandoId, setReenviandoId] = useState(null)

  // Drawer nuevo período
  const [nuevoPeriodoOpen, setNuevoPeriodoOpen] = useState(false)
  const [periodoForm, setPeriodoForm] = useState(PERIODO_FORM_INICIAL)
  const [creatingPeriodo, setCreatingPeriodo] = useState(false)
  const [periodoFormError, setPeriodoFormError] = useState(null)

  // Drawer gastos del período
  const [periodoDrawerOpen, setPeriodoDrawerOpen] = useState(false)
  const [selectedPeriodo, setSelectedPeriodo] = useState(null)

  // Cerrar período (desde la grilla de períodos)
  const [confirmClosePeriodoItem, setConfirmClosePeriodoItem] = useState(null)
  const [closingPeriodo, setClosingPeriodo] = useState(false)
  const [closePeriodoError, setClosePeriodoError] = useState(null)

  // Descargar detalle de gastos (PDF por período)
  const [descargarGastosOpen, setDescargarGastosOpen] = useState(false)
  const [descargarGastosPeriodoId, setDescargarGastosPeriodoId] = useState('')
  const [descargandoGastos, setDescargandoGastos] = useState(false)
  const [descargarGastosError, setDescargarGastosError] = useState(null)

  // Liquidaciones (mora / interés)
  const [liquidacionesData, setLiquidacionesData] = useState({ departamentos: [], periodos: [], expensas: [] })
  const [tasaMora, setTasaMora] = useState('')
  const [savingTasaMora, setSavingTasaMora] = useState(false)
  const [tasaMoraError, setTasaMoraError] = useState(null)

  // Diálogo de pagos por departamento (pestaña Liquidaciones)
  const [pagosDialogOpen, setPagosDialogOpen] = useState(false)
  const [pagosDialogDepto, setPagosDialogDepto] = useState(null)

  // Drawer importación
  const [importOpen, setImportOpen] = useState(false)
  const [preview, setPreview] = useState([])
  const [resultados, setResultados] = useState([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  async function cargarDatos() {
    try {
      const [cons, props, deptos, per, liq] = await Promise.all([
        getConsorcioById(id),
        getPropietariosConDetalle(id),
        getDepartamentosByConsorcio(id),
        getPeriodosByConsorcio(id),
        getLiquidacionesConsorcio(id),
      ])
      setConsorcio(cons)
      setPropietarios(props)
      setDepartamentos(deptos)
      setPeriodos(per)
      setLiquidacionesData(liq)
      setTasaMora(cons.tasa_mora != null ? String(cons.tasa_mora) : '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [id])

  // ── Nuevo / editar propietario ───────────────────────────────────────────

  function openNuevo() {
    setEditingPropId(null)
    setForm(FORM_INICIAL)
    setFormError(null)
    setNuevoOpen(true)
  }

  function openEditProp(prop) {
    setEditingPropId(prop.id)
    setForm({
      dni: prop.dni ?? '',
      nombre: prop.nombre ?? '',
      apellido: prop.apellido ?? '',
    })
    setFormError(null)
    setNuevoOpen(true)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dni.trim() || !form.nombre.trim() || !form.apellido.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      if (editingPropId) {
        await updatePropietario(editingPropId, form)
      } else {
        await createPropietario({ ...form, id_consorcio: id, cliente_id: clienteId })
      }
      setSuccess(true)
      setNuevoOpen(false)
      const data = await getPropietariosConDetalle(id)
      setPropietarios(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Nuevo / editar departamento ──────────────────────────────────────────

  function openNuevoDepto() {
    setEditingDeptoId(null)
    setDeptoForm(DEPTO_FORM_INICIAL)
    setDeptoFormError(null)
    setNuevoDeptoOpen(true)
  }

  function openEditDepto(depto) {
    setEditingDeptoId(depto.id)
    setDeptoForm({
      numeracion: depto.numeracion ?? '',
      id_propietario: depto.id_propietario ?? '',
      inquilino: depto.inquilino ?? '',
      email: depto.email ?? '',
      coeficiente: depto.coeficiente ?? '',
    })
    setDeptoFormError(null)
    setNuevoDeptoOpen(true)
  }

  function handleChangeDepto(e) {
    setDeptoForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleCopiarLink(depto) {
    navigator.clipboard.writeText(`https://consorcios-app.vercel.app/consulta/${depto.token_consulta}`)
    setLinkSnack('Link copiado al portapapeles')
  }

  async function handleReenviarEmail(depto) {
    setReenviandoId(depto.id)
    try {
      await enviarLinkConsultaDeuda(depto.id)
      setLinkSnack('Le enviamos el link de consulta de deuda por email')
    } catch {
      setLinkSnack('No se pudo enviar el email')
    } finally {
      setReenviandoId(null)
    }
  }

  async function handleSubmitDepto(e) {
    e.preventDefault()
    if (!deptoForm.numeracion.trim()) return
    setSavingDepto(true)
    setDeptoFormError(null)
    try {
      const prevEmail = editingDeptoId ? departamentos.find(d => d.id === editingDeptoId)?.email : null
      let savedDepto
      if (editingDeptoId) {
        savedDepto = await updateDepartamento(editingDeptoId, deptoForm)
      } else {
        savedDepto = await createDepartamento({ ...deptoForm, id_consorcio: id })
      }
      setSuccessDepto(true)
      setNuevoDeptoOpen(false)
      const data = await getDepartamentosByConsorcio(id)
      setDepartamentos(data)

      const emailCambio = (savedDepto.email || '') !== (prevEmail || '')
      if (savedDepto.email && emailCambio) {
        enviarLinkConsultaDeuda(savedDepto.id)
          .then(() => setLinkSnack('Le enviamos el link de consulta de deuda por email'))
          .catch(() => setLinkSnack('El departamento se guardó, pero no se pudo enviar el email con el link'))
      }
    } catch (err) {
      setDeptoFormError(err.message)
    } finally {
      setSavingDepto(false)
    }
  }

  // ── Nuevo período / drawer de gastos ─────────────────────────────────────

  function openNuevoPeriodo() {
    setPeriodoForm(PERIODO_FORM_INICIAL)
    setPeriodoFormError(null)
    setNuevoPeriodoOpen(true)
  }

  function openPeriodoDrawer(periodo) {
    setSelectedPeriodo(periodo)
    setPeriodoDrawerOpen(true)
  }

  function syncPeriodoGastos(periodoId, gastos) {
    setPeriodos(prev => prev.map(p =>
      p.id === periodoId ? { ...p, gastos: gastos.map(g => ({ monto: g.monto })) } : p
    ))
  }

  function syncPeriodoClosed(periodoId) {
    setPeriodos(prev => prev.map(p => p.id === periodoId ? { ...p, estado: 'cerrado' } : p))
  }

  function handleLiquidacionChange() {
    getLiquidacionesConsorcio(id)
      .then(setLiquidacionesData)
      .catch(() => {})
  }

  // ── Cerrar período (desde la grilla) ─────────────────────────────────────

  async function handleConfirmClosePeriodo() {
    if (!confirmClosePeriodoItem) return
    const periodoId = confirmClosePeriodoItem.id
    setClosingPeriodo(true)
    setClosePeriodoError(null)
    try {
      // Guardar la liquidación con los gastos actuales antes de cerrar, para
      // que la deuda del período aparezca en la pestaña Liquidaciones.
      const [deptos, gastos, expensasExistentes] = await Promise.all([
        getDepartamentosConCoeficiente(id),
        getGastosByPeriodo(periodoId),
        getExpensasDepartamento(periodoId),
      ])
      const pagadoMap = Object.fromEntries(expensasExistentes.map(e => [e.departamento_id, e]))
      const liquidacion = calcLiquidacion(deptos, gastos)
      const items = liquidacion.map(l => ({
        periodo_id: Number(periodoId),
        departamento_id: l.departamento_id,
        monto_ordinario: l.monto_ordinario,
        monto_extraordinario: l.monto_extraordinario,
        monto_total: l.monto_total,
        pagado: pagadoMap[l.departamento_id]?.pagado ?? false,
        monto_pagado: pagadoMap[l.departamento_id]?.monto_pagado ?? null,
      }))
      if (items.length > 0) await saveExpensasDepartamento(periodoId, items)

      await closePeriodo(periodoId)
      syncPeriodoClosed(periodoId)
      setConfirmClosePeriodoItem(null)
      handleLiquidacionChange()
    } catch (err) {
      setClosePeriodoError(err.message)
    } finally {
      setClosingPeriodo(false)
    }
  }

  // ── Pagos por departamento (pestaña Liquidaciones) ───────────────────────

  function openPagosDialog(depto) {
    setPagosDialogDepto(depto)
    setPagosDialogOpen(true)
  }

  function closePagosDialog() {
    setPagosDialogOpen(false)
  }

  async function handleSubmitPeriodo(e) {
    e.preventDefault()
    if (!periodoForm.mes || !periodoForm.anio || !periodoForm.fecha_vencimiento) return
    setCreatingPeriodo(true)
    setPeriodoFormError(null)
    try {
      const periodo = await createPeriodo({
        consorcio_id: id, cliente_id: clienteId, usuario_id: user.id,
        mes: periodoForm.mes, anio: periodoForm.anio, fecha_vencimiento: periodoForm.fecha_vencimiento,
      })
      const periodoConGastos = { ...periodo, gastos: [] }
      setPeriodos(prev => [periodoConGastos, ...prev])
      setNuevoPeriodoOpen(false)
      openPeriodoDrawer(periodoConGastos)
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique') || err.code === '23505') {
        setPeriodoFormError('Ya existe un período para ese mes y año.')
      } else {
        setPeriodoFormError(err.message)
      }
    } finally {
      setCreatingPeriodo(false)
    }
  }

  // ── Liquidaciones (mora / interés) ───────────────────────────────────────

  async function handleGuardarTasaMora() {
    setSavingTasaMora(true)
    setTasaMoraError(null)
    try {
      const cons = await updateConsorcio(id, { tasa_mora: tasaMora === '' ? 0 : Number(tasaMora) })
      setConsorcio(prev => ({ ...prev, tasa_mora: cons.tasa_mora }))
    } catch (err) {
      setTasaMoraError(err.message)
    } finally {
      setSavingTasaMora(false)
    }
  }

  function handleExportLiquidacionesPDF() {
    const doc = new jsPDF({ orientation: 'landscape' })
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height

    doc.setFontSize(16)
    doc.setTextColor(6, 95, 70)
    doc.text(consorcio?.nombre ?? '', 14, 18)
    doc.setFontSize(11)
    doc.setTextColor(55, 65, 81)
    doc.text('Liquidación de expensas', 14, 26)
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(`Liquidación al: ${new Date().toLocaleDateString('es-AR')}`, 14, 33)

    autoTable(doc, {
      startY: 40,
      head: [['Unidad', 'Propietario', 'Inquilino', 'Saldo último período', 'Último pago', 'Saldo en mora', 'Interés mora', 'Saldo total']],
      body: liquidaciones.map(l => {
        const ultimoPago = getUltimoPago(liquidacionesData.periodos, liquidacionesData.expensas, l.departamento_id)
        return [
          l.numeracion,
          l.propietario || '-',
          l.inquilino || '-',
          l.saldoUltimo > 0 ? fmt(l.saldoUltimo) : '-',
          ultimoPago != null ? fmt(ultimoPago) : '-',
          l.saldoMora > 0 ? fmt(l.saldoMora) : '-',
          l.interesMora > 0 ? fmt(l.interesMora) : '-',
          fmt(l.saldoTotal),
        ]
      }),
      headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [236, 253, 245] },
      columnStyles: {
        3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
        6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' },
      },
    })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(156, 163, 175)
      doc.text('Documento generado por el sistema de administración', 14, pageHeight - 10)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 40, pageHeight - 10)
    }

    doc.save(`liquidaciones-${consorcio?.nombre ?? 'consorcio'}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function openDescargarGastos() {
    setDescargarGastosPeriodoId('')
    setDescargarGastosError(null)
    setDescargarGastosOpen(true)
  }

  function closeDescargarGastos() {
    setDescargarGastosOpen(false)
  }

  async function handleDescargarGastosPDF() {
    if (!descargarGastosPeriodoId) return
    setDescargandoGastos(true)
    setDescargarGastosError(null)
    try {
      const periodo = periodos.find(p => p.id === Number(descargarGastosPeriodoId))
      const gastos = await getGastosByPeriodo(periodo.id)
      const ordinarios = gastos.filter(g => g.tipo === 'ordinario')
      const extraordinarios = gastos.filter(g => g.tipo !== 'ordinario')
      const totalOrd = calcTotalGastos(ordinarios)
      const totalExt = calcTotalGastos(extraordinarios)

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height

      doc.setFontSize(16)
      doc.setTextColor(6, 95, 70)
      doc.text(consorcio?.nombre ?? '', 14, 18)
      doc.setFontSize(11)
      doc.setTextColor(55, 65, 81)
      doc.text(`Detalle de gastos — ${MESES_LABEL[periodo.mes - 1]} ${periodo.anio}`, 14, 26)
      doc.setFontSize(9)
      doc.setTextColor(107, 114, 128)
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}`, 14, 33)

      const tableCols = ['Descripción', 'Categoría', 'Proveedor', 'Comprobante', 'Monto']
      const toRow = g => [g.nombre, g.categoria || '-', g.proveedor || '-', g.comprobante || '-', fmt(g.monto)]

      doc.setFontSize(11)
      doc.setTextColor(6, 95, 70)
      doc.text('Gastos ordinarios', 14, 42)
      autoTable(doc, {
        startY: 46,
        head: [tableCols],
        body: ordinarios.length ? ordinarios.map(toRow) : [['Sin gastos ordinarios en este período', '', '', '', '']],
        foot: [['Total ordinario', '', '', '', fmt(totalOrd)]],
        headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
        footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 4: { halign: 'right' } },
      })

      const y2 = doc.lastAutoTable.finalY + 12
      doc.setFontSize(11)
      doc.setTextColor(6, 95, 70)
      doc.text('Gastos extraordinarios', 14, y2)
      autoTable(doc, {
        startY: y2 + 4,
        head: [tableCols],
        body: extraordinarios.length ? extraordinarios.map(toRow) : [['Sin gastos extraordinarios en este período', '', '', '', '']],
        foot: [['Total extraordinario', '', '', '', fmt(totalExt)]],
        headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
        footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 4: { halign: 'right' } },
      })

      const y3 = doc.lastAutoTable.finalY + 10
      doc.setFontSize(11)
      doc.setTextColor(17, 24, 39)
      doc.text(`Total general: ${fmt(totalOrd + totalExt)}`, 14, y3)

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text('Documento generado por el sistema de administración', 14, pageHeight - 10)
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 40, pageHeight - 10)
      }

      doc.save(`gastos-${consorcio?.nombre ?? 'consorcio'}-${periodo.mes}-${periodo.anio}.pdf`)
      setDescargarGastosOpen(false)
    } catch (err) {
      setDescargarGastosError(err.message)
    } finally {
      setDescargandoGastos(false)
    }
  }

  // ── Importación Excel ─────────────────────────────────────────────────────

  function openImport() {
    setPreview([])
    setResultados([])
    setImportError(null)
    setImportOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function closeImport() {
    setImportOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadEjemplo() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Unidad', 'Propietario', 'DNI'],
      ['1A', 'García Juan', '30123456'],
      ['2B', 'López, María', '28654321'],
      ['3C', 'Martínez Carlos', '25987654'],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Propietarios')
    XLSX.writeFile(wb, 'plantilla_propietarios.xlsx')
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPreview([])
    setResultados([])
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const filas = rows
          .slice(1)
          .filter(r => r.some(Boolean))
          .map(r => ({
            unidad: String(r[0] ?? '').trim(),
            propietario: String(r[1] ?? '').trim(),
            dni: String(r[2] ?? '').trim(),
          }))
          .filter(f => f.unidad || f.propietario || f.dni)
        if (filas.length === 0) {
          setImportError('El archivo no contiene filas con datos.')
          return
        }
        setPreview(filas)
      } catch {
        setImportError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImportar() {
    if (preview.length === 0) return
    setImporting(true)
    setImportError(null)
    setResultados([])
    try {
      const res = await importarPropietarios(preview, id, clienteId)
      setResultados(res)
      if (res.some(r => r.ok)) {
        const [data, deptos] = await Promise.all([
          getPropietariosConDetalle(id),
          getDepartamentosByConsorcio(id),
        ])
        setPropietarios(data)
        setDepartamentos(deptos)
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const exitosos = resultados.filter(r => r.ok).length
  const fallidos = resultados.filter(r => !r.ok).length

  // ─────────────────────────────────────────────────────────────────────────

  const filtrados = propietarios.filter(p =>
    `${p.apellido} ${p.nombre}`.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni?.includes(busqueda)
  )

  const filtradosDepto = departamentos.filter(d =>
    d.numeracion?.toLowerCase().includes(busquedaDepto.toLowerCase()) ||
    `${d.propietarios?.apellido ?? ''} ${d.propietarios?.nombre ?? ''}`.toLowerCase().includes(busquedaDepto.toLowerCase()) ||
    d.inquilino?.toLowerCase().includes(busquedaDepto.toLowerCase())
  )

  const liquidaciones = useMemo(
    () => calcularSaldosMora(
      liquidacionesData.departamentos,
      liquidacionesData.periodos,
      liquidacionesData.expensas,
      consorcio?.tasa_mora
    ),
    [liquidacionesData, consorcio?.tasa_mora]
  )

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Breadcrumb / back */}
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        mb={3}
        sx={{ cursor: 'pointer', width: 'fit-content' }}
        onClick={() => navigate('/consorcios')}
      >
        <ArrowBackIcon sx={{ fontSize: 15, color: '#9CA3AF' }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
          Consorcios
        </Typography>
      </Box>

      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Consorcio
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {consorcio?.nombre}
          </Typography>
        </Box>
        <Box display="flex" gap={1.5}>
          {tab === 0 ? (
            <>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
                onClick={openImport}
                sx={{
                  borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151',
                  '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT },
                }}
              >
                Importar desde Excel
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openNuevo}
                sx={{
                  bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                  fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
                  boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                }}
              >
                Nuevo propietario
              </Button>
            </>
          ) : tab === 1 ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openNuevoDepto}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
                boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              Nuevo departamento
            </Button>
          ) : tab === 2 ? (
            <>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={openDescargarGastos}
                sx={{
                  borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151',
                  '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT },
                }}
              >
                Descargar detalle de gastos
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openNuevoPeriodo}
                sx={{
                  bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                  fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
                  boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                }}
              >
                Nuevo período
              </Button>
            </>
          ) : tab === 3 ? (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={handleExportLiquidacionesPDF}
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151',
                '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT },
              }}
            >
              Descargar PDF
            </Button>
          ) : null}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          minHeight: 40,
          '& .MuiTabs-indicator': { bgcolor: ACCENT, height: 2.5, borderRadius: 2 },
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 40, minWidth: 'auto', px: 0, mr: 3, color: '#9CA3AF' },
          '& .Mui-selected': { color: `${ACCENT} !important` },
        }}
      >
        <Tab label="Propietarios" />
        <Tab label="Departamentos" />
        <Tab label="Expensas" />
        <Tab label="Liquidaciones" />
      </Tabs>

      {tab === 0 ? (
        <>
          {/* Toolbar: buscador + contador */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <TextField
              size="small"
              placeholder="Buscar por nombre o DNI..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: 280,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white',
                  '& fieldset': { borderColor: '#E5E7EB' },
                  '&:hover fieldset': { borderColor: ACCENT },
                  '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {filtrados.length} de {propietarios.length} propietario{propietarios.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Tabla propietarios */}
          <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    {['Propietario', 'DNI', 'Departamentos', ''].map(h => (
                      <TableCell
                        key={h}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                        <PersonIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                          {busqueda ? 'No se encontraron propietarios.' : 'No hay propietarios registrados.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtrados.map(p => (
                      <TableRow
                        key={p.id}
                        sx={{
                          '&:last-child td': { border: 0 },
                          '& td': { borderBottom: '1px solid #F3F4F6' },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                            {p.apellido}, {p.nombre}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                            {p.dni || <span style={{ color: '#D1D5DB' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {(p.departamentos ?? []).length === 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#D1D5DB' }}>—</span>
                            ) : (
                              (p.departamentos ?? []).map((dep, i) => (
                                <Chip
                                  key={i}
                                  label={dep.numeracion}
                                  size="small"
                                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }}
                                />
                              ))
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }} align="right">
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEditProp(p)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : tab === 1 ? (
        <>
          {/* Toolbar: buscador + contador */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <TextField
              size="small"
              placeholder="Buscar por unidad, propietario o inquilino..."
              value={busquedaDepto}
              onChange={e => setBusquedaDepto(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: 280,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white',
                  '& fieldset': { borderColor: '#E5E7EB' },
                  '&:hover fieldset': { borderColor: ACCENT },
                  '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {filtradosDepto.length} de {departamentos.length} departamento{departamentos.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Tabla departamentos */}
          <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    {['Unidad', 'Propietario', 'Inquilino', 'Coeficiente', ''].map(h => (
                      <TableCell
                        key={h}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtradosDepto.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                        <ApartmentIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                          {busquedaDepto ? 'No se encontraron departamentos.' : 'No hay departamentos registrados.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtradosDepto.map(d => (
                      <TableRow
                        key={d.id}
                        sx={{
                          '&:last-child td': { border: 0 },
                          '& td': { borderBottom: '1px solid #F3F4F6' },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={d.numeracion}
                            size="small"
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                            {d.propietarios ? `${d.propietarios.apellido}, ${d.propietarios.nombre}` : <span style={{ color: '#D1D5DB', fontWeight: 400 }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                            {d.inquilino || <span style={{ color: '#D1D5DB' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                            {d.coeficiente != null ? `${d.coeficiente}%` : <span style={{ color: '#D1D5DB' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }} align="right">
                          <Tooltip title="Copiar link de consulta de deuda">
                            <IconButton size="small" onClick={() => handleCopiarLink(d)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <ContentCopyIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={d.email ? 'Reenviar link por email' : 'Cargá un email para poder enviar el link'}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleReenviarEmail(d)}
                                disabled={!d.email || reenviandoId === d.id}
                                sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}
                              >
                                {reenviandoId === d.id ? <CircularProgress size={15} /> : <ForwardToInboxIcon sx={{ fontSize: 15 }} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEditDepto(d)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : tab === 2 ? (
        <>
          {/* Toolbar: contador */}
          <Box display="flex" alignItems="center" justifyContent="flex-end" mb={2}>
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {periodos.length} período{periodos.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Tabla períodos */}
          <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    {['Período', 'Total gastos', 'Estado', ''].map(h => (
                      <TableCell
                        key={h}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {periodos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                        <ReceiptLongIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                          No hay períodos registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    periodos.map(p => {
                      const abierto = p.estado === 'abierto'
                      const total = calcTotalGastos(p.gastos)
                      return (
                        <TableRow
                          key={p.id}
                          onClick={() => openPeriodoDrawer(p)}
                          sx={{
                            cursor: 'pointer',
                            '&:last-child td': { border: 0 },
                            '& td': { borderBottom: '1px solid #F3F4F6' },
                            '&:hover': { bgcolor: '#F9FAFB' },
                          }}
                        >
                          <TableCell sx={{ py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                              {MESES_LABEL[p.mes - 1]} {p.anio}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <Typography sx={{ fontSize: '0.82rem', color: total > 0 ? '#111827' : '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>
                              {total > 0 ? fmt(total) : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <Chip
                              label={abierto ? 'Abierto' : 'Cerrado'}
                              size="small"
                              sx={{
                                height: 22, fontSize: '0.68rem', fontWeight: 700, border: 'none',
                                bgcolor: abierto ? ACCENT_LIGHT : '#F1F5F9',
                                color: abierto ? ACCENT : '#94A3B8',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }} align="right">
                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                              {abierto && (
                                <Tooltip title="Cerrar período">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); setClosePeriodoError(null); setConfirmClosePeriodoItem(p) }}
                                    sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}
                                  >
                                    <LockOutlinedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <ArrowForwardIosIcon sx={{ fontSize: 12, color: '#D1D5DB' }} />
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : (
        <>
          {/* Tasa de mora */}
          <Box
            display="flex"
            alignItems="center"
            gap={1.5}
            mb={3}
            sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: 2 }}
          >
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
              Tasa de mora mensual
            </Typography>
            <TextField
              size="small"
              type="number"
              value={tasaMora}
              onChange={e => setTasaMora(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              placeholder="0.00"
              sx={{ width: 120, ...fieldSx }}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
            />
            <Button
              variant="outlined"
              onClick={handleGuardarTasaMora}
              disabled={savingTasaMora}
              startIcon={savingTasaMora ? <CircularProgress size={14} /> : null}
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                fontSize: '0.8rem', borderColor: '#E5E7EB', color: '#374151',
                '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT },
              }}
            >
              {savingTasaMora ? 'Guardando...' : 'Guardar'}
            </Button>
            {tasaMoraError && (
              <Typography sx={{ fontSize: '0.78rem', color: '#DC2626' }}>{tasaMoraError}</Typography>
            )}
          </Box>

          {/* Tabla liquidaciones */}
          <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    {['Unidad', 'Propietario', 'Inquilino', 'Saldo último período', 'Saldo en mora', 'Interés mora', 'Saldo total', ''].map(h => (
                      <TableCell
                        key={h}
                        align={h === 'Unidad' || h === 'Propietario' || h === 'Inquilino' || h === '' ? 'left' : 'right'}
                        sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liquidaciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                        <ReceiptLongIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                          No hay departamentos para liquidar.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    liquidaciones.map(l => (
                      <TableRow
                        key={l.departamento_id}
                        sx={{
                          '&:last-child td': { border: 0 },
                          '& td': { borderBottom: '1px solid #F3F4F6' },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={l.numeracion}
                            size="small"
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#111827' }}>
                            {l.propietario || <span style={{ color: '#D1D5DB' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                            {l.inquilino || <span style={{ color: '#D1D5DB' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: l.saldoUltimo > 0 ? '#111827' : '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>
                            {l.saldoUltimo > 0 ? fmt(l.saldoUltimo) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: l.saldoMora > 0 ? '#B45309' : '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>
                            {l.saldoMora > 0 ? fmt(l.saldoMora) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: l.interesMora > 0 ? '#B45309' : '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>
                            {l.interesMora > 0 ? fmt(l.interesMora) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: l.saldoTotal > 0 ? '#DC2626' : '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>
                            {l.saldoTotal > 0 ? fmt(l.saldoTotal) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }} align="right">
                          <Tooltip title="Ver pagos">
                            <IconButton
                              size="small"
                              onClick={() => openPagosDialog({ id: l.departamento_id, numeracion: l.numeracion, propietario: l.propietario })}
                              sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}
                            >
                              <PaymentsIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* ── Drawer Nuevo / Editar Propietario ── */}
      <Drawer
        anchor="right"
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              {editingPropId ? 'Editar Propietario' : 'Nuevo Propietario'}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          {[
            { label: 'DNI', name: 'dni', placeholder: 'Ej: 30123456' },
            { label: 'Nombre', name: 'nombre', placeholder: 'Ej: Juan' },
            { label: 'Apellido', name: 'apellido', placeholder: 'Ej: García' },
          ].map(({ label, name, placeholder }) => (
            <Box key={name} mb={2}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>{label}</Typography>
              <TextField
                fullWidth
                name={name}
                value={form[name]}
                onChange={handleChange}
                required
                autoFocus={name === 'dni'}
                placeholder={placeholder}
                size="small"
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
          ))}
          <Box mt={3} display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {saving ? 'Guardando...' : editingPropId ? 'Guardar cambios' : 'Crear propietario'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setNuevoOpen(false)}
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

      {/* ── Drawer Importación Excel ── */}
      <Drawer
        anchor="right"
        open={importOpen}
        onClose={closeImport}
        slotProps={{ paper: { sx: { width: 620, p: 3, bgcolor: 'white', overflowY: 'auto' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Importar desde Excel</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={closeImport}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {importError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{importError}</Alert>}

        {/* Paso 1 */}
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
          1. Descargá la plantilla y completá los datos
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          onClick={downloadEjemplo}
          size="small"
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
            borderColor: '#E5E7EB', color: '#374151', mb: 0.75,
            '&:hover': { borderColor: ACCENT, color: ACCENT },
          }}
        >
          Descargar archivo de ejemplo
        </Button>
        <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mb: 3 }}>
          Columnas requeridas: <strong>Unidad</strong>, <strong>Propietario</strong> (Apellido Nombre), <strong>DNI</strong>
        </Typography>

        {/* Paso 2 */}
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
          2. Subí el archivo completado
        </Typography>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
          size="small"
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
            borderColor: '#E5E7EB', color: '#374151', mb: 3,
            '&:hover': { borderColor: ACCENT, color: ACCENT },
          }}
        >
          Seleccionar archivo Excel
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
        </Button>

        {/* Preview */}
        {preview.length > 0 && resultados.length === 0 && (
          <>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
              Vista previa — {preview.length} {preview.length === 1 ? 'registro' : 'registros'}
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden', mb: 3 }}>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                      {['Unidad', 'Propietario', 'DNI'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#F9FAFB' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((f, i) => (
                      <TableRow key={i} sx={{ '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                        <TableCell>
                          <Chip label={f.unidad || '—'} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{f.propietario || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{f.dni || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {importing && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

            <Button
              variant="contained"
              onClick={handleImportar}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {importing ? 'Importando...' : `Confirmar importación (${preview.length} registros)`}
            </Button>
          </>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <>
            <Box display="flex" gap={1.5} mb={2}>
              <Chip icon={<CheckCircleIcon />} label={`${exitosos} importados`} color="success" size="small" />
              {fallidos > 0 && <Chip icon={<ErrorIcon />} label={`${fallidos} con error`} color="error" size="small" />}
            </Box>
            <Paper variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Unidad', 'Propietario', 'DNI', 'Estado'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#F9FAFB' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resultados.map((r, i) => (
                      <TableRow key={i} sx={{ '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                        <TableCell><Chip label={r.unidad || '—'} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }} /></TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{r.propietario}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{r.dni}</TableCell>
                        <TableCell align="center">
                          {r.ok
                            ? <Chip label={r.deptoCreado ? 'Importado (depto creado)' : r.vinculado ? 'Importado y vinculado' : 'Importado'} size="small" color="success" />
                            : <Chip label="Error" size="small" color="error" title={r.error} />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            <Button
              variant="outlined"
              onClick={closeImport}
              sx={{
                mt: 2, borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
              }}
            >
              Cerrar
            </Button>
          </>
        )}
      </Drawer>

      {/* ── Drawer Nuevo / Editar Departamento ── */}
      <Drawer
        anchor="right"
        open={nuevoDeptoOpen}
        onClose={() => setNuevoDeptoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              {editingDeptoId ? 'Editar Departamento' : 'Nuevo Departamento'}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoDeptoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {deptoFormError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{deptoFormError}</Alert>}

        <form onSubmit={handleSubmitDepto}>
          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Unidad</Typography>
            <TextField
              fullWidth
              name="numeracion"
              value={deptoForm.numeracion}
              onChange={handleChangeDepto}
              required
              autoFocus
              placeholder="Ej: 1A, 2B, PB..."
              size="small"
              sx={fieldSx}
            />
          </Box>

          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Propietario</Typography>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select
                name="id_propietario"
                value={deptoForm.id_propietario}
                onChange={handleChangeDepto}
                displayEmpty
              >
                <MenuItem value=""><em>Sin propietario</em></MenuItem>
                {propietarios.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Inquilino</Typography>
            <TextField
              fullWidth
              name="inquilino"
              value={deptoForm.inquilino}
              onChange={handleChangeDepto}
              placeholder="Nombre y apellido (opcional)"
              size="small"
              sx={fieldSx}
            />
          </Box>

          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Mail</Typography>
            <TextField
              fullWidth
              name="email"
              type="email"
              value={deptoForm.email}
              onChange={handleChangeDepto}
              placeholder="Ej: unidad@mail.com (opcional)"
              size="small"
              sx={fieldSx}
            />
          </Box>

          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Coeficiente (%)</Typography>
            <TextField
              fullWidth
              name="coeficiente"
              type="number"
              value={deptoForm.coeficiente}
              onChange={handleChangeDepto}
              placeholder="Ej: 3.1250"
              size="small"
              inputProps={{ min: 0, max: 100, step: '0.0001' }}
              sx={fieldSx}
            />
          </Box>

          <Box mt={3} display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={savingDepto}
              startIcon={savingDepto ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {savingDepto ? 'Guardando...' : editingDeptoId ? 'Guardar cambios' : 'Crear departamento'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setNuevoDeptoOpen(false)}
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

      {/* ── Drawer Nuevo Período ── */}
      <Drawer
        anchor="right"
        open={nuevoPeriodoOpen}
        onClose={() => setNuevoPeriodoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Nuevo Período</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoPeriodoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {periodoFormError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{periodoFormError}</Alert>}

        <form onSubmit={handleSubmitPeriodo}>
          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Mes</Typography>
            <FormControl fullWidth size="small" sx={fieldSx}>
              <Select
                value={periodoForm.mes}
                onChange={e => setPeriodoForm(f => ({ ...f, mes: e.target.value }))}
              >
                {MESES_SELECT.map(m => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box mb={2}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Año</Typography>
            <TextField
              fullWidth
              type="number"
              value={periodoForm.anio}
              onChange={e => setPeriodoForm(f => ({ ...f, anio: Number(e.target.value) }))}
              required
              inputProps={{ min: 2020, max: 2099 }}
              size="small"
              sx={fieldSx}
            />
          </Box>

          <Box mb={3}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>Fecha de vencimiento</Typography>
            <TextField
              fullWidth
              type="date"
              value={periodoForm.fecha_vencimiento}
              onChange={e => setPeriodoForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
              required
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={fieldSx}
            />
          </Box>

          <Box display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={creatingPeriodo}
              startIcon={creatingPeriodo ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {creatingPeriodo ? 'Creando...' : 'Crear período'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setNuevoPeriodoOpen(false)}
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
        open={periodoDrawerOpen}
        periodo={selectedPeriodo}
        subtitle={consorcio?.nombre}
        onClose={() => setPeriodoDrawerOpen(false)}
        onGastosChange={syncPeriodoGastos}
        onLiquidacionChange={handleLiquidacionChange}
      />

      {/* ── Confirmar cierre de período ── */}
      <Dialog open={!!confirmClosePeriodoItem} onClose={() => setConfirmClosePeriodoItem(null)}>
        <DialogTitle>Cerrar período</DialogTitle>
        <DialogContent>
          {closePeriodoError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{closePeriodoError}</Alert>}
          <Typography sx={{ fontSize: '0.9rem' }}>
            ¿Estás seguro de que querés cerrar el período{' '}
            {confirmClosePeriodoItem && (
              <strong>{MESES_LABEL[confirmClosePeriodoItem.mes - 1]} {confirmClosePeriodoItem.anio}</strong>
            )}?
            Se va a guardar la liquidación con los gastos actuales y no se van a poder agregar ni modificar gastos después.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClosePeriodoItem(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmClosePeriodo}
            disabled={closingPeriodo}
            startIcon={closingPeriodo ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {closingPeriodo ? 'Cerrando...' : 'Cerrar Período'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Descargar detalle de gastos (elegir período) ── */}
      <Dialog open={descargarGastosOpen} onClose={closeDescargarGastos} maxWidth="xs" fullWidth>
        <DialogTitle>Descargar detalle de gastos</DialogTitle>
        <DialogContent>
          {descargarGastosError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{descargarGastosError}</Alert>}
          <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', mb: 2 }}>
            Elegí el período para generar el PDF con el detalle de gastos ordinarios y extraordinarios.
          </Typography>
          <FormControl fullWidth size="small" sx={fieldSx}>
            <Select
              value={descargarGastosPeriodoId}
              onChange={e => setDescargarGastosPeriodoId(e.target.value)}
              displayEmpty
            >
              <MenuItem value="" disabled>Seleccionar período</MenuItem>
              {periodos.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  {MESES_LABEL[p.mes - 1]} {p.anio} — {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDescargarGastos}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleDescargarGastosPDF}
            disabled={!descargarGastosPeriodoId || descargandoGastos}
            startIcon={descargandoGastos ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: ACCENT, boxShadow: 'none', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            {descargandoGastos ? 'Generando...' : 'Descargar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Pagos por departamento ── */}
      <PagosDepartamentoDialog
        open={pagosDialogOpen}
        departamento={pagosDialogDepto}
        periodos={liquidacionesData.periodos}
        expensas={liquidacionesData.expensas}
        onClose={closePagosDialog}
        onPagoChange={handleLiquidacionChange}
      />

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message={editingPropId ? 'Propietario actualizado exitosamente' : 'Propietario creado exitosamente'}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Snackbar
        open={successDepto}
        autoHideDuration={3000}
        onClose={() => setSuccessDepto(false)}
        message={editingDeptoId ? 'Departamento actualizado exitosamente' : 'Departamento creado exitosamente'}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Snackbar
        open={!!linkSnack}
        autoHideDuration={3000}
        onClose={() => setLinkSnack('')}
        message={linkSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
