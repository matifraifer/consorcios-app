import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PaidIcon from '@mui/icons-material/Paid'
import GroupsIcon from '@mui/icons-material/Groups'
import { getProyectoById } from '../services/supabase'
import ResumenProyectoTab from '../components/proyectos/ResumenProyectoTab'
import EtapasProyectoTab from '../components/proyectos/EtapasProyectoTab'
import GanttProyectoTab from '../components/proyectos/GanttProyectoTab'

const ACCENT = '#065F46'

function Proximamente({ icon, texto }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid #E5E7EB',
        borderRadius: 3,
        p: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
      }}
    >
      {icon}
      <Typography variant="subtitle1" fontWeight={600} color="#1A3D2C">
        Próximamente
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {texto}
      </Typography>
    </Paper>
  )
}

export default function ProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    getProyectoById(id)
      .then(setProyecto)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Breadcrumb / back */}
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        mb={3}
        sx={{ cursor: 'pointer', width: 'fit-content' }}
        onClick={() => navigate('/proyectos')}
      >
        <ArrowBackIcon sx={{ fontSize: 15, color: '#9CA3AF' }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
          Proyectos
        </Typography>
      </Box>

      {/* Header */}
      <Box mb={4}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
          Proyecto
        </Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {proyecto?.nombre}
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          minHeight: 40,
          '& .MuiTabs-indicator': { bgcolor: ACCENT, height: 2.5, borderRadius: 2 },
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 40, minWidth: 'auto', px: 0, mr: 3, color: '#9CA3AF' },
          '& .Mui-selected': { color: `${ACCENT} !important` },
        }}
      >
        <Tab label="Resumen del proyecto" />
        <Tab label="Etapas del proyecto" />
        <Tab label="Diagrama de Gantt" />
        <Tab label="Costos del proyecto" />
        <Tab label="Equipo" />
      </Tabs>

      {tab === 0 ? (
        <ResumenProyectoTab proyectoId={id} />
      ) : tab === 1 ? (
        <EtapasProyectoTab proyectoId={id} />
      ) : tab === 2 ? (
        <GanttProyectoTab proyectoId={id} />
      ) : tab === 3 ? (
        <Proximamente
          icon={<PaidIcon sx={{ fontSize: 40, color: '#10B981' }} />}
          texto="Acá vas a poder controlar los costos del proyecto."
        />
      ) : (
        <Proximamente
          icon={<GroupsIcon sx={{ fontSize: 40, color: '#10B981' }} />}
          texto="Acá vas a poder administrar el equipo del proyecto."
        />
      )}
    </Box>
  )
}
