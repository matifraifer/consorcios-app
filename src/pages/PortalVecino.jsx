import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, TextField, Button, Alert, CircularProgress, Divider, Checkbox,
  useMediaQuery, IconButton, Dialog, DialogContent, Collapse,
} from '@mui/material'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import QuestionMarkIcon from '@mui/icons-material/QuestionMark'
import CloseIcon from '@mui/icons-material/Close'
import { crearPreferenciaPago } from '../features/integraciones/services/mercadopago'
import { getPortalAlquilerDni, getPortalAlquilerToken, getPortalDniExiste, getPortalExpensasDni, getPortalExpensasToken, logPortalError } from '../features/portal/services/portal'
import { getClientePublico } from '../features/propiedades/services/propiedades'
import { calcularSaldosMora } from '../shared/utils/calcularSaldosMora'
import { computeMontoActualizado } from '../utils/actualizacionContrato'
import { generarReciboContrato } from '../services/reciboContrato'
import PortalErrorBoundary from '../shared/components/PortalErrorBoundary'

const MS_POR_DIA = 1000 * 60 * 60 * 24

// Comisión fija de Mercado Pago, usada solo para estimar en pantalla la
// tarifa de servicio; el monto real que se cobra siempre lo recalcula
// mp-crear-preferencia server-side con la misma fórmula.
const MP_COMISION_PCT = 6.19

// Estimación de mora por período para mostrar en la UI antes de pagar; el
// monto real que se cobra siempre lo recalcula mp-crear-preferencia server-side.
function montoConMora(saldo, fechaVencimiento, tasaMora) {
  if (!fechaVencimiento) return saldo
  const diasAtraso = (new Date() - new Date(fechaVencimiento)) / MS_POR_DIA
  const mesesAtraso = Math.floor(diasAtraso / 30)
  if (mesesAtraso <= 0) return saldo
  return saldo + saldo * (Number(tasaMora || 0) / 100) * mesesAtraso
}

// Recarga la deuda para que, después de que Mercado Pago descuente su propia
// comisión, al consorcio le llegue el 100% de montoDeuda y a la plataforma
// le llegue comisionPlataformaFee completo.
function calcularTarifaServicio(montoDeuda, comisionPlataformaFee) {
  const fee = Number(comisionPlataformaFee || 0)
  if (fee <= 0 || montoDeuda <= 0) return { tarifaServicio: 0, montoTotal: montoDeuda }
  const montoTotal = (montoDeuda + fee) / (1 - MP_COMISION_PCT / 100)
  return { tarifaServicio: montoTotal - montoDeuda, montoTotal }
}

const PAGO_BANNER = {
  success: { severity: 'success', text: 'Pago aprobado. El estado de tu deuda se actualiza en unos segundos — volvé a consultar para verlo reflejado.' },
  pending: { severity: 'warning', text: 'Tu pago quedó pendiente de aprobación en Mercado Pago.' },
  failure: { severity: 'error', text: 'El pago no pudo procesarse. Podés intentarlo de nuevo.' },
}

// Tokens del design system "Consorcios Design System v1.0": naranja
// protagonista (CTA, precios, foco) + verde bosque de estructura, radios
// 12/16px, bordes/sombras siempre tintados de verde (nunca gris/negro puro).
const ORANGE = '#fb3c00'
const ORANGE_HOVER = '#e53500'
const GREEN_900 = '#142B21'
const GREEN_BG = '#f7faf9'
const BORDER = 'rgba(20,43,33,0.10)'
const BORDER_STRONG = 'rgba(20,43,33,0.16)'
const TEXT_MUTED = 'rgba(20,43,33,0.52)'
const SURFACE_SUNKEN = 'rgba(20,43,33,0.04)'
const SUCCESS = '#047857'
const WARNING_TEXT = '#92400e'
const WARNING_BG = 'rgba(146,64,14,0.06)'
const WARNING_BORDER = 'rgba(146,64,14,0.22)'
const RING_ACCENT = '0 0 0 3px rgba(251,60,0,0.10)'
const SHADOW_MD = '0 4px 16px rgba(20,43,33,0.09), 0 2px 4px rgba(20,43,33,0.05)'
const SHADOW_ACCENT = '0 2px 10px rgba(251,60,0,0.28)'
const SHADOW_ACCENT_HOVER = '0 4px 18px rgba(251,60,0,0.36)'

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const NAV_ITEMS = [
  { key: 'expensas', label: 'Expensas', Icon: HomeWorkOutlinedIcon },
  { key: 'alquiler', label: 'Alquiler', Icon: KeyOutlinedIcon },
]

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px', fontSize: '0.875rem',
    '& fieldset': { borderColor: BORDER_STRONG, borderWidth: '1.5px' },
    '&:hover fieldset': { borderColor: BORDER_STRONG },
    '&.Mui-focused fieldset': { borderColor: ORANGE, borderWidth: '1.5px' },
    '&.Mui-focused': { boxShadow: RING_ACCENT, borderRadius: '12px' },
  },
  '& .MuiInputLabel-root': { fontSize: '0.75rem', fontWeight: 600, color: GREEN_900 },
  '& .MuiInputLabel-root.Mui-focused': { color: ORANGE },
}

