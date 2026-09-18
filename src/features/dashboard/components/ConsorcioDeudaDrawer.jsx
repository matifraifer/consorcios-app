import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function labelPeriodo(mes, anio) {
  if (!mes || !anio) return '—'
  return `${MESES[(mes ?? 1) - 1]} ${anio}`
}

function estadoChip(monto_pagado, monto_total) {
  const pagado = Number(monto_pagado ?? 0)
  const total = Number(monto_total ?? 0)
  if (pagado <= 0) return <Chip label="Pendiente" size="small" color="warning" variant="outlined" sx={{ bgcolor: '#FFF7ED' }} />
  if (pagado >= total) return <Chip label="Pagado" size="small" color="success" variant="outlined" sx={{ bgcolor: '#F0FDF4' }} />
  return <Chip label="Parcial" size="small" color="info" variant="outlined" sx={{ bgcolor: '#EFF6FF' }} />
}

// Vista 1: tabla de períodos con deuda del consorcio
function PeriodosTable({ periodos }) {
  const navigate = useNavigate()

  return (
    <>
      <Typography variant="subtitle1" fontWeight="bold" mb={1}>Períodos con deuda</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Período</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Deptos pendientes</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Total adeudado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {periodos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Sin períodos con deuda.
                </TableCell>
              </TableRow>
            ) : (
              periodos.map(p => (
                <TableRow key={p.key} hover>
                  <TableCell>{labelPeriodo(p.mes, p.anio)}</TableCell>
                  <TableCell align="center">
                    <Chip label={p.cantDeptos} size="small" color="warning" variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    {fmt(p.totalAdeudado)}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => navigate(`/expensas/${p.periodo_id}?tab=liquidacion`)}
                    >
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

export default function ConsorcioDeudaDrawer({ open, consorcio, allItems, onClose }) {
  // Filtrar items del consorcio seleccionado
  const consorcioItems = useMemo(() => {
    if (!consorcio) return []
    return allItems.filter(i => i.periodo?.consorcio_id === consorcio.id)
  }, [consorcio, allItems])

  // Agrupar por período
  const periodos = useMemo(() => {
    const map = new Map()
    consorcioItems.forEach(item => {
      const key = `${item.periodo?.mes}-${item.periodo?.anio}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          mes: item.periodo?.mes,
          anio: item.periodo?.anio,
          periodo_id: item.periodo_id,
          cantDeptos: 0,
          totalAdeudado: 0,
        })
      }
      const entry = map.get(key)
      entry.cantDeptos += 1
      entry.totalAdeudado += item.saldo
    })
    return Array.from(map.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes)
  }, [consorcioItems])

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 600 }, p: 3 } }}
    >
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">{consorcio?.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">
            {consorcio?.deptosMorosos} depto{consorcio?.deptosMorosos !== 1 ? 's' : ''} moroso{consorcio?.deptosMorosos !== 1 ? 's' : ''} — Total adeudado:{' '}
            <strong style={{ color: '#d32f2f' }}>
              ${Number(consorcio?.totalAdeudado ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <PeriodosTable periodos={periodos} />
    </Drawer>
  )
}
