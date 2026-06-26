import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  Box, Typography, TextField, Button, IconButton, Select, MenuItem,
  FormControl, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import AddIcon              from '@mui/icons-material/Add'
import PictureAsPdfIcon     from '@mui/icons-material/PictureAsPdf'
import ImageIcon            from '@mui/icons-material/Image'
import VideocamIcon         from '@mui/icons-material/Videocam'
import InsertDriveFileIcon  from '@mui/icons-material/InsertDriveFile'
import DownloadIcon         from '@mui/icons-material/Download'
import EditIcon             from '@mui/icons-material/Edit'
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline'
import CheckIcon            from '@mui/icons-material/Check'
import CloseIcon            from '@mui/icons-material/Close'
import {
  getTiposDocumentacion, getDocumentosRespaldatorios,
  uploadDocumentoRespaldatorio, updateDocumentoRespaldatorio,
  deleteDocumentoRespaldatorio, getDocumentoRespaldatorioUrl,
} from '../services/supabase'

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'
const OTROS        = 'otros'
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'mp4']

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.82rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}
const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function Label({ children, required }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}{required && <Box component="span" sx={{ color: '#EF4444', ml: 0.3 }}>*</Box>}
    </Typography>
  )
}

function FileTypeIcon({ nombre }) {
  const ext = (nombre ?? '').split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <PictureAsPdfIcon sx={{ fontSize: 18, color: '#DC2626', flexShrink: 0 }} />
  if (ext === 'mp4') return <VideocamIcon sx={{ fontSize: 18, color: '#7C3AED', flexShrink: 0 }} />
  if (ext === 'jpg' || ext === 'jpeg') return <ImageIcon sx={{ fontSize: 18, color: '#0284C7', flexShrink: 0 }} />
  return <InsertDriveFileIcon sx={{ fontSize: 18, color: '#9CA3AF', flexShrink: 0 }} />
}

function tipoLabel(item, tipos) {
  if (item.tipo_documentacion_id) return tipos.find(t => t.id === item.tipo_documentacion_id)?.nombre ?? '—'
  return item.tipo_personalizado || 'Otros'
}

function validarForm(f) {
  if (!f.titulo.trim()) return 'El título es obligatorio.'
  if (!f.tipoSel) return 'Seleccioná un tipo de documentación.'
  if (f.tipoSel === OTROS && !f.tipoPersonalizado.trim()) return 'Especificá el tipo personalizado.'
  return null
}

