import { Box, TextField, Typography } from '@mui/material'

// Campos de nomenclatura catastral y cuentas de servicios del inmueble (propiedades, 0061).
// Lo usan PropiedadFormDrawer y ContratoFormDrawer para que se vean igual en los dos.

const ACCENT = '#065F46'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const CAMPOS = [
  ['nomenclatura_catastral', 'Nomenclatura catastral (N.C.)'],
  ['servicio_agua', 'Cuenta o suministro de agua'],
  ['servicio_gas', 'Cuenta o suministro de gas'],
  ['servicio_energia', 'Cuenta o suministro de energía'],
  ['servicio_municipalidad', 'Cuenta municipal'],
]

function Label({ children }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

export default function DatosInmuebleFields({ values, onChange, disabled = false }) {
  return (
    <Box mb={2}>
      {CAMPOS.map(([campo, label]) => (
        <Box mb={1.5} key={campo}>
          <Label>{label}</Label>
          <TextField fullWidth size="small" value={values[campo] ?? ''} disabled={disabled}
            onChange={e => onChange(campo, e.target.value)} placeholder="Opcional" sx={fieldSx} />
        </Box>
      ))}
    </Box>
  )
}
