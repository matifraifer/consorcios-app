import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PersonIcon from '@mui/icons-material/Person'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useAuth } from '../contexts/AuthContext'
import { getExpensasPendientes } from '../services/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ icon, label, description, onClick }) {
  return (
    <Paper
      sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : {} }}
      onClick={onClick}
    >
      {icon}
      <Box>
        <Typography variant="h6" fontWeight="bold">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>
    </Paper>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getExpensasPendientes(user.id)
      .then(setPendientes)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  // Agrupar pendientes por consorcio
  const porConsorcio = pendientes.reduce((acc, item) => {
    const consorcio = item.periodos_expensas?.consorcios?.nombre ?? 'Sin consorcio'
    if (!acc[consorcio]) acc[consorcio] = { items: [], total: 0 }
    acc[consorcio].items.push(item)
    acc[consorcio].total += Number(item.monto_total ?? 0)
    return acc
  }, {})

  const totalPendiente = pendientes.reduce((s, i) => s + Number(i.monto_total ?? 0), 0)

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Bienvenido, {user?.nombre_usuario}
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Panel de administración de consorcios
      </Typography>

      {/* Accesos rápidos */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<ApartmentIcon color="primary" sx={{ fontSize: 40 }} />}
            label="Consorcios"
            description="Ver y administrar consorcios"
            onClick={() => navigate('/consorcios')}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<HomeWorkIcon color="secondary" sx={{ fontSize: 40 }} />}
            label="Departamentos"
            description="Gestionar unidades funcionales"
            onClick={() => navigate('/departamentos')}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<PersonIcon color="success" sx={{ fontSize: 40 }} />}
            label="Propietarios"
            description="Registrar propietarios"
            onClick={() => navigate('/propietarios')}
          />
        </Grid>
      </Grid>

      {/* Sección expensas pendientes */}
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Expensas pendientes de cobro de periodos cerrados
      </Typography>

      {loading && <Box display="flex" justifyContent="center" mt={2}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <>
          {/* KPIs */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderLeft: 4, borderColor: pendientes.length > 0 ? 'warning.main' : 'success.main' }}>
                {pendientes.length > 0
                  ? <WarningAmberIcon color="warning" sx={{ fontSize: 40 }} />
                  : <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40 }} />
                }
                <Box>
                  <Typography variant="h4" fontWeight="bold">{pendientes.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pendientes.length === 1 ? 'departamento pendiente' : 'departamentos pendientes'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderLeft: 4, borderColor: totalPendiente > 0 ? 'warning.main' : 'success.main' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{fmt(totalPendiente)}</Typography>
                  <Typography variant="body2" color="text.secondary">monto total pendiente</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Tabla detalle por consorcio */}
          {pendientes.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                Todas las expensas están al día.
              </Typography>
            </Paper>
          ) : (
            Object.entries(porConsorcio).map(([consorcio, { items, total }]) => (
              <Box key={consorcio} mb={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight="bold">{consorcio}</Typography>
                  <Typography variant="body2" color="warning.main" fontWeight="bold">
                    Pendiente: {fmt(total)}
                  </Typography>
                </Box>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Período</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Departamento</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Monto</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map(item => (
                        <TableRow
                          key={item.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate('/expensas')}
                        >
                          <TableCell>
                            {MESES[(item.periodos_expensas?.mes ?? 1) - 1]} {item.periodos_expensas?.anio}
                          </TableCell>
                          <TableCell>
                            <Chip label={item.departamentos?.numeracion ?? '-'} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{fmt(item.monto_total ?? 0)}</TableCell>
                          <TableCell align="center">
                            <Chip label="PENDIENTE" size="small" color="warning" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))
          )}
        </>
      )}
    </Box>
  )
}
