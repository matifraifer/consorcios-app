import { Box, Collapse, Tooltip, Typography } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ApartmentIcon from '@mui/icons-material/Apartment'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import OtherHousesIcon from '@mui/icons-material/OtherHouses'
import GroupIcon from '@mui/icons-material/Group'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import DescriptionIcon from '@mui/icons-material/Description'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import LanguageIcon from '@mui/icons-material/Language'
import LogoutIcon from '@mui/icons-material/Logout'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const DRAWER_WIDTH    = 240
const DRAWER_COLLAPSED = 64

const BG          = '#ffffff'
const BG_HOVER    = '#142B21'
const BG_ACTIVE   = '#1A3D2C'
const TEXT_MUTED  = '#142B21'
const TEXT_DEFAULT = '#1A3D2C'
const TEXT_ACTIVE  = '#E2F0E8'
const ACCENT       = '#10B981'
const BORDER       = 'rgba(16,185,129,0.12)'

const adminItems = [
  { label: 'Listado de consorcios', path: '/consorcios', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
  { label: 'Departamentos', path: '/departamentos', icon: <HomeWorkIcon sx={{ fontSize: 18 }} /> },
  { label: 'Expensas',      path: '/expensas',      icon: <ReceiptLongIcon sx={{ fontSize: 18 }} /> },
  { label: 'Reclamos',      path: '/reclamos',      icon: <ReportProblemIcon sx={{ fontSize: 18 }} /> },
]

const topItems = [
  { label: 'Inicio', path: '/dashboard', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
]

const comercialItems = [
  { label: 'Consultas Web',           path: '/consultas-web', icon: <LanguageIcon sx={{ fontSize: 18 }} /> },
  { label: 'Seguimiento de contactos', path: '/prospectos',   icon: <GroupIcon sx={{ fontSize: 18 }} /> },
]

const baseDatosItems = [
  { label: 'Propiedades en venta', path: '/propiedades', icon: <OtherHousesIcon sx={{ fontSize: 18 }} /> },
  { label: 'Contactos',            path: '/contactos',   icon: <PermContactCalendarIcon sx={{ fontSize: 18 }} /> },
]

const contratosItems = [
  { label: 'Contratos', path: '/contratos', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
]

function SectionHeader({ label, cls, open, onToggle }) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, pt: 1.75, pb: 0.75, cursor: 'pointer', userSelect: 'none',
        [`&:hover .${cls}-label`]: { color: TEXT_DEFAULT },
        [`&:hover .${cls}-icon`]: { color: TEXT_DEFAULT },
      }}
    >
      <Typography
        className={`${cls}-label`}
        sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT_MUTED, transition: 'color 0.15s' }}
      >
        {label}
      </Typography>
      <ExpandMoreIcon
        className={`${cls}-icon`}
        sx={{ fontSize: 14, color: TEXT_MUTED, transition: 'transform 0.2s ease, color 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      />
    </Box>
  )
}

