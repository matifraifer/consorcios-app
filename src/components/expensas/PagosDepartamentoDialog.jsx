import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PaymentsIcon from '@mui/icons-material/Payments'
import PaidIcon from '@mui/icons-material/Paid'
import { registrarPago } from '../../services/supabase'

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

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

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Lista los períodos cerrados con liquidación guardada de UN departamento,
// para registrar o anular el pago de cada uno por separado.
export default function PagosDepartamentoDialog({ open, departamento, periodos, expensas, onClose, onPagoChange }) {
  const [payingItem, setPayingItem] = useState(null)
  const [montoInput, setMontoInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const items = (periodos ?? [])
    .map(periodo => {
      const expensa = (expensas ?? []).find(e => e.periodo_id === periodo.id && e.departamento_id === departamento?.id)
      return expensa ? { periodo, expensa } : null
    })
    .filter(Boolean)

  function startPago(item) {
    setPayingItem(item)
    setError(null)
    setMontoInput(
      item.expensa.monto_pagado != null
        ? String(item.expensa.monto_pagado)
        : String(Number(item.expensa.monto_total).toFixed(2))
    )
  }

  function cancelPago() {
    setPayingItem(null)
  }

  async function confirmarPago() {
    if (!montoInput) return
    setSaving(true)
    setError(null)
    try {
      await registrarPago(payingItem.expensa.id, { pagado: true, monto_pagado: Number(montoInput) })
      onPagoChange?.()
      setPayingItem(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function anularPago(item) {
    setSaving(true)
    setError(null)
    try {
      await registrarPago(item.expensa.id, { pagado: false, monto_pagado: null })
      onPagoChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setPayingItem(null)
    setError(null)
    onClose?.()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            Pagos — {departamento && <Chip label={departamento.numeracion} size="small" sx={{ ml: 0.5, height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }} />}
          </Typography>
          {departamento?.propietario && (
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 0.5 }}>{departamento.propietario}</Typography>
          )}
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        {items.length === 0 ? (
          <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', py: 3, textAlign: 'center' }}>
            No hay períodos cerrados con liquidación guardada para este departamento.
          </Typography>
        ) : (
          <TableContainer sx={{ border: '1px solid #E5E7EB', borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                  {['Período', 'Monto', 'Estado', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.25 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(item => {
                  const enPago = payingItem?.expensa.id === item.expensa.id
                  return (
                    <TableRow key={item.periodo.id} sx={{ '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                      {enPago ? (
                        <TableCell colSpan={4} sx={{ py: 1.5 }}>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Typography sx={{ fontSize: '0.78rem', color: '#374151', whiteSpace: 'nowrap' }}>
                              {MESES_LABEL[item.periodo.mes - 1]} {item.periodo.anio}
                            </Typography>
                            <TextField
                              size="small"
                              type="number"
                              value={montoInput}
                              onChange={e => setMontoInput(e.target.value)}
                              autoFocus
                              slotProps={{
                                htmlInput: { min: 0, step: '0.01' },
                                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                              }}
                              sx={{ ...fieldSx, flex: 1 }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={confirmarPago}
                              disabled={saving || !montoInput}
                              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
                              sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
                            >
                              Confirmar
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={cancelPago}
                              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.78rem', borderColor: '#E5E7EB', color: '#6B7280' }}
                            >
                              Cancelar
                            </Button>
                          </Box>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell sx={{ py: 1.25 }}>
                            <Typography sx={{ fontSize: '0.82rem', color: '#111827' }}>
                              {MESES_LABEL[item.periodo.mes - 1]} {item.periodo.anio}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.25 }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(item.expensa.monto_total)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.25 }}>
                            <Chip
                              label={item.expensa.pagado ? 'Pagado' : 'Pendiente'}
                              size="small"
                              sx={{
                                height: 20, fontSize: '0.65rem', fontWeight: 700, border: 'none',
                                bgcolor: item.expensa.pagado ? ACCENT_LIGHT : '#FEF3C7',
                                color: item.expensa.pagado ? ACCENT : '#B45309',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.25 }}>
                            {item.expensa.pagado ? (
                              <IconButton size="small" onClick={() => anularPago(item)} disabled={saving} sx={{ color: '#059669', '&:hover': { color: '#EF4444' } }}>
                                <PaidIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            ) : (
                              <IconButton size="small" onClick={() => startPago(item)} disabled={saving} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                                <PaymentsIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
