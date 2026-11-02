import { Box, CircularProgress } from '@mui/material'

// Indicador mientras se descarga el código de una página (React.lazy + Suspense).
// fullScreen: páginas fuera del Layout (públicas, login); si no, ocupa el área de contenido.
export default function PageLoader({ fullScreen = false }) {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems={fullScreen ? 'center' : 'flex-start'}
      sx={{ minHeight: fullScreen ? '100vh' : 'auto', mt: fullScreen ? 0 : 4 }}
    >
      <CircularProgress sx={{ color: '#065F46' }} />
    </Box>
  )
}
