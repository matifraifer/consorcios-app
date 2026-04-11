import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MorososCriticosTable({ items }) {
  return (
    <Paper variant="outlined">
      <Box px={3} pt={2.5} pb={1}>
        <Typography variant="h6" fontWeight="bold">Top 10 morosos criticos</Typography>
        <Typography variant="body2" color="text.secondary">
          Departamentos con mayor saldo pendiente en los períodos seleccionados.
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Departamento</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Consorcio</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Período</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Saldo pendiente</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Sin deuda registrada.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.departamentos?.numeracion ?? '—'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{item.periodo?.consorcios?.nombre ?? '—'}</TableCell>
                  <TableCell>
                    {item.periodo?.mes && item.periodo?.anio
                      ? `${MESES[(item.periodo.mes ?? 1) - 1]} ${item.periodo.anio}`
                      : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    {fmt(item.saldo)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
