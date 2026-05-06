import { useEffect, useState } from 'react'
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, TextField, Select, MenuItem, FormControl,
  CircularProgress, Alert, Divider, Tabs, Tab, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'
import { upsertIndice, deleteIndice } from '../../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const TIPOS = ['IPC', 'ICL']
const MESES_LABEL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function IndiceRow({ indice, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(indice.valor))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!val || isNaN(Number(val))) return
    setSaving(true)
    try {
      const updated = await upsertIndice({ tipo: indice.tipo, mes: indice.mes, anio: indice.anio, valor: Number(val), clienteId: indice.cliente_id })
      onUpdate(updated)
      setEditing(false)
    } catch {
      // keep editing open
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteIndice(indice.id)
      onDelete(indice.id)
    } catch {
      // ignore
    }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', px: 1.5, py: 0.75, bgcolor: '#FAFAFA' }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', minWidth: 80 }}>
          {MESES_SHORT[indice.mes - 1]} {indice.anio}
        </Typography>
        {editing ? (
          <TextField
            autoFocus size="small" type="number" value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setVal(String(indice.valor)) } }}
            sx={{ width: 100, ...fieldSx }}
            slotProps={{ input: { endAdornment: <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', mr: 0.5 }}>%</Typography> } }}
          />
        ) : (
          <Typography
            onClick={() => setEditing(true)}
            sx={{ fontSize: '0.82rem', color: '#374151', cursor: 'pointer', px: 1, py: 0.3, borderRadius: '6px', '&:hover': { bgcolor: '#F3F4F6' } }}
          >
            {Number(indice.valor).toFixed(2)}%
          </Typography>
        )}
      </Box>
      <Box display="flex">
        {editing && (
          <Tooltip title="Guardar">
            <IconButton size="small" onClick={handleSave} disabled={saving} sx={{ color: ACCENT }}>
              {saving ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={handleDelete} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

export default function IndicesDialog({ open, onClose, indices, onIndicesChange, clienteId }) {
  const [tab, setTab] = useState(0)
  const [newMes, setNewMes] = useState(new Date().getMonth() + 1)
  const [newAnio, setNewAnio] = useState(currentYear)
  const [newValor, setNewValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const tipo = TIPOS[tab]

  const filtered = indices
    .filter(i => i.tipo === tipo)
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)

  function handleUpdate(updated) {
    onIndicesChange(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  function handleDelete(id) {
    onIndicesChange(prev => prev.filter(i => i.id !== id))
  }

  async function handleAdd() {
    if (!newValor || isNaN(Number(newValor))) { setError('Ingrese un valor válido.'); return }
    setError(null)
    setSaving(true)
    try {
      const nuevo = await upsertIndice({ tipo, mes: newMes, anio: newAnio, valor: Number(newValor), clienteId })
      onIndicesChange(prev => {
        const exists = prev.findIndex(i => i.tipo === tipo && i.mes === newMes && i.anio === newAnio)
        if (exists >= 0) {
          return prev.map((i, idx) => idx === exists ? nuevo : i)
        }
        return [...prev, nuevo]
      })
      setNewValor('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Índices de actualización</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 0.3 }}>
            Variación mensual en porcentaje (%). Haz clic en un valor para editarlo.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#9CA3AF' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 3, borderBottom: '1px solid #E5E7EB',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', minHeight: 44 },
            '& .MuiTabs-indicator': { bgcolor: ACCENT },
            '& .Mui-selected': { color: `${ACCENT} !important` },
          }}
        >
          {TIPOS.map(t => <Tab key={t} label={t} />)}
        </Tabs>

        <Box sx={{ px: 3, py: 2 }}>
          {/* Agregar nuevo */}
          <Box display="flex" gap={1} alignItems="flex-end" mb={2}>
            <Box flex={1}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Mes</Typography>
              <FormControl fullWidth size="small">
                <Select value={newMes} onChange={e => setNewMes(e.target.value)} sx={selectSx}>
                  {MESES_LABEL.map((m, i) => <MenuItem key={i} value={i + 1} sx={{ fontSize: '0.875rem' }}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box flex={1}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Año</Typography>
              <FormControl fullWidth size="small">
                <Select value={newAnio} onChange={e => setNewAnio(e.target.value)} sx={selectSx}>
                  {YEARS.map(y => <MenuItem key={y} value={y} sx={{ fontSize: '0.875rem' }}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box flex={1}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Valor (%)</Typography>
              <TextField
                fullWidth size="small" type="number" value={newValor}
                onChange={e => setNewValor(e.target.value)}
                placeholder="ej. 8.4"
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                sx={fieldSx}
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <AddIcon sx={{ fontSize: 16 }} />}
              sx={{ bgcolor: ACCENT, textTransform: 'none', borderRadius: '8px', fontWeight: 600, boxShadow: 'none', whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
            >
              Agregar
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.78rem', py: 0.5 }}>{error}</Alert>}

          {/* Lista */}
          {filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                No hay índices {tipo} cargados.
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={0.75}>
              {filtered.map(i => (
                <IndiceRow key={i.id} indice={i} onDelete={handleDelete} onUpdate={handleUpdate} />
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280', fontWeight: 600 }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