const primaryButtonSx = {
  bgcolor: ORANGE, borderRadius: '16px', textTransform: 'none',
  fontWeight: 600, py: 1.15, boxShadow: SHADOW_ACCENT,
  '&:hover': { bgcolor: ORANGE_HOVER, boxShadow: SHADOW_ACCENT_HOVER },
  '&.Mui-disabled': { bgcolor: 'rgba(251,60,0,0.4)', color: 'rgba(255,255,255,0.8)' },
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// El vencimiento de una cuota no se guarda: se arma con el mes del período
// (periodo_inicio) + el día de vencimiento configurado en el contrato.
function fechaVencimientoCuota(periodoInicio, diaVencimiento) {
  if (!periodoInicio) return null
  const [y, m] = periodoInicio.split('-').map(Number)
  const ultimoDiaMes = new Date(y, m, 0).getDate()
  const dia = Math.min(Number(diaVencimiento || ultimoDiaMes), ultimoDiaMes)
  return new Date(y, m - 1, dia)
}

function fmtFechaObj(date) {
  if (!date) return '—'
  return date.toLocaleDateString('es-AR')
}

function AyudaSeccion({ titulo, children }) {
  return (
    <Box mb={2} sx={{ '&:last-of-type': { mb: 0 } }}>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: ORANGE, mb: 0.4 }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', color: GREEN_900, lineHeight: 1.55 }}>
        {children}
      </Typography>
    </Box>
  )
}

function AyudaModal({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: GREEN_900 }}>
            ¿Qué es el portal del vecino?
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseIcon sx={{ fontSize: 18, color: TEXT_MUTED }} />
          </IconButton>
        </Box>

        <Typography sx={{ fontSize: '0.85rem', color: GREEN_900, lineHeight: 1.55, mb: 2.5 }}>
          Estás en el portal del vecino de Granito. Si tu consorcio o inmobiliaria utiliza Granito,
          vas a poder visualizar los pagos de tus alquileres, expensas y avisos importantes del consorcio.
        </Typography>

        <AyudaSeccion titulo="Alquileres">
          En esta sección vas a encontrar los pagos pendientes de tu alquiler y los pagos realizados,
          y vas a poder descargar los recibos correspondientes una vez que tu inmobiliaria haya marcado
          como pagada la cuota del mes.
        </AyudaSeccion>

        <AyudaSeccion titulo="Expensas">
          Vas a poder visualizar las expensas de tu consorcio, condominio o barrio, con el detalle de
          gastos para cada mes y su respectivo recibo. En caso de que la administración de tu barrio o
          consorcio lo desee, vas a poder pagar a través de Mercado Pago o con transferencia.
        </AyudaSeccion>

        <AyudaSeccion titulo="Avisos">
          En esta sección vas a encontrar publicados avisos relevantes sobre tu barrio, consorcio o condominio.
        </AyudaSeccion>

        <Divider sx={{ my: 2, borderColor: BORDER_STRONG }} />

        <Typography sx={{ fontSize: '0.8rem', color: TEXT_MUTED }}>
          Para saber más de Granito visitá{' '}
          <Box component="a" href="https://www.granito.com.ar" target="_blank" rel="noopener noreferrer"
            sx={{ color: ORANGE, fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            www.granito.com.ar
          </Box>
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

function Header() {
  const [ayudaOpen, setAyudaOpen] = useState(false)
  return (
    <Box sx={{
      bgcolor: GREEN_900, position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `2px solid ${ORANGE}`, overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: -70, right: -40, width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,60,0,0.18) 0%, transparent 65%)', pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'relative', px: { xs: 2, md: 4 }, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box component="img" src="/logo.svg" alt="Granito" sx={{ height: 26, width: 26, objectFit: 'contain', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#E2F0E8', letterSpacing: '-0.01em' }}>
            granito
          </Typography>
        </Box>
        <IconButton
          onClick={() => setAyudaOpen(true)} aria-label="Ayuda"
          sx={{
            width: 36, height: 36, border: '2.5px solid #ffffff',
            color: '#E2F0E8', '&:hover': { bgcolor: 'rgba(226,240,232,0.1)' },
          }}
        >
          <QuestionMarkIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <AyudaModal open={ayudaOpen} onClose={() => setAyudaOpen(false)} />
    </Box>
  )
}

function EstadoPill({ children, tone = 'warning' }) {
  const tones = {
    warning: { color: WARNING_TEXT, bg: WARNING_BG, border: WARNING_BORDER, dot: '#d97706' },
    success: { color: SUCCESS, bg: 'rgba(4,120,87,0.07)', border: 'rgba(4,120,87,0.25)', dot: SUCCESS },
  }
  const t = tones[tone]
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.35,
      borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 600,
      border: `1.5px solid ${t.border}`, color: t.color, bgcolor: t.bg,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: t.dot, flexShrink: 0 }} />
      {children}
    </Box>
  )
}

