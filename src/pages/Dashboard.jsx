import { useEffect, useState, useMemo } from 'react'
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { getDashboardDeuda, getCRMDashboardData } from '../services/supabase'
import DashboardFiltros from '../components/dashboard/DashboardFiltros'
import DashboardKPIs from '../components/dashboard/DashboardKPIs'
import DeudaPorConsorcioTable from '../components/dashboard/DeudaPorConsorcioTable'
import CRMSection from '../components/dashboard/CRMSection'

export default function Dashboard() {
  const { clienteId } = useAuth()

  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [crmData, setCrmData] = useState({ prospectos: [], etapas: [], visitas: [] })

  // Filtros
  const [filtroConsorcio, setFiltroConsorcio] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    Promise.all([
      getDashboardDeuda(clienteId),
      getCRMDashboardData(clienteId),
    ])
      .then(([{ items }, crm]) => {
        setAllItems(items)
        setCrmData(crm)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  // Opciones únicas de consorcio
  const consorcioOptions = useMemo(() => {
    const seen = new Map()
    allItems.forEach(item => {
      const id = item.periodo?.consorcio_id
      const nombre = item.periodo?.consorcios?.nombre
      if (id && !seen.has(id)) seen.set(id, nombre)
    })
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [allItems])

  // Opciones únicas de período (ordenadas desc)
  const periodoOptions = useMemo(() => {
    const seen = new Set()
    const result = []
    allItems.forEach(item => {
      const key = `${item.periodo?.mes}-${item.periodo?.anio}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ key, mes: item.periodo?.mes, anio: item.periodo?.anio })
      }
    })
    return result.sort((a, b) => b.anio - a.anio || b.mes - a.mes)
  }, [allItems])

  // Últimos 3 períodos (default cuando no hay filtro de período activo)
  const last3PeriodKeys = useMemo(
    () => periodoOptions.slice(0, 3).map(p => p.key),
    [periodoOptions]
  )

  // Items filtrados
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const key = `${item.periodo?.mes}-${item.periodo?.anio}`
      const consorcioId = item.periodo?.consorcio_id
      const montoPagado = Number(item.monto_pagado ?? 0)
      const estado = montoPagado > 0 ? 'parcial' : 'pendiente'

      const matchPeriodo = filtroPeriodo ? key === filtroPeriodo : last3PeriodKeys.includes(key)
      const matchConsorcio = !filtroConsorcio || consorcioId === filtroConsorcio
      const matchEstado = !filtroEstado || estado === filtroEstado

      return matchPeriodo && matchConsorcio && matchEstado
    })
  }, [allItems, filtroPeriodo, filtroConsorcio, filtroEstado, last3PeriodKeys])

  // KPIs calculados desde filteredItems
  const kpis = useMemo(() => {
    const totalAdeudado = filteredItems.reduce((s, i) => s + i.saldo, 0)
    const deptosMorosos = new Set(filteredItems.map(i => i.departamento_id)).size
    const consorciosMorosos = new Set(filteredItems.map(i => i.periodo?.consorcio_id)).size

    let periodoMasAtrasado = null
    filteredItems.forEach(item => {
      const { mes, anio } = item.periodo ?? {}
      if (
        !periodoMasAtrasado ||
        anio < periodoMasAtrasado.anio ||
        (anio === periodoMasAtrasado.anio && mes < periodoMasAtrasado.mes)
      ) {
        periodoMasAtrasado = { mes, anio }
      }
    })

    return { totalAdeudado, deptosMorosos, consorciosMorosos, periodoMasAtrasado }
  }, [filteredItems])

  // Tabla agrupada por consorcio + período
  const deudaPorConsorcio = useMemo(() => {
    const map = new Map()
    filteredItems.forEach(item => {
      const key = `${item.periodo?.consorcio_id}-${item.periodo_id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          periodo_id: item.periodo_id,
          consorcio_id: item.periodo?.consorcio_id,
          nombre: item.periodo?.consorcios?.nombre,
          mes: item.periodo?.mes,
          anio: item.periodo?.anio,
          totalAdeudado: 0,
          _deptos: new Set(),
        })
      }
      const entry = map.get(key)
      entry.totalAdeudado += item.saldo
      entry._deptos.add(item.departamento_id)
    })

    return Array.from(map.values())
      .map(e => ({ ...e, deptosMorosos: e._deptos.size }))
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes || b.totalAdeudado - a.totalAdeudado)
  }, [filteredItems])

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box sx={{ pb: 6 }}>
      {/* Dashboard de cobranzas — oculto temporalmente */}
      {/* <Box mb={4}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#065F46',
            mb: 0.5,
          }}
        >
          Resumen ejecutivo
        </Typography>
        <Typography
          sx={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Dashboard de cobranzas
        </Typography>
      </Box>

      <DashboardFiltros
        consorcioOptions={consorcioOptions}
        periodoOptions={periodoOptions}
        filtroConsorcio={filtroConsorcio}
        filtroPeriodo={filtroPeriodo}
        filtroEstado={filtroEstado}
        onChangeConsorcio={setFiltroConsorcio}
        onChangePeriodo={setFiltroPeriodo}
        onChangeEstado={setFiltroEstado}
      />

      <DashboardKPIs kpis={kpis} />

      <DeudaPorConsorcioTable rows={deudaPorConsorcio} />

      <Divider sx={{ my: 6, borderColor: '#F3F4F6' }} /> */}

      <CRMSection
        prospectos={crmData.prospectos}
        etapas={crmData.etapas}
        visitas={crmData.visitas}
      />
    </Box>
  )
}