function NavItem({ item, active, collapsed, onClick, indented = false }) {
  const button = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: collapsed ? 0 : indented ? 2 : 1.5,
        py: 0.875,
        mx: collapsed ? 'auto' : 1,
        mb: 0.25,
        width: collapsed ? 40 : 'auto',
        height: 38,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '8px',
        cursor: 'pointer',
        position: 'relative',
        color: active ? TEXT_ACTIVE : TEXT_DEFAULT,
        bgcolor: active ? BG_ACTIVE : 'transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: active ? BG_ACTIVE : BG_HOVER,
          color: active ? TEXT_ACTIVE : '#BDD9C8',
        },
        ...(active && !collapsed && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 18,
            borderRadius: '0 3px 3px 0',
            bgcolor: ACCENT,
            boxShadow: `0 0 10px ${ACCENT}70`,
          },
        }),
      }}
    >
      <Box sx={{ display: 'flex', flexShrink: 0, color: active ? ACCENT : 'inherit' }}>
        {item.icon}
      </Box>
      {!collapsed && (
        <Typography
          sx={{
            fontSize: '0.8rem',
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
    <Tooltip title={item.label} placement="right" arrow
      slotProps={{ tooltip: { sx: { bgcolor: BG_ACTIVE, color: TEXT_ACTIVE, fontSize: '0.75rem', border: `1px solid ${BORDER}` } }, arrow: { sx: { color: BG_ACTIVE } } }}>
      {button}
    </Tooltip>
  ) : button
}

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const [adminOpen, setAdminOpen] = useState(true)

  const [comercialOpen, setComercialOpen] = useState(true)
  const [baseDatosOpen, setBaseDatosOpen] = useState(true)
  const [contratosOpen, setContratosOpen] = useState(true)

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
        bgcolor: BG,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        borderRight: `1px solid ${BORDER}`,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
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
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <Box display="flex" alignItems="center" gap={1.25}>
            <Box component="img" src="/logo.svg" alt="Habita" sx={{ height: 28, width: 'auto', flexShrink: 0 }} />
            <Typography
              sx={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#065F46',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Hábita
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
              color: TEXT_MUTED,
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: BG_HOVER, color: TEXT_DEFAULT },
            }}
          >
            {collapsed
              ? <ChevronRightIcon sx={{ fontSize: 17 }} />
              : <ChevronLeftIcon sx={{ fontSize: 17 }} />
            }
          </Box>
        </Tooltip>
      </Box>

      {/* Nav */}
      <Box
        sx={{
          flex: 1,
          pt: 1.5,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: BORDER, borderRadius: 4 },
        }}
      >
        {/* Inicio */}
        {topItems.map(item => (
          <NavItem
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Grupo: Consorcios — oculto temporalmente */}
        {/* {collapsed ? (
          adminItems.map(item => (
            <NavItem
              key={item.path}
              item={item}
              active={location.pathname === item.path}
              collapsed={true}
              onClick={() => navigate(item.path)}
            />
          ))
        ) : (
          <>
            <Box
              onClick={() => setAdminOpen(prev => !prev)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                pt: 1.75,
                pb: 0.75,
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover .g-label': { color: TEXT_DEFAULT },
                '&:hover .g-icon': { color: TEXT_DEFAULT },
              }}
            >
              <Typography
                className="g-label"
                sx={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: TEXT_MUTED,
                  transition: 'color 0.15s',
                }}
              >
                Consorcios
              </Typography>
              <ExpandMoreIcon
                className="g-icon"
                sx={{
                  fontSize: 14,
                  color: TEXT_MUTED,
                  transition: 'transform 0.2s ease, color 0.15s',
                  transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </Box>

            <Collapse in={adminOpen}>
              {adminItems.map(item => (
                <NavItem
                  key={item.path}
                  item={item}
                  active={location.pathname === item.path}
                  collapsed={false}
                  indented
                  onClick={() => navigate(item.path)}
                />
              ))}
            </Collapse>
          </>
        )}

        <Box
          sx={{
            mx: collapsed ? 1.25 : 2,
            my: 1.5,
            height: '1px',
            bgcolor: BORDER,
          }}
        /> */}

        {/* Grupo: Gestión comercial */}
        {collapsed ? (
          comercialItems.map(item => (
            <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={true} onClick={() => navigate(item.path)} />
          ))
        ) : (
          <>
            <SectionHeader label="Gestión comercial" cls="gc" open={comercialOpen} onToggle={() => setComercialOpen(p => !p)} />
            <Collapse in={comercialOpen}>
              {comercialItems.map(item => (
                <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={false} indented onClick={() => navigate(item.path)} />
              ))}
            </Collapse>
          </>
        )}

        {/* Divisor */}
        <Box sx={{ mx: collapsed ? 1.25 : 2, my: 1.5, height: '1px', bgcolor: BORDER }} />

        {/* Grupo: Base de datos */}
        {collapsed ? (
          baseDatosItems.map(item => (
            <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={true} onClick={() => navigate(item.path)} />
          ))
        ) : (
          <>
            <SectionHeader label="Base de datos" cls="bd" open={baseDatosOpen} onToggle={() => setBaseDatosOpen(p => !p)} />
            <Collapse in={baseDatosOpen}>
              {baseDatosItems.map(item => (
                <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={false} indented onClick={() => navigate(item.path)} />
              ))}
            </Collapse>
          </>
        )}

        {/* Divisor */}
        <Box sx={{ mx: collapsed ? 1.25 : 2, my: 1.5, height: '1px', bgcolor: BORDER }} />

        {/* Grupo: Gestión de contratos */}
        {collapsed ? (
          contratosItems.map(item => (
            <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={true} onClick={() => navigate(item.path)} />
          ))
        ) : (
          <>
            <SectionHeader label="Gestión de contratos" cls="gcon" open={contratosOpen} onToggle={() => setContratosOpen(p => !p)} />
            <Collapse in={contratosOpen}>
              {contratosItems.map(item => (
                <NavItem key={item.path} item={item} active={location.pathname === item.path} collapsed={false} indented onClick={() => navigate(item.path)} />
              ))}
            </Collapse>
          </>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          borderTop: `1px solid ${BORDER}`,
          p: collapsed ? 1 : 1.5,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <>
            {user?.cliente_nombre && (
              <Box
                sx={{
                  bgcolor: 'rgba(16,185,129,0.07)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: '8px',
                  px: 1.5,
                  py: 1,
                  mb: 1.5,
                }}
              >
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_MUTED, mb: 0.25 }}>
                  Cliente
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: TEXT_DEFAULT }}>
                  {user.cliente_nombre}
                </Typography>
              </Box>
            )}

            <Box display="flex" alignItems="center" gap={1.25} mb={1.5}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  bgcolor: BG_ACTIVE,
                  border: `1px solid ${BORDER}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ACCENT }}>
                  {initials}
                </Typography>
              </Box>
              <Box overflow="hidden">
                <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: TEXT_DEFAULT, lineHeight: 1.2 }}>
                  {user?.nombre_usuario}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.65rem', color: TEXT_MUTED, textTransform: 'capitalize' }}>
                  {user?.rol}
                </Typography>
              </Box>
            </Box>
          </>
        )}

        {collapsed && user && (
          <Tooltip title={user.nombre_usuario ?? ''} placement="right">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: BG_ACTIVE,
                border: `1px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1,
                cursor: 'default',
              }}
            >
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ACCENT }}>
                {initials}
              </Typography>
            </Box>
          </Tooltip>
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
              color: '#6B7C74',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.08)', color: '#F87171' },
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
