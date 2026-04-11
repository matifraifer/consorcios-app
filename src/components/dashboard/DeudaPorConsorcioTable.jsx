import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Chip, IconButton, Typography, Tooltip } from '@mui/material'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ConsorcioRow({ row, onVerDetalle }) {
  return (
    <Box
      onClick={onVerDetalle}
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 3,
        py: 1.75,
        borderBottom: '1px solid #F3F4F6',
        cursor: 'pointer',
        transition: 'background 0.15s',
        '&:hover': {
          bgcolor: '#F0FDF4',
          '& .arrow-btn': { color: '#065F46', opacity: 1 },
          '& .consorcio-nombre': { color: '#065F46' },
        },
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      {/* Indicador lateral */}
      <Box
        sx={{
          width: 3,
          height: 28,
          borderRadius: '2px',
          bgcolor: '#D1FAE5',
          mr: 2.5,
          flexShrink: 0,
        }}
      />

      {/* Nombre */}
      <Typography
        className="consorcio-nombre"
        sx={{
          flex: 1,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#374151',
          transition: 'color 0.15s',
        }}
      >
        {row.nombre}
      </Typography>

      {/* Deptos morosos */}
      <Tooltip title={`${row.deptosMorosos} departamento${row.deptosMorosos !== 1 ? 's' : ''} con deuda`}>
        <Chip
          label={`${row.deptosMorosos} depto${row.deptosMorosos !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            mr: 3,
            fontSize: '0.7rem',
            fontWeight: 600,
            height: 22,
            bgcolor: '#FEF3C7',
            color: '#92400E',
            border: 'none',
          }}
        />
      </Tooltip>

      {/* Monto */}
      <Typography
        sx={{
          fontSize: '0.9rem',
          fontWeight: 700,
          color: '#DC2626',
          letterSpacing: '-0.01em',
          minWidth: 130,
          textAlign: 'right',
          mr: 2,
        }}
      >
        {fmt(row.totalAdeudado)}
      </Typography>

      {/* Acción */}
      <Tooltip title="Ver liquidacion del periodo">
        <IconButton
          className="arrow-btn"
          size="small"
          sx={{
            color: '#D1D5DB',
            opacity: 0.6,
            transition: 'all 0.15s',
            '&:hover': { bgcolor: '#DCFCE7' },
          }}
        >
          <ArrowForwardIosIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default function DeudaPorConsorcioTable({ rows }) {
  const navigate = useNavigate()

  const grupos = useMemo(() => {
    const map = new Map()
    rows.forEach(row => {
      const key = `${row.anio}-${String(row.mes).padStart(2, '0')}`
      if (!map.has(key)) {
        map.set(key, { key, mes: row.mes, anio: row.anio, consorcios: [] })
      }
      map.get(key).consorcios.push(row)
    })
    return Array.from(map.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes)
  }, [rows])

  if (grupos.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          bgcolor: 'white',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
        }}
      >
        <Typography sx={{ color: '#9CA3AF', fontSize: '0.875rem' }}>
          No hay deuda registrada para los filtros seleccionados.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" alignItems="baseline" gap={1} mb={3}>
        <Typography
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}
        >
          Deuda por periodo
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
          — solo periodos cerrados con saldo pendiente
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {grupos.map(grupo => {
          const totalGrupo = grupo.consorcios.reduce((s, c) => s + c.totalAdeudado, 0)

          return (
            <Box key={grupo.key}>
              {/* Cabecera del período */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1,
                  px: 1,
                }}
              >
                <Box display="flex" alignItems="baseline" gap={1}>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#065F46',
                    }}
                  >
                    {MESES[(grupo.mes ?? 1) - 1]}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#9CA3AF',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {grupo.anio}
                  </Typography>
                </Box>

                {/* Linea separadora */}
                <Box sx={{ flex: 1, height: '1px', bgcolor: '#E5E7EB' }} />

                {/* Total del período */}
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#DC2626',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {fmt(totalGrupo)}
                </Typography>
              </Box>

              {/* Filas de consorcios */}
              <Box
                sx={{
                  bgcolor: 'white',
                  borderRadius: '10px',
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden',
                }}
              >
                {grupo.consorcios.map(row => (
                  <ConsorcioRow
                    key={row.key}
                    row={row}
                    onVerDetalle={() => navigate(`/expensas/${row.periodo_id}?tab=liquidacion`)}
                  />
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