function TipoFields({ tipos, value, onChange, tipoPersonalizado, onTipoPersonalizadoChange }) {
  return (
    <>
      <FormControl fullWidth size="small" sx={{ mb: value === OTROS ? 1 : 0 }}>
        <Select value={value} displayEmpty onChange={e => onChange(e.target.value)} sx={selectSx}>
          <MenuItem value="" disabled sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Seleccionar tipo</MenuItem>
          {tipos.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.82rem' }}>{t.nombre}</MenuItem>)}
          <MenuItem value={OTROS} sx={{ fontSize: '0.82rem' }}>Otros</MenuItem>
        </Select>
      </FormControl>
      {value === OTROS && (
        <TextField
          fullWidth size="small" placeholder="Especificar tipo..."
          value={tipoPersonalizado} onChange={e => onTipoPersonalizadoChange(e.target.value)}
          sx={fieldSx}
        />
      )}
    </>
  )
}

const DocumentacionRespaldatoriaSection = forwardRef(function DocumentacionRespaldatoriaSection(
  { clienteId, entidadTipo, entidadId, inmediato = false, title = 'Documentación respaldatoria' }, ref
) {
  const [tipos, setTipos]           = useState([])
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading]       = useState(false)

  const [pickedFile, setPickedFile] = useState(null)
  const [pickForm, setPickForm]     = useState({ titulo: '', tipoSel: '', tipoPersonalizado: '' })
  const [pickError, setPickError]   = useState(null)
  const [pickSaving, setPickSaving] = useState(false)
  const [fileError, setFileError]   = useState(null)

  const [editingKey, setEditingKey] = useState(null)
  const [editForm, setEditForm]     = useState({ titulo: '', tipoSel: '', tipoPersonalizado: '' })
  const [editError, setEditError]   = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget]   = useState(null)
  const [deleteSaving, setDeleteSaving]   = useState(false)
  const [deleteError, setDeleteError]     = useState(null)
  const [downloadingKey, setDownloadingKey] = useState(null)

  const fileInputRef  = useRef(null)
  const toDeleteRef    = useRef([])

  useEffect(() => {
    if (!clienteId) return
    getTiposDocumentacion(clienteId).then(setTipos).catch(() => setTipos([]))
  }, [clienteId])

  useEffect(() => {
    toDeleteRef.current = []
    setDocumentos([])
    setPickedFile(null)
    setEditingKey(null)
    if (entidadId) {
      setLoading(true)
      getDocumentosRespaldatorios(entidadTipo, entidadId)
        .then(rows => setDocumentos(rows.map(r => ({
          kind: 'existing', key: `e-${r.id}`, id: r.id, storage_path: r.storage_path,
          nombre_archivo: r.nombre_archivo, titulo: r.titulo,
          tipo_documentacion_id: r.tipo_documentacion_id, tipo_personalizado: r.tipo_personalizado,
          dirty: false,
        }))))
        .catch(() => setDocumentos([]))
        .finally(() => setLoading(false))
    }
  }, [entidadId, entidadTipo])

  useImperativeHandle(ref, () => ({
    async persist(finalEntidadId) {
      for (const item of toDeleteRef.current) {
        await deleteDocumentoRespaldatorio(item.id, item.storage_path)
      }
      toDeleteRef.current = []
      for (const item of documentos) {
        if (item.kind === 'existing' && item.dirty) {
          await updateDocumentoRespaldatorio(item.id, {
            titulo: item.titulo,
            tipo_documentacion_id: item.tipo_documentacion_id,
            tipo_personalizado: item.tipo_personalizado,
          })
        }
      }
      for (const item of documentos) {
        if (item.kind === 'new') {
          await uploadDocumentoRespaldatorio(clienteId, entidadTipo, finalEntidadId, item.file, {
            titulo: item.titulo,
            tipo_documentacion_id: item.tipo_documentacion_id,
            tipo_personalizado: item.tipo_personalizado,
          })
        }
      }
    },
  }), [documentos, clienteId, entidadTipo])

  function handleFileSelected(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      setFileError(`Formato no permitido (.${ext}). Solo se aceptan PDF, JPG/JPEG y MP4.`)
      return
    }
    setFileError(null)
    setPickedFile(file)
    setPickForm({ titulo: file.name, tipoSel: '', tipoPersonalizado: '' })
    setPickError(null)
  }

  async function confirmAdd() {
    const err = validarForm(pickForm)
    if (err) { setPickError(err); return }
    const meta = {
      titulo: pickForm.titulo.trim(),
      tipo_documentacion_id: pickForm.tipoSel === OTROS ? null : pickForm.tipoSel,
      tipo_personalizado: pickForm.tipoSel === OTROS ? pickForm.tipoPersonalizado.trim() : null,
    }

    if (inmediato && entidadId) {
      setPickSaving(true)
      try {
        const saved = await uploadDocumentoRespaldatorio(clienteId, entidadTipo, entidadId, pickedFile, meta)
        setDocumentos(prev => [...prev, {
          kind: 'existing', key: `e-${saved.id}`, id: saved.id, storage_path: saved.storage_path,
          nombre_archivo: saved.nombre_archivo, titulo: saved.titulo,
          tipo_documentacion_id: saved.tipo_documentacion_id, tipo_personalizado: saved.tipo_personalizado,
          dirty: false,
        }])
        setPickedFile(null)
        setPickError(null)
      } catch (e) {
        setPickError(e.message)
      } finally {
        setPickSaving(false)
      }
      return
    }

    setDocumentos(prev => [...prev, {
      kind: 'new', key: `n-${Date.now()}-${Math.random()}`,
      file: pickedFile, nombre_archivo: pickedFile.name,
      ...meta,
    }])
    setPickedFile(null)
    setPickError(null)
  }

  function cancelPick() {
    setPickedFile(null)
    setPickError(null)
  }

  function startEdit(item) {
    setEditingKey(item.key)
    setEditForm({
      titulo: item.titulo,
      tipoSel: item.tipo_documentacion_id ?? (item.tipo_personalizado ? OTROS : ''),
      tipoPersonalizado: item.tipo_personalizado ?? '',
    })
    setEditError(null)
  }

  async function saveEdit(item) {
    const err = validarForm(editForm)
    if (err) { setEditError(err); return }
    const meta = {
      titulo: editForm.titulo.trim(),
      tipo_documentacion_id: editForm.tipoSel === OTROS ? null : editForm.tipoSel,
      tipo_personalizado: editForm.tipoSel === OTROS ? editForm.tipoPersonalizado.trim() : null,
    }

    if (inmediato && item.kind === 'existing') {
      setEditSaving(true)
      try {
        await updateDocumentoRespaldatorio(item.id, meta)
        setDocumentos(prev => prev.map(d => d.key === item.key ? { ...d, ...meta, dirty: false } : d))
        setEditingKey(null)
      } catch (e) {
        setEditError(e.message)
      } finally {
        setEditSaving(false)
      }
      return
    }

    setDocumentos(prev => prev.map(d => d.key === item.key ? {
      ...d, ...meta,
      dirty: d.kind === 'existing' ? true : d.dirty,
    } : d))
    setEditingKey(null)
  }

  async function confirmDelete() {
    if (inmediato && deleteTarget.kind === 'existing') {
      setDeleteSaving(true)
      try {
        await deleteDocumentoRespaldatorio(deleteTarget.id, deleteTarget.storage_path)
        setDocumentos(prev => prev.filter(d => d.key !== deleteTarget.key))
        setDeleteTarget(null)
        setDeleteError(null)
      } catch (e) {
        setDeleteError(e.message)
      } finally {
        setDeleteSaving(false)
      }
      return
    }

    if (deleteTarget.kind === 'existing') toDeleteRef.current.push(deleteTarget)
    setDocumentos(prev => prev.filter(d => d.key !== deleteTarget.key))
    setDeleteTarget(null)
  }

  async function handleDownload(item) {
    setDownloadingKey(item.key)
    try {
      const url = await getDocumentoRespaldatorioUrl(item.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // silencioso
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <Box>
      <input ref={fileInputRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.mp4" onChange={handleFileSelected} />

      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 3, mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>
          {title}
        </Typography>
        {!pickedFile && (
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{ bgcolor: ACCENT, color: 'white', width: 24, height: 24, '&:hover': { bgcolor: '#047857' } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {pickedFile ? (
        <Box sx={{ border: '1px solid #A7F3D0', bgcolor: ACCENT_LIGHT, borderRadius: '10px', p: 1.75, mb: 1.5 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1.25}>
            <FileTypeIcon nombre={pickedFile.name} />
            <Typography sx={{ fontSize: '0.8rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pickedFile.name}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', flexShrink: 0 }}>
              ({(pickedFile.size / 1024).toFixed(0)} KB)
            </Typography>
          </Box>

          <Box mb={1.25}>
            <Label required>Título</Label>
            <TextField fullWidth size="small" value={pickForm.titulo}
              onChange={e => setPickForm(p => ({ ...p, titulo: e.target.value }))} sx={fieldSx} />
          </Box>

          <Box mb={1.25}>
            <Label required>Tipo de documentación</Label>
            <TipoFields
              tipos={tipos}
              value={pickForm.tipoSel}
              onChange={v => setPickForm(p => ({ ...p, tipoSel: v }))}
              tipoPersonalizado={pickForm.tipoPersonalizado}
              onTipoPersonalizadoChange={v => setPickForm(p => ({ ...p, tipoPersonalizado: v }))}
            />
          </Box>

          {pickError && <Alert severity="error" sx={{ mb: 1.25, borderRadius: '8px', fontSize: '0.78rem' }}>{pickError}</Alert>}

          <Box display="flex" gap={1}>
            <Button size="small" onClick={confirmAdd} disabled={pickSaving}
              startIcon={pickSaving ? <CircularProgress size={12} color="inherit" /> : null}
              sx={{ bgcolor: ACCENT, color: 'white', borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}>
              {pickSaving ? 'Subiendo...' : 'Agregar'}
            </Button>
            <Button size="small" variant="outlined" onClick={cancelPick} disabled={pickSaving}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.78rem', borderColor: '#E5E7EB', color: '#6B7280' }}>
              Cancelar
            </Button>
          </Box>
        </Box>
      ) : null}

      {fileError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.78rem' }} onClose={() => setFileError(null)}>{fileError}</Alert>}

      {loading ? (
        <Box display="flex" alignItems="center" gap={1} py={1}>
          <CircularProgress size={14} sx={{ color: ACCENT }} />
          <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Cargando documentos...</Typography>
        </Box>
      ) : documentos.length === 0 ? (
        <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Sin documentos adjuntos.</Typography>
      ) : (
        <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
          {documentos.map((item, i) => (
            editingKey === item.key ? (
              <Box key={item.key} sx={{ p: 1.5, borderBottom: i < documentos.length - 1 ? '1px solid #F3F4F6' : 'none', bgcolor: '#F9FAFB' }}>
                <Box mb={1}>
                  <Label required>Título</Label>
                  <TextField fullWidth size="small" value={editForm.titulo}
                    onChange={e => setEditForm(p => ({ ...p, titulo: e.target.value }))} sx={fieldSx} />
                </Box>
                <Box mb={1}>
                  <Label required>Tipo de documentación</Label>
                  <TipoFields
                    tipos={tipos}
                    value={editForm.tipoSel}
                    onChange={v => setEditForm(p => ({ ...p, tipoSel: v }))}
                    tipoPersonalizado={editForm.tipoPersonalizado}
                    onTipoPersonalizadoChange={v => setEditForm(p => ({ ...p, tipoPersonalizado: v }))}
                  />
                </Box>
                {editError && <Alert severity="error" sx={{ mb: 1, borderRadius: '8px', fontSize: '0.78rem' }}>{editError}</Alert>}
                <Box display="flex" gap={1}>
                  <Button size="small" disabled={editSaving}
                    startIcon={editSaving ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
                    onClick={() => saveEdit(item)}
                    sx={{ bgcolor: ACCENT, color: 'white', borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.76rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}>
                    {editSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button size="small" variant="outlined" disabled={editSaving} startIcon={<CloseIcon sx={{ fontSize: 14 }} />} onClick={() => setEditingKey(null)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.76rem', borderColor: '#E5E7EB', color: '#6B7280' }}>
                    Cancelar
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box key={item.key} sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.1,
                borderBottom: i < documentos.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <FileTypeIcon nombre={item.nombre_archivo} />
                <Box flex={1} minWidth={0}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.titulo}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.75}>
                    <Box sx={{ px: 0.75, py: 0.1, borderRadius: '5px', bgcolor: '#F3F4F6', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#374151' }}>{tipoLabel(item, tipos)}</Typography>
                    </Box>
                    {item.kind === 'new' && (
                      <Typography sx={{ fontSize: '0.65rem', color: ACCENT, fontStyle: 'italic' }}>Pendiente de guardar</Typography>
                    )}
                  </Box>
                </Box>
                {item.kind === 'existing' && (
                  <IconButton size="small" onClick={() => handleDownload(item)} disabled={downloadingKey === item.key}
                    sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT }, flexShrink: 0 }}>
                    {downloadingKey === item.key ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                )}
                <IconButton size="small" onClick={() => startEdit(item)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT }, flexShrink: 0 }}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
                <IconButton size="small" onClick={() => { setDeleteTarget(item); setDeleteError(null) }} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' }, flexShrink: 0 }}>
                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            )
          ))}
        </Box>
      )}

      <Dialog open={!!deleteTarget} onClose={() => !deleteSaving && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Eliminar documento</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: '#374151' }}>
            ¿Estás seguro que deseas eliminar <strong>{deleteTarget?.titulo}</strong>? Esta acción no se puede deshacer.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5, borderRadius: '8px', fontSize: '0.78rem' }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteSaving} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>
            Cancelar
          </Button>
          <Button onClick={confirmDelete} disabled={deleteSaving} variant="contained"
            startIcon={deleteSaving ? <CircularProgress size={12} color="inherit" /> : null}
            sx={{ textTransform: 'none', borderRadius: '8px', bgcolor: '#EF4444', boxShadow: 'none', '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' } }}>
            {deleteSaving ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
})

export default DocumentacionRespaldatoriaSection
