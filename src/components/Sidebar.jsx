import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LogoutIcon from '@mui/icons-material/Logout'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const DRAWER_WIDTH = 240
const DRAWER_COLLAPSED = 64

const navItems = [
  { label: 'Inicio',        path: '/dashboard',      icon: <HomeIcon /> },
  { label: 'Consorcios',    path: '/consorcios',     icon: <ApartmentIcon /> },
  { label: 'Propietarios',  path: '/propietarios',   icon: <PersonAddIcon /> },
  { label: 'Departamentos', path: '/departamentos',  icon: <HomeWorkIcon /> },
  { label: 'Expensas',      path: '/expensas',       icon: <ReceiptLongIcon /> },
  { label: 'Reclamos',      path: '/reclamos',       icon: <ReportProblemIcon /> },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const width = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 0 : 2,
          height: 64,
        }}
      >
        {!collapsed && (
          <Typography variant="h6" noWrap fontWeight="bold" color="primary">
            Consorcios
          </Typography>
        )}
        <IconButton onClick={() => setCollapsed(prev => !prev)} size="small">
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* Nav items */}
      <List sx={{ px: collapsed ? 0.5 : 1, pt: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path
          const button = (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: '0 8px 8px 0',
                mb: 0.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1 : 2,
                color: active ? '#0aa87b' : 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: '#065F4614',
                  borderLeft: '3px solid #0aa87b',
                  borderRadius: '0 8px 8px 0',
                  '&:hover': { bgcolor: '#065F4620' },
                },
                '&:hover': { bgcolor: '#065F460a' },
                '& .MuiListItemIcon-root': {
                  color: active ? '#0aa87b' : 'inherit',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { fontWeight: active ? 600 : 400, fontSize: '0.9rem' } }}
                />
              )}
            </ListItemButton>
          )

          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            <span key={item.path}>{button}</span>
          )
        })}
      </List>

      {/* Footer */}
      <Box sx={{ mt: 'auto', p: collapsed ? 1 : 2 }}>
        <Divider sx={{ mb: 1 }} />
        {!collapsed && (
          <>
            <Typography variant="body2" color="text.secondary" noWrap>
              {user?.nombre_usuario}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rol: {user?.rol}
            </Typography>
          </>
        )}
        {collapsed ? (
          <Tooltip title="Salir" placement="right">
            <IconButton color="error" onClick={handleLogout} sx={{ width: '100%' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        ) : (
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
        )}
      </Box>
    </Drawer>
  )
}
