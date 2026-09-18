import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileBottomNav from './MobileBottomNav'

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
        <Outlet />
      </Box>
      {isMobile && <MobileBottomNav />}
    </Box>
  )
}