function DesgloseTarifa({ montoDeuda, tarifaServicio, montoTotal }) {
  return (
    <Box sx={{ bgcolor: SURFACE_SUNKEN, border: `1px solid ${BORDER}`, borderRadius: '12px', p: 1.75, mb: 1.5 }}>
      <SaldoRow label="Monto de la expensa" value={montoDeuda} />
      {tarifaServicio > 0 && <SaldoRow label="Tarifa por servicio" value={tarifaServicio} />}
      <Divider sx={{ my: 1, borderColor: BORDER_STRONG }} />
      <SaldoRow label="Total a pagar" value={montoTotal} destacado />
    </Box>
  )
}

function SaldoRow({ label, value, destacado }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" py={0.75}>
      <Typography sx={{ fontSize: destacado ? '0.9rem' : '0.82rem', color: destacado ? GREEN_900 : TEXT_MUTED, fontWeight: destacado ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: destacado ? '1.1rem' : '0.88rem',
        fontWeight: destacado ? 800 : 600,
        color: value > 0 ? ORANGE : 'rgba(20,43,33,0.3)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value > 0 ? fmt(value) : '—'}
      </Typography>
    </Box>
  )
}

function GastosGrupo({ titulo, gastos }) {
  if (gastos.length === 0) return null
  const subtotal = gastos.reduce((acc, g) => acc + Number(g.monto ?? 0), 0)
  return (
    <Box sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" py={0.4}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_MUTED }}>
          {titulo}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: GREEN_900, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(subtotal)}
        </Typography>
      </Box>
      {gastos.map((g, i) => (
        <Box key={i} display="flex" justifyContent="space-between" gap={1} py={0.6}
          sx={{ borderBottom: i < gastos.length - 1 ? `1px solid ${BORDER}` : 'none' }}
        >
          <Typography sx={{ fontSize: '0.78rem', color: GREEN_900 }}>{g.nombre}</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: TEXT_MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(g.monto)}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// Arma el objeto de "resultado" de una unidad (igual forma que antes,
// calculando saldos/mora client-side) a partir de lo que devuelve la RPC.
function armarUnidad(data) {
  const [saldo] = calcularSaldosMora(
    [{ id: data.departamento_id, numeracion: data.numeracion, inquilino: data.inquilino, propietarios: null }],
    data.periodos,
    data.expensas,
    data.tasa_mora
  )
  const periodosAdeudados = data.periodos
    .map(periodo => {
      const exp = data.expensas.find(e => e.periodo_id === periodo.id)
      if (!exp || exp.pagado) return null
      const saldoPeriodo = Math.max(0, Number(exp.monto_total ?? 0) - Number(exp.monto_pagado ?? 0))
      if (saldoPeriodo <= 0) return null
      return {
        ...periodo,
        saldo: saldoPeriodo,
        montoConMora: montoConMora(saldoPeriodo, periodo.fecha_vencimiento, data.tasa_mora),
        gastos: (data.gastos ?? []).filter(g => g.periodo_id === periodo.id),
      }
    })
    .filter(Boolean)
  return {
    ...saldo,
    departamentoId: data.departamento_id,
    token: data.token_consulta,
    consorcioNombre: data.consorcio_nombre,
    periodosAdeudados,
    comisionPlataformaFee: data.comision_plataforma_fee,
    permitePagosParciales: data.permite_pagos_parciales !== false,
  }
}

function UnidadCard({ unidad, dni, onPagar }) {
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [pagando, setPagando] = useState(false)
  const [payError, setPayError] = useState(null)

  function togglePeriodo(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const periodosAPagar = unidad.permitePagosParciales
    ? unidad.periodosAdeudados.filter(p => seleccionados.has(p.id))
    : unidad.periodosAdeudados
  const montoDeuda = periodosAPagar.reduce((acc, p) => acc + p.montoConMora, 0)
  const { tarifaServicio, montoTotal } = calcularTarifaServicio(montoDeuda, unidad.comisionPlataformaFee)

  async function handlePagar() {
    setPagando(true)
    setPayError(null)
    try {
      await onPagar(unidad.token, dni, periodosAPagar.map(p => p.id))
    } catch (err) {
      logPortalError('portal_vecino', 'crear_preferencia_pago', err, { departamentoId: unidad.departamentoId, periodos: periodosAPagar.map(p => p.id) })
      setPayError(err.message ?? 'No se pudo iniciar el pago. Intentá de nuevo.')
      setPagando(false)
    }
  }

  if (unidad.periodosAdeudados.length === 0) {
    return (
      <Box>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE, mb: 0.5 }}>
          {unidad.consorcioNombre}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: GREEN_900 }}>
            Unidad {unidad.numeracion}
          </Typography>
          <EstadoPill tone="success">Estás al día</EstadoPill>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE, mb: 0.5 }}>
        {unidad.consorcioNombre}
      </Typography>
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: GREEN_900, mb: 2 }}>
        Unidad {unidad.numeracion}
      </Typography>

      <Box sx={{ bgcolor: SURFACE_SUNKEN, borderRadius: '12px', p: 2, mb: 2 }}>
        <SaldoRow label="Saldo último período" value={unidad.saldoUltimo} />
        <SaldoRow label="Saldo en mora" value={unidad.saldoMora} />
        <SaldoRow label="Interés mora" value={unidad.interesMora} />
        <Divider sx={{ my: 1, borderColor: BORDER_STRONG }} />
        <SaldoRow label="Saldo total" value={unidad.saldoTotal} destacado />
      </Box>

      <Box sx={{ mb: 1 }}>
        {unidad.periodosAdeudados.map((periodo, i) => (
          <PeriodoAdeudadoRow
            key={periodo.id} periodo={periodo}
            checked={seleccionados.has(periodo.id)} onToggle={() => togglePeriodo(periodo.id)}
            mostrarCheckbox={unidad.permitePagosParciales}
            last={i === unidad.periodosAdeudados.length - 1}
          />
        ))}

        {payError && <Alert severity="error" sx={{ mt: 1, mb: 1, borderRadius: '12px', fontSize: '0.82rem' }}>{payError}</Alert>}

        {(!unidad.permitePagosParciales || periodosAPagar.length > 0) && (
          <DesgloseTarifa montoDeuda={montoDeuda} tarifaServicio={tarifaServicio} montoTotal={montoTotal} />
        )}

        <Button
          fullWidth variant="contained"
          disabled={periodosAPagar.length === 0 || pagando}
          startIcon={pagando ? <CircularProgress size={16} color="inherit" /> : null}
          onClick={handlePagar}
          sx={{ ...primaryButtonSx, mt: 1 }}
        >
          {pagando
            ? 'Redirigiendo a Mercado Pago...'
            : periodosAPagar.length === 0
              ? 'Seleccioná uno o más períodos para pagar'
              : unidad.permitePagosParciales
                ? `Pagar seleccionados (${fmt(montoTotal)})`
                : `Pagar total (${fmt(montoTotal)})`}
        </Button>
      </Box>
    </Box>
  )
}

