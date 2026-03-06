import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography,
  Button,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LogoutIcon from '@mui/icons-material/Logout'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const DRAWER_WIDTH = 240

const navItems = [
  { label: 'Inicio',        path: '/dashboard',      icon: <HomeIcon /> },
  { label: 'Consorcios',    path: '/consorcios',     icon: <ApartmentIcon /> },
  { label: 'Departamentos', path: '/departamentos',  icon: <HomeWorkIcon /> },
  { label: 'Propietarios',  path: '/propietarios',   icon: <PersonAddIcon /> },
  { label: 'Reclamos',      path: '/reclamos',       icon: <ReportProblemIcon /> },
  { label: 'Expensas',      path: '/expensas',       icon: <ReceiptLongIcon /> },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap fontWeight="bold" color="primary">
          Consorcios
        </Typography>
      </Toolbar>
      <Divider />

      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary" noWrap>
          {user?.nombre_usuario}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Rol: {user?.rol}
        </Typography>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ mt: 1 }}
        >
          Salir
        </Button>
      </Box>
    </Drawer>
  )
}
