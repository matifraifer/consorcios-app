import { Suspense } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import MobileBottomNav from './MobileBottomNav.jsx'
import PageLoader from './PageLoader.jsx'

export default function Layout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {!isMobile && <Sidebar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 2 : 4,
          pb: isMobile ? 9 : 4,
          minHeight: '100vh',
        }}
      >
        {/* Suspense propio: al cambiar de página el sidebar queda visible mientras carga */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </Box>
      {isMobile && <MobileBottomNav />}
    </Box>
  )
}