function PeriodoAdeudadoRow({ periodo, checked, onToggle, mostrarCheckbox, last }) {
  const [expanded, setExpanded] = useState(false)
  const hayGastos = periodo.gastos.length > 0

  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${BORDER}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.1 }}>
        <Box display="flex" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
          {mostrarCheckbox && (
            <Checkbox
              size="small"
              checked={checked}
              onChange={onToggle}
              sx={{ color: BORDER_STRONG, '&.Mui-checked': { color: ORANGE }, p: 0.5, flexShrink: 0 }}
            />
          )}
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: GREEN_900, pl: mostrarCheckbox ? 0 : 0.5 }}>
            {MESES_LABEL[periodo.mes - 1]} {periodo.anio}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(periodo.montoConMora)}
          </Typography>
          {hayGastos && (
            <IconButton size="small" onClick={() => setExpanded(e => !e)} sx={{ p: 0.4 }}>
              <ExpandMoreIcon sx={{ fontSize: 18, color: TEXT_MUTED, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.14s' }} />
            </IconButton>
          )}
        </Box>
      </Box>
      {hayGastos && (
        <Collapse in={expanded} timeout={200}>
          <Box sx={{ pb: 1.5 }}>
            <GastosGrupo titulo="Ordinarios" gastos={periodo.gastos.filter(g => g.tipo === 'ordinario')} />
            <GastosGrupo titulo="Extraordinarios" gastos={periodo.gastos.filter(g => g.tipo !== 'ordinario')} />
          </Box>
        </Collapse>
      )}
    </Box>
  )
}

