import { Component } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { logPortalError } from '../../features/portal/services/portal'
const ORANGE = '#fb3c00'
const GREEN_900 = '#142B21'
const GREEN_BG = '#f7faf9'
const BORDER = 'rgba(20,43,33,0.10)'
const TEXT_MUTED = 'rgba(20,43,33,0.52)'

// Atrapa cualquier crash de render en el portal público (sin login, sin
// forma de que el vecino nos avise que vio una pantalla en blanco) y lo
// deja registrado en portal_error_logs para poder diagnosticarlo después.
export default class PortalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logPortalError(this.props.ruta ?? 'portal', 'render_crash', error, {
      componentStack: info?.componentStack,
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <Box minHeight="100vh" bgcolor={GREEN_BG} display="flex" alignItems="center" justifyContent="center" px={2}>
        <Box sx={{
          width: '100%', maxWidth: 420, bgcolor: 'white', borderRadius: '16px',
          border: `1px solid ${BORDER}`, p: 4, textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: GREEN_900, mb: 1 }}>
            Algo salió mal
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: TEXT_MUTED, mb: 3 }}>
            Tuvimos un problema al mostrar esta página. Ya quedó registrado — probá recargar.
          </Typography>
          <Button
            fullWidth variant="contained" onClick={() => window.location.reload()}
            sx={{ bgcolor: ORANGE, borderRadius: '12px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#e53500' } }}
          >
            Recargar
          </Button>
        </Box>
      </Box>
    )
  }
}
