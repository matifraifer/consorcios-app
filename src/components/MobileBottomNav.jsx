import { useState } from 'react'
import {
  Box, Paper, BottomNavigation, BottomNavigationAction,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, Typography,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import LanguageIcon from '@mui/icons-material/Language'
import OtherHousesIcon from '@mui/icons-material/OtherHouses'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import GroupIcon from '@mui/icons-material/Group'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import DescriptionIcon from '@mui/icons-material/Description'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ACCENT      = '#10B981'
const TEXT_MUTED  = '#6B7C74'
const TEXT_DEFAULT = '#1A3D2C'
const BORDER      = 'rgba(16,185,129,0.12)'

const primaryItems = [
  { label: 'Inicio',        path: '/dashboard',      icon: <HomeIcon /> },
  { label: 'Consultas',     path: '/consultas-web',  icon: <LanguageIcon /> },
  { label: 'Propiedades',   path: '/propiedades',    icon: <OtherHousesIcon /> },
  { label: 'Contactos',     path: '/contactos',      icon: <PermContactCalendarIcon /> },
]

const moreItems = [
  { label: 'Seguimiento de contactos', path: '/prospectos',           icon: <GroupIcon /> },
  { label: 'Propiedades externas',     path: '/propiedades-comunidad', icon: <TravelExploreIcon /> },
  { label: 'Contratos',                path: '/contratos',            icon: <DescriptionIcon /> },
]

export default function MobileBottomNav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === 'admin'
  const [moreOpen, setMoreOpen] = useState(false)

  const morePaths = moreItems.map(i => i.path).concat(isAdmin ? ['/configuracion'] : [])
  const isMoreActive = morePaths.includes(location.pathname)

  const activeValue = isMoreActive
    ? 'more'
    : (primaryItems.find(i => i.path === location.pathname)?.path ?? false)

  function goTo(path) {
    setMoreOpen(false)
    navigate(path)
  }

  function handleLogout() {
    setMoreOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          borderTop: `1px solid ${BORDER}`,
          zIndex: 1200,
        }}
      >
        <BottomNavigation
          showLabels
          value={activeValue}
          onChange={(_e, newValue) => {
            if (newValue === 'more') setMoreOpen(true)
            else goTo(newValue)
          }}
          sx={{ height: 64 }}
        >
          {primaryItems.map(item => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={item.icon}
              sx={{
                minWidth: 0,
                color: TEXT_MUTED,
                '&.Mui-selected': { color: ACCENT },
              }}
            />
          ))}
          <BottomNavigationAction
            label="Mas"
            value="more"
            icon={<MoreHorizIcon />}
            sx={{
              minWidth: 0,
              color: TEXT_MUTED,
              '&.Mui-selected': { color: ACCENT },
            }}
          />
        </BottomNavigation>
      </Paper>

      <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
      >
        <Box sx={{ pt: 1.5, pb: 1 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: BORDER, mx: 'auto', mb: 1.5 }} />

          <List sx={{ py: 0 }}>
            {moreItems.map(item => (
              <ListItemButton key={item.path} onClick={() => goTo(item.path)}
                selected={location.pathname === item.path}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(16,185,129,0.08)' } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? ACCENT : TEXT_DEFAULT }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
              </ListItemButton>
            ))}

            {isAdmin && (
              <ListItemButton onClick={() => goTo('/configuracion')}
                selected={location.pathname === '/configuracion'}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(16,185,129,0.08)' } }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: location.pathname === '/configuracion' ? ACCENT : TEXT_DEFAULT }}>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Configuracion" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
              </ListItemButton>
            )}
          </List>

          <Divider sx={{ my: 1 }} />

          <List sx={{ py: 0 }}>
            <ListItemButton onClick={() => window.open('https://wa.me/+5492644159466', '_blank', 'noopener,noreferrer')}>
              <ListItemIcon sx={{ minWidth: 40, color: '#25D366' }}>
                <WhatsAppIcon />
              </ListItemIcon>
              <ListItemText primary="Necesito ayuda!" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
            </ListItemButton>

            <ListItemButton onClick={handleLogout}>
              <ListItemIcon sx={{ minWidth: 40, color: '#F87171' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Cerrar sesion" primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
            </ListItemButton>
          </List>

          {user?.cliente_nombre && (
            <Typography sx={{ textAlign: 'center', fontSize: '0.7rem', color: TEXT_MUTED, mt: 1 }}>
              {user.cliente_nombre}
            </Typography>
          )}
        </Box>
      </Drawer>
    </>
  )
}