function ExpensasSection({ unidades, dni, onPagar }) {
  return unidades.map((unidad, i) => (
    <Box key={unidad.departamentoId} sx={{ mb: i === unidades.length - 1 ? 0 : 3, pb: i === unidades.length - 1 ? 0 : 3, borderBottom: i === unidades.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
      <UnidadCard unidad={unidad} dni={dni} onPagar={onPagar} />
    </Box>
  ))
}

function DetalleCuota({ pago, montoActualizado }) {
  const actualizacion = pago.es_periodo_actualizacion ? montoActualizado - Number(pago.monto_base) : 0
  const cargos = pago.cargos_extra ?? []
  const total = montoActualizado + cargos.reduce((acc, c) => acc + Number(c.monto), 0)
  return (
    <Box sx={{ bgcolor: SURFACE_SUNKEN, borderRadius: '12px', p: 1.75, mt: 1 }}>
      <SaldoRow label="Monto base" value={Number(pago.monto_base)} />
      {actualizacion !== 0 && <SaldoRow label="Actualización" value={actualizacion} />}
      {cargos.map((c, i) => (
        <SaldoRow key={i} label={c.descripcion} value={Number(c.monto)} />
      ))}
      <Divider sx={{ my: 1, borderColor: BORDER_STRONG }} />
      <SaldoRow label="Total" value={total} destacado />
    </Box>
  )
}

function ProximoPagoItem({ pago, indices, contrato }) {
  const [expanded, setExpanded] = useState(false)
  const montoActualizado = computeMontoActualizado(pago, contrato.pagos, indices, contrato.tipo_actualizacion, contrato.plazo_actualizacion)
  const cargosTotal = (pago.cargos_extra ?? []).reduce((acc, c) => acc + Number(c.monto), 0)
  const total = montoActualizado + cargosTotal
  const vencimiento = fechaVencimientoCuota(pago.periodo_inicio, contrato.dia_vencimiento)

  return (
    <Box sx={{ borderBottom: `1px solid ${BORDER}` }}>
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.1, cursor: 'pointer' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: GREEN_900 }}>
            {MESES_LABEL[Number(pago.periodo_inicio.split('-')[1]) - 1]} {pago.periodo_inicio.split('-')[0]}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: TEXT_MUTED, mt: 0.25 }}>
            Vence el {fmtFechaObj(vencimiento)}
            {pago.es_periodo_actualizacion && ' · con actualización'}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={0.25} flexShrink={0}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(total)}
          </Typography>
          <ExpandMoreIcon sx={{ fontSize: 18, color: TEXT_MUTED, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.14s' }} />
        </Box>
      </Box>
      <Collapse in={expanded} timeout={200}>
        <Box sx={{ pb: 1.5 }}>
          <DetalleCuota pago={pago} montoActualizado={montoActualizado} />
        </Box>
      </Collapse>
    </Box>
  )
}

function PagoRealizadoItem({ pago, contrato, clienteConfig, onError, last }) {
  const [descargando, setDescargando] = useState(false)

  async function handleDescargar() {
    if (!pago.recibo) return
    setDescargando(true)
    try {
      await generarReciboContrato({
        recibo: pago.recibo,
        contrato: { ...contrato, propiedades: contrato.propiedad },
        pago,
        cargosExtra: pago.cargos_extra ?? [],
        clienteConfig,
      })
    } catch (err) {
      logPortalError('portal_vecino', 'descargar_recibo', err, { pagoId: pago.id, contratoId: contrato.contrato_id })
      onError('No se pudo generar el recibo. Intentá de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
      py: 1.1, borderBottom: last ? 'none' : `1px solid ${BORDER}`,
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: GREEN_900 }}>
          {MESES_LABEL[Number(pago.periodo_inicio.split('-')[1]) - 1]} {pago.periodo_inicio.split('-')[0]}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: TEXT_MUTED, mt: 0.25 }}>
          Pagado el {fmtFecha(pago.fecha_pago)}
        </Typography>
      </Box>
      <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} flexShrink={0}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: GREEN_900, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(pago.monto_pagado)}
        </Typography>
        {pago.recibo && (
          <Button
            size="small" onClick={handleDescargar} disabled={descargando}
            startIcon={descargando ? <CircularProgress size={12} color="inherit" /> : <DownloadOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: 'none', fontSize: '0.68rem', fontWeight: 600, borderRadius: '8px',
              color: GREEN_900, border: `1.5px solid ${BORDER_STRONG}`, px: 1, py: 0.25, minWidth: 0,
              '&:hover': { borderColor: GREEN_900, bgcolor: SURFACE_SUNKEN },
            }}
          >
            Recibo
          </Button>
        )}
      </Box>
    </Box>
  )
}

