import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, TextField, Button, Alert, CircularProgress, Divider } from '@mui/material'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { getConsultaDeuda } from '../services/supabase'
import { calcularSaldosMora } from '../utils/calcularSaldosMora'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const MESES_LABEL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: '1.5px' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
}

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Header() {
  return (
    <Box sx={{
      bgcolor: 'white', borderBottom: '1px solid #E5E7EB',
      px: { xs: 2, md: 4 }, py: 1.5,
      display: 'flex', alignItems: 'center', gap: 1.25,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '7px', bgcolor: ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ReceiptLongIcon sx={{ fontSize: 15, color: 'white' }} />
      </Box>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
        Consulta de deuda
      </Typography>
    </Box>
  )
}

function SaldoRow({ label, value, destacado }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" py={0.75}>
      <Typography sx={{ fontSize: destacado ? '0.9rem' : '0.82rem', color: destacado ? '#111827' : '#6B7280', fontWeight: destacado ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: destacado ? '1.05rem' : '0.88rem',
        fontWeight: destacado ? 800 : 600,
        color: value > 0 ? (destacado ? '#DC2626' : '#B45309') : '#D1D5DB',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value > 0 ? fmt(value) : '—'}
      </Typography>
    </Box>
  )
}

export default function ConsultaDeudaPublica() {
  const { token } = useParams()
  const [email, setEmail] = useState('')
  const [numeracion, setNumeracion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !numeracion.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await getConsultaDeuda(token, email.trim(), numeracion.trim())
      if (!data) {
        setError('Los datos ingresados no coinciden. Verificá el email y el número de unidad.')
        return
      }
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
            gastos: (data.gastos ?? []).filter(g => g.periodo_id === periodo.id),
          }
        })
        .filter(Boolean)
      setResultado({ ...saldo, consorcioNombre: data.consorcio_nombre, periodosAdeudados })
    } catch {
      setError('Ocurrió un error al consultar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleVolver() {
    setResultado(null)
    setError(null)
  }

  return (
    <Box minHeight="100vh" bgcolor="#F8FAFC">
      <Header />

      <Box display="flex" justifyContent="center" px={2} py={{ xs: 4, md: 8 }}>
        <Box sx={{
          width: '100%', maxWidth: 420, bgcolor: 'white', borderRadius: '16px',
          border: '1px solid #E5E7EB', p: { xs: 3, sm: 4 },
        }}>
          {!resultado ? (
            <>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
                Consultá tu deuda
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', mb: 3 }}>
                Ingresá el email y el número de unidad para ver el estado de cuenta.
              </Typography>

              <Box component="form" onSubmit={handleSubmit}>
                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

                <TextField
                  fullWidth size="small" type="email" label="Email" autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  sx={{ ...fieldSx, mb: 2 }}
                />
                <TextField
                  fullWidth size="small" label="Número de unidad"
                  value={numeracion} onChange={e => setNumeracion(e.target.value)}
                  sx={{ ...fieldSx, mb: 3 }}
                />

                <Button
                  type="submit" fullWidth variant="contained"
                  disabled={loading || !email.trim() || !numeracion.trim()}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                  sx={{
                    bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                    fontWeight: 600, py: 1.1, boxShadow: 'none',
                    '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                  }}
                >
                  {loading ? 'Consultando...' : 'Consultar'}
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
                {resultado.consorcioNombre}
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', mb: 3 }}>
                Unidad {resultado.numeracion}
              </Typography>

              <Box sx={{ bgcolor: ACCENT_LIGHT, borderRadius: '10px', p: 2, mb: 1 }}>
                <SaldoRow label="Saldo último período" value={resultado.saldoUltimo} />
                <SaldoRow label="Saldo en mora" value={resultado.saldoMora} />
                <SaldoRow label="Interés mora" value={resultado.interesMora} />
                <Divider sx={{ my: 1 }} />
                <SaldoRow label="Saldo total" value={resultado.saldoTotal} destacado />
              </Box>

              {resultado.periodosAdeudados.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1.5 }}>
                    Detalle por período adeudado
                  </Typography>
                  {resultado.periodosAdeudados.map(periodo => (
                    <Box key={periodo.id} sx={{ border: '1px solid #E5E7EB', borderRadius: '10px', mb: 1.5, overflow: 'hidden' }}>
                      <Box sx={{ bgcolor: '#F9FAFB', px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
                          {MESES_LABEL[periodo.mes - 1]} {periodo.anio}
                        </Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(periodo.saldo)}
                        </Typography>
                      </Box>
                      <Box sx={{ px: 2, py: 1 }}>
                        {periodo.gastos.length === 0 ? (
                          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', py: 1 }}>
                            Sin gastos detallados para este período.
                          </Typography>
                        ) : (
                          periodo.gastos.map((g, i) => (
                            <Box key={i} display="flex" justifyContent="space-between" gap={1} py={0.6}
                              sx={{ borderBottom: i < periodo.gastos.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                            >
                              <Typography sx={{ fontSize: '0.78rem', color: '#374151' }}>{g.nombre}</Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {fmt(g.monto)}
                              </Typography>
                            </Box>
                          ))
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              <Button
                fullWidth onClick={handleVolver}
                sx={{
                  mt: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                  color: '#6B7280', '&:hover': { color: ACCENT, bgcolor: 'transparent' },
                }}
              >
                Consultar otra unidad
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
