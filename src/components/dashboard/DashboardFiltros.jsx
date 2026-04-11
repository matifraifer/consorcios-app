import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Chip,
} from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const selectSx = {
  fontSize: '0.82rem',
  fontWeight: 500,
  bgcolor: 'white',
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#E5E7EB',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#065F46',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#065F46',
    borderWidth: 1,
  },
  '& .MuiSelect-select': {
    py: 1,
    px: 1.5,
  },
}

export default function DashboardFiltros({
  consorcioOptions,
  periodoOptions,
  filtroConsorcio,
  filtroPeriodo,
  filtroEstado,
  onChangeConsorcio,
  onChangePeriodo,
  onChangeEstado,
}) {
  function handleLimpiar() {
    onChangeConsorcio('')
    onChangePeriodo('')
    onChangeEstado('')
  }

  const hayFiltros = filtroConsorcio || filtroPeriodo || filtroEstado
  const filtrosActivos = [filtroConsorcio, filtroPeriodo, filtroEstado].filter(Boolean).length

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        flexWrap: 'wrap',
        alignItems: 'center',
        mb: 3,
        p: 2,
        bgcolor: '#F8FAFC',
        borderRadius: '10px',
        border: '1px solid #E5E7EB',
      }}
    >
      <Box display="flex" alignItems="center" gap={0.75} mr={0.5}>
        <TuneIcon sx={{ fontSize: 16, color: '#6B7280' }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Filtros
        </Typography>
        {filtrosActivos > 0 && (
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              bgcolor: '#065F46',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.6rem', color: 'white', fontWeight: 700 }}>
              {filtrosActivos}
            </Typography>
          </Box>
        )}
      </Box>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select
          value={filtroConsorcio}
          onChange={e => onChangeConsorcio(e.target.value)}
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos los consorcios</em></MenuItem>
          {consorcioOptions.map(c => (
            <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.82rem' }}>{c.nombre}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 190 }}>
        <Select
          value={filtroPeriodo}
          onChange={e => onChangePeriodo(e.target.value)}
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Ultimos 3 periodos</em></MenuItem>
          {periodoOptions.map(p => (
            <MenuItem key={p.key} value={p.key} sx={{ fontSize: '0.82rem' }}>
              {MESES[(p.mes ?? 1) - 1]} {p.anio}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <Select
          value={filtroEstado}
          onChange={e => onChangeEstado(e.target.value)}
          displayEmpty
          sx={selectSx}
        >
          <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos los estados</em></MenuItem>
          <MenuItem value="pendiente" sx={{ fontSize: '0.82rem' }}>Pendiente</MenuItem>
          <MenuItem value="parcial" sx={{ fontSize: '0.82rem' }}>Parcial</MenuItem>
        </Select>
      </FormControl>

      {hayFiltros && (
        <Chip
          label="Limpiar"
          size="small"
          onClick={handleLimpiar}
          onDelete={handleLimpiar}
          sx={{
            fontSize: '0.72rem',
            height: 26,
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            '& .MuiChip-deleteIcon': { fontSize: 14 },
          }}
        />
      )}
    </Box>
  )
}