function ContratoCard({ contrato, indices, clienteConfig, onError }) {
  const [verPagados, setVerPagados] = useState(false)
  const pendientes = contrato.pagos.filter(p => p.estado === 'pendiente').sort((a, b) => a.periodo_numero - b.periodo_numero)
  const pagados = contrato.pagos.filter(p => p.estado === 'pagado').sort((a, b) => b.periodo_numero - a.periodo_numero)

  return (
    <Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE, mb: 0.5 }}>
        {contrato.es_compraventa ? 'Compraventa' : 'Alquiler'}
      </Typography>
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: GREEN_900, mb: 2 }}>
        {contrato.propiedad?.direccion || contrato.propiedad?.titulo || 'Contrato'}
      </Typography>

      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_MUTED, mb: 0.5 }}>
        Próximos pagos
      </Typography>
      {pendientes.length === 0 ? (
        <Typography sx={{ fontSize: '0.82rem', color: TEXT_MUTED, mb: 2 }}>No tenés cuotas pendientes en este contrato.</Typography>
      ) : (
        <Box sx={{ mb: 2.5 }}>
          {pendientes.map(pago => (
            <ProximoPagoItem key={pago.id} pago={pago} indices={indices} contrato={contrato} />
          ))}
        </Box>
      )}

      <Box
        onClick={() => setVerPagados(v => !v)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', py: 0.5 }}
      >
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: TEXT_MUTED }}>
          Pagos realizados {pagados.length > 0 && `(${pagados.length})`}
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 18, color: TEXT_MUTED, transform: verPagados ? 'rotate(180deg)' : 'none', transition: 'transform 0.14s' }} />
      </Box>
      <Collapse in={verPagados} timeout={200}>
        <Box sx={{ mt: 0.5 }}>
          {pagados.length === 0 ? (
            <Typography sx={{ fontSize: '0.82rem', color: TEXT_MUTED, py: 1 }}>Todavía no registramos pagos de este contrato.</Typography>
          ) : (
            pagados.map((pago, i) => (
              <PagoRealizadoItem key={pago.id} pago={pago} contrato={contrato} clienteConfig={clienteConfig} onError={onError} last={i === pagados.length - 1} />
            ))
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

function AlquilerSection({ contratos, indices, clienteConfig, onError }) {
  return contratos.map((contrato, i) => (
    <Box key={contrato.contrato_id} sx={{ mb: i === contratos.length - 1 ? 0 : 3, pb: i === contratos.length - 1 ? 0 : 3, borderBottom: i === contratos.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
      <ContratoCard contrato={contrato} indices={indices} clienteConfig={clienteConfig} onError={onError} />
    </Box>
  ))
}

function NavSidebar({ activeTab, onChange, visibleKeys }) {
  const items = NAV_ITEMS.filter(item => visibleKeys.includes(item.key))
  return (
    <Box sx={{ width: 180, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
      {items.map(item => {
        const active = activeTab === item.key
        return (
          <Box
            key={item.key}
            onClick={() => onChange(item.key)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.1, mb: 0.5,
              borderRadius: '12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 700 : 500,
              color: active ? ORANGE : TEXT_MUTED, bgcolor: active ? 'rgba(251,60,0,0.08)' : 'transparent',
              '&:hover': { bgcolor: active ? 'rgba(251,60,0,0.08)' : SURFACE_SUNKEN },
            }}
          >
            <item.Icon sx={{ fontSize: 19 }} />
            {item.label}
          </Box>
        )
      })}
    </Box>
  )
}

function NavTabsMobile({ activeTab, onChange, visibleKeys }) {
  const items = NAV_ITEMS.filter(item => visibleKeys.includes(item.key))
  return (
    <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1, mb: 2.5 }}>
      {items.map(item => {
        const active = activeTab === item.key
        return (
          <Box
            key={item.key}
            onClick={() => onChange(item.key)}
            sx={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
              py: 1, borderRadius: '12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 700 : 500,
              color: active ? '#fff' : GREEN_900, bgcolor: active ? GREEN_900 : SURFACE_SUNKEN,
            }}
          >
            <item.Icon sx={{ fontSize: 17 }} />
            {item.label}
          </Box>
        )
      })}
    </Box>
  )
}

const TAB_EMPTY = { expensas: null, alquiler: null }

export default function PortalVecino() {
  return (
    <PortalErrorBoundary ruta="portal_vecino">
      <PortalVecinoInner />
    </PortalErrorBoundary>
  )
}

function PortalVecinoInner() {
  const { token, clienteId } = useParams()
  const [searchParams] = useSearchParams()
  const pagoBanner = PAGO_BANNER[searchParams.get('pago')] ?? null
  const isDesktop = useMediaQuery('(min-width:600px)')

  const [dni, setDni] = useState('')
  const [dniConsulta, setDniConsulta] = useState('')
  const [cliente, setCliente] = useState(null)
  const [clienteLoading, setClienteLoading] = useState(!!clienteId)
  const [clienteError, setClienteError] = useState(null)
  const [clienteNombreToken, setClienteNombreToken] = useState(null)
  const nombreCliente = cliente?.nombre ?? clienteNombreToken

  // "login": ambos flujos (token o DNI directo) piden el DNI antes de
  // mostrar nada — con token, la RPC además valida que el DNI corresponda a
  // esa unidad y de paso trae la pestaña Expensas. Para el flujo por DNI
  // directo, solo confirma si hay algo asociado — los datos de cada pestaña
  // se piden recién cuando se abre esa pestaña.
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [tabsDisponibles, setTabsDisponibles] = useState({ expensas: false, alquiler: false })

  const [activeTab, setActiveTab] = useState('expensas')
  const [tabData, setTabData] = useState(TAB_EMPTY)
  const [tabLoading, setTabLoading] = useState({ expensas: false, alquiler: false })
  const [tabError, setTabError] = useState({ expensas: null, alquiler: null })

  // clienteId puede venir como UUID o como slug (extension); se resuelve
  // acá una sola vez, igual que InmobiliariaPublica.jsx.
  useEffect(() => {
    if (!clienteId) return
    setClienteLoading(true)
    getClientePublico(clienteId.trim())
      .then(data => {
        if (!data) {
          logPortalError('portal_vecino', 'cliente_no_encontrado', new Error('getClientePublico devolvió null'), { clienteId })
          setClienteError('No encontramos esta inmobiliaria.')
          return
        }
        setCliente(data)
      })
      .catch(err => {
        logPortalError('portal_vecino', 'get_cliente_publico', err, { clienteId })
        setClienteError('Ocurrió un error al cargar la página. Intentá de nuevo.')
      })
      .finally(() => setClienteLoading(false))
  }, [clienteId])

  // Carga por demanda: pide los datos de una pestaña recién la primera vez
  // que se abre (token o DNI ya validados), y los cachea en tabData.
  async function fetchTab(tabKey) {
    if (tabData[tabKey] || tabLoading[tabKey]) return
    setTabLoading(prev => ({ ...prev, [tabKey]: true }))
    setTabError(prev => ({ ...prev, [tabKey]: null }))
    try {
      if (tabKey === 'expensas') {
        const data = token ? await getPortalExpensasToken(token, dniConsulta) : await getPortalExpensasDni(cliente.id, dniConsulta)
        setTabData(prev => ({ ...prev, expensas: { unidades: (data?.unidades ?? []).map(armarUnidad) } }))
      } else {
        const data = token ? await getPortalAlquilerToken(token, dniConsulta) : await getPortalAlquilerDni(cliente.id, dniConsulta)
        setTabData(prev => ({ ...prev, alquiler: { contratos: data?.contratos ?? [], indices: data?.indices ?? [], clienteConfig: data?.cliente_config ?? null } }))
      }
    } catch (err) {
      logPortalError('portal_vecino', `fetch_tab_${tabKey}`, err, { token: !!token, clienteId: cliente?.id })
      setTabError(prev => ({ ...prev, [tabKey]: 'Ocurrió un error al consultar. Intentá de nuevo.' }))
    } finally {
      setTabLoading(prev => ({ ...prev, [tabKey]: false }))
    }
  }

  useEffect(() => {
    if (!authenticated) return
    fetchTab(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, activeTab])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!dni.trim()) return
    if (!token && !cliente) return
    setLoginLoading(true)
    setLoginError(null)
    try {
      if (token) {
        const data = await getPortalExpensasToken(token, dni.trim())
        if (!data) {
          setLoginError('No pudimos verificarte con ese DNI. Revisalo e intentá de nuevo.')
          return
        }
        setDniConsulta(dni.trim())
        setTabData(prev => ({ ...prev, expensas: { unidades: (data.unidades ?? []).map(armarUnidad) } }))
        setClienteNombreToken(data.cliente_config?.nombre ?? null)
        // La unidad del link siempre está presente (garantizado por la RPC),
        // así que Expensas siempre se muestra en el flujo por token.
        setTabsDisponibles({ expensas: true, alquiler: !!data.tiene_contratos })
        setActiveTab('expensas')
        setAuthenticated(true)
      } else {
        const { tiene_unidades: tieneUnidades, tiene_contratos: tieneContratos } = await getPortalDniExiste(cliente.id, dni.trim())
        if (!tieneUnidades && !tieneContratos) {
          setLoginError('No encontramos unidades ni contratos asociados a ese DNI para esta inmobiliaria.')
          return
        }
        setDniConsulta(dni.trim())
        setTabsDisponibles({ expensas: tieneUnidades, alquiler: tieneContratos })
        setActiveTab(tieneUnidades ? 'expensas' : 'alquiler')
        setAuthenticated(true)
      }
    } catch (err) {
      logPortalError('portal_vecino', token ? 'login_token' : 'login_dni', err, { token: !!token, clienteId: cliente?.id })
      setLoginError('Ocurrió un error al consultar. Intentá de nuevo.')
    } finally {
      setLoginLoading(false)
    }
  }

  function handleVolver() {
    setAuthenticated(false)
    setLoginError(null)
    setDni('')
    setDniConsulta('')
    setActiveTab('expensas')
    setTabData(TAB_EMPTY)
    setTabError({ expensas: null, alquiler: null })
    setTabsDisponibles({ expensas: false, alquiler: false })
  }

  async function handlePagar(unidadToken, unidadDni, periodosIds) {
    const data = await crearPreferenciaPago({ token: unidadToken, dni: unidadDni, periodos_ids: periodosIds })
    window.location.href = data.init_point
  }

  function renderTab() {
    const key = activeTab
    if (tabLoading[key] && !tabData[key]) {
      return (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={26} sx={{ color: ORANGE }} />
        </Box>
      )
    }
    if (tabError[key]) {
      return <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.82rem' }}>{tabError[key]}</Alert>
    }
    if (!tabData[key]) return null
    return key === 'expensas'
      ? <ExpensasSection unidades={tabData.expensas.unidades} dni={dniConsulta} onPagar={handlePagar} />
      : <AlquilerSection contratos={tabData.alquiler.contratos} indices={tabData.alquiler.indices} clienteConfig={tabData.alquiler.clienteConfig} onError={msg => setTabError(prev => ({ ...prev, alquiler: msg }))} />
  }

  const hayResultado = authenticated
  const visibleKeys = NAV_ITEMS.filter(item => tabsDisponibles[item.key]).map(item => item.key)
  const mostrarSaludo = !(clienteLoading || (loginLoading && !hayResultado)) && !clienteError

  return (
    <Box minHeight="100vh" bgcolor={GREEN_BG}>
      <Header />

      <Box display="flex" justifyContent="center" px={2} py={{ xs: 4, md: 8 }}>
        <Box sx={{ width: '100%', maxWidth: hayResultado && isDesktop ? 760 : 480 }}>
          {mostrarSaludo && (
            <Box textAlign="center" mb={3}>
              <Typography sx={{
                fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.25,
                background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE} 35%, #ffffff 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                ¡Bienvenido<br />al portal del vecino!
              </Typography>
            </Box>
          )}

          {hayResultado && isDesktop && (
            <Box display="flex" gap={3}>
              {visibleKeys.length > 1 && <NavSidebar activeTab={activeTab} onChange={setActiveTab} visibleKeys={visibleKeys} />}
              <Box sx={{
                flex: 1, minWidth: 0, bgcolor: 'white', borderRadius: '16px',
                border: `1px solid ${BORDER}`, boxShadow: SHADOW_MD, p: 3,
              }}>
                {pagoBanner && <Alert severity={pagoBanner.severity} sx={{ mb: 2, borderRadius: '12px', fontSize: '0.82rem' }}>{pagoBanner.text}</Alert>}
                {renderTab()}
                {!token && (
                  <Button
                    fullWidth onClick={handleVolver}
                    sx={{
                      mt: 1, textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderRadius: '12px',
                      color: TEXT_MUTED, '&:hover': { color: '#dc2626', bgcolor: 'rgba(220,38,38,0.06)' },
                    }}
                  >
                    Salir
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {(!hayResultado || !isDesktop) && (
            <Box sx={{
              width: '100%', bgcolor: hayResultado ? 'transparent' : 'white', borderRadius: '16px',
              border: hayResultado ? 'none' : `1px solid ${BORDER}`,
              boxShadow: hayResultado ? 'none' : SHADOW_MD,
              p: hayResultado ? 0 : { xs: 3, sm: 4 },
            }}>
              {(clienteLoading || (loginLoading && !hayResultado)) ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={28} sx={{ color: ORANGE }} />
                </Box>
              ) : clienteError ? (
                <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '0.82rem' }}>{clienteError}</Alert>
              ) : !hayResultado ? (
                <>
                  {nombreCliente && (
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: GREEN_900, mb: 0.25 }}>
                      Estás ingresando al portal de {nombreCliente}.
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.85rem', color: TEXT_MUTED, mb: 3 }}>
                    Ingresá tu DNI para continuar.
                  </Typography>

                  <Box component="form" onSubmit={handleSubmit}>
                    {pagoBanner && <Alert severity={pagoBanner.severity} sx={{ mb: 2, borderRadius: '12px', fontSize: '0.82rem' }}>{pagoBanner.text}</Alert>}
                    {loginError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px', fontSize: '0.82rem' }}>{loginError}</Alert>}

                    <TextField
                      fullWidth size="small" label="DNI" autoComplete="off"
                      value={dni} onChange={e => setDni(e.target.value)}
                      sx={{ ...fieldSx, mb: 3 }}
                    />

                    <Button
                      type="submit" fullWidth variant="contained"
                      disabled={loginLoading || !dni.trim()}
                      startIcon={loginLoading ? <CircularProgress size={16} color="inherit" /> : null}
                      sx={primaryButtonSx}
                    >
                      {loginLoading ? 'Consultando...' : 'Consultar'}
                    </Button>
                  </Box>
                </>
              ) : (
                <Box sx={{
                  bgcolor: 'white', borderRadius: '16px', border: `1px solid ${BORDER}`,
                  boxShadow: SHADOW_MD, p: { xs: 2.5, sm: 3 },
                }}>
                  {pagoBanner && <Alert severity={pagoBanner.severity} sx={{ mb: 2, borderRadius: '12px', fontSize: '0.82rem' }}>{pagoBanner.text}</Alert>}

                  {visibleKeys.length > 1 && <NavTabsMobile activeTab={activeTab} onChange={setActiveTab} visibleKeys={visibleKeys} />}

                  {renderTab()}

                  {!token && (
                    <Button
                      fullWidth onClick={handleVolver}
                      sx={{
                        mt: 1, textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderRadius: '12px',
                        color: TEXT_MUTED, '&:hover': { color: '#dc2626', bgcolor: 'rgba(220,38,38,0.06)' },
                      }}
                    >
                      Salir
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <Box display="flex" flexDirection="column" alignItems="center" pb={4}>
        <Box component="img" src="/logo.svg" alt="Granito" sx={{ height: 26, width: 26, objectFit: 'contain', mb: 0.5 }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN_900, letterSpacing: '-0.01em' }}>
          granito
        </Typography>
      </Box>
    </Box>
  )
}
