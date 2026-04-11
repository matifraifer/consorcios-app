import { Box, Tooltip, Typography } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ApartmentIcon from '@mui/icons-material/Apartment'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import OtherHousesIcon from '@mui/icons-material/OtherHouses'
import GroupIcon from '@mui/icons-material/Group'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LogoutIcon from '@mui/icons-material/Logout'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const DRAWER_WIDTH = 232
const DRAWER_COLLAPSED = 64

const ACTIVE_COLOR = '#065F46'
const ACTIVE_BG = '#ECFDF5'
const TEXT_DEFAULT = '#6B7280'
const TEXT_HOVER = '#111827'
const BORDER_COLOR = '#E5E7EB'

const navItems = [
  { label: 'Inicio',        path: '/dashboard',      icon: <HomeIcon sx={{ fontSize: 19 }} /> },
  { label: 'Consorcios',    path: '/consorcios',     icon: <ApartmentIcon sx={{ fontSize: 19 }} /> },
  { label: 'Departamentos', path: '/departamentos',  icon: <HomeWorkIcon sx={{ fontSize: 19 }} /> },
  { label: 'Propiedades',   path: '/propiedades',    icon: <OtherHousesIcon sx={{ fontSize: 19 }} /> },
  { label: 'Prospectos',    path: '/prospectos',     icon: <GroupIcon sx={{ fontSize: 19 }} /> },
  { label: 'Expensas',      path: '/expensas',       icon: <ReceiptLongIcon sx={{ fontSize: 19 }} /> },
  { label: 'Reclamos',      path: '/reclamos',       icon: <ReportProblemIcon sx={{ fontSize: 19 }} /> },
]

function NavItem({ item, active, collapsed, onClick }) {
  const button = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: collapsed ? 0 : 1.5,
        py: 1,
        mx: collapsed ? 'auto' : 1,
        mb: 0.25,
        width: collapsed ? 40 : 'auto',
        height: 40,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '8px',
        cursor: 'pointer',
        position: 'relative',
        color: active ? ACTIVE_COLOR : TEXT_DEFAULT,
        bgcolor: active ? ACTIVE_BG : 'transparent',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: active ? ACTIVE_BG : '#F9FAFB',
          color: active ? ACTIVE_COLOR : TEXT_HOVER,
        },
        ...(active && !collapsed && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: -8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 20,
            borderRadius: '0 3px 3px 0',
            bgcolor: ACTIVE_COLOR,
          },
        }),
      }}
    >
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{item.icon}</Box>
      {!collapsed && (
        <Typography
          sx={{
            fontSize: '0.82rem',
            fontWeight: active ? 600 : 400,
            color: 'inherit',
            letterSpacing: '0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </Typography>
      )}
    </Box>
  )

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : button
}

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
  const initials = (user?.nombre_usuario ?? 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        height: '100vh',
        bgcolor: 'white',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        borderRight: `1px solid ${BORDER_COLOR}`,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 0 : 2,
          height: 60,
          borderBottom: `1px solid ${BORDER_COLOR}`,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '6px',
                bgcolor: ACTIVE_COLOR,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ApartmentIcon sx={{ fontSize: 15, color: 'white' }} />
            </Box>
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#111827',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Consorcios
            </Typography>
          </Box>
        )}

        <Tooltip title={collapsed ? 'Expandir' : 'Colapsar'} placement="right">
          <Box
            onClick={() => setCollapsed(prev => !prev)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: '#F3F4F6', color: '#374151' },
            }}
          >
            {collapsed
              ? <ChevronRightIcon sx={{ fontSize: 18 }} />
              : <ChevronLeftIcon sx={{ fontSize: 18 }} />
            }
          </Box>
        </Tooltip>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, pt: 1.5, overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && (
          <Typography
            sx={{
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#D1D5DB',
              px: 2.5,
              mb: 1,
            }}
          >
          </Typography>
        )}
        {navItems.map(item => (
          <NavItem
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
          />
        ))}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          borderTop: `1px solid ${BORDER_COLOR}`,
          p: collapsed ? 1 : 1.5,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <Box display="flex" alignItems="center" gap={1.25} mb={1.5}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: ACTIVE_BG,
                border: `1px solid #A7F3D0`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ACTIVE_COLOR }}>
                {initials}
              </Typography>
            </Box>
            <Box overflow="hidden">
              <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
                {user?.nombre_usuario}
              </Typography>
              <Typography noWrap sx={{ fontSize: '0.65rem', color: '#9CA3AF', textTransform: 'capitalize' }}>
                {user?.rol}
              </Typography>
            </Box>
          </Box>
        )}

        <Tooltip title={collapsed ? 'Cerrar sesion' : ''} placement="right">
          <Box
            onClick={handleLogout}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: collapsed ? 0 : 1.5,
              py: 0.875,
              borderRadius: '8px',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: '#F87171',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: '#FEF2F2', color: '#EF4444' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 17 }} />
            {!collapsed && (
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'inherit' }}>
                Cerrar sesion
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  )
}
