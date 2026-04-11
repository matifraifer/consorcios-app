import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Sidebar />
      <Box component="main" sx={{ flexGrow: 1, p: 4, minHeight: '100vh' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
