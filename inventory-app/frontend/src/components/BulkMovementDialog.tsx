import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload,
  GetApp,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { movementsService } from '../services/movements.service';

const MOVEMENT_TYPES = [
  { value: 'entrada', label: 'Entrada (agregar stock)' },
  { value: 'salida', label: 'Salida (retirar stock)' },
];

const TEMPLATE_COLUMNS = [
  { key: 'codigo', label: 'codigo', required: true, example: 'RES-001' },
  { key: 'cantidad', label: 'cantidad', required: true, example: '10' },
  { key: 'costo_unitario', label: 'costo_unitario', required: false, example: '1500' },
  { key: 'referencia', label: 'referencia', required: false, example: 'OC-2024-001' },
  { key: 'notas', label: 'notas', required: false, example: 'Compra proveedor X' },
];

interface ParsedRow {
  codigo: string;
  cantidad: number;
  costo_unitario?: number;
  referencia?: string;
  notas?: string;
  _row: number;
  _error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Configurar', 'Cargar archivo', 'Revisar y confirmar'];

export default function BulkMovementDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [movementType, setMovementType] = useState('entrada');
  const [globalReference, setGlobalReference] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [result, setResult] = useState<any>(null);

  const bulkMutation = useMutation({
    mutationFn: movementsService.createBulkMovements,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['components-list'] });
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || error.message);
    },
  });

  const handleClose = () => {
    setStep(0);
    setMovementType('entrada');
    setGlobalReference('');
    setGlobalNotes('');
    setParsedRows([]);
    setFileName('');
    setUploadError('');
    setResult(null);
    onClose();
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Fila de encabezados
    const headers = TEMPLATE_COLUMNS.map(c => c.label);
    // Filas de ejemplo
    const exampleRows = [
      ['RES-001', 10, 1500, 'OC-2024-001', 'Ejemplo entrada'],
      ['CAP-100', 50, 200, 'OC-2024-001', ''],
      ['LED-5MM', 100, '', '', ''],
    ];

    const wsData = [headers, ...exampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 18 }, // codigo
      { wch: 12 }, // cantidad
      { wch: 16 }, // costo_unitario
      { wch: 18 }, // referencia
      { wch: 30 }, // notas
    ];

    // Estilo de encabezado (nota: xlsx community edition no soporta estilos completos, usamos comentario)
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

    // Segunda hoja con instrucciones
    const instrData = [
      ['INSTRUCCIONES DE USO'],
      [''],
      ['Campo', 'Requerido', 'Descripción'],
      ['codigo', 'SÍ', 'Código exacto del componente en el sistema'],
      ['cantidad', 'SÍ', 'Cantidad a mover (número positivo)'],
      ['costo_unitario', 'NO', 'Costo por unidad (solo aplica para entradas)'],
      ['referencia', 'NO', 'Número de orden, factura u otra referencia'],
      ['notas', 'NO', 'Observaciones adicionales para este componente'],
      [''],
      ['NOTAS IMPORTANTES:'],
      ['- No modificar los nombres de las columnas'],
      ['- El código del componente debe existir en el sistema'],
      ['- La cantidad debe ser un número mayor a cero'],
      ['- Para salidas: no se puede retirar más stock del disponible'],
      ['- Elimine las filas de ejemplo antes de cargar'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    XLSX.writeFile(wb, `plantilla_movimientos_${movementType}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) {
          setUploadError('El archivo está vacío o no tiene filas de datos');
          return;
        }

        // Normalizar encabezados
        const headers: string[] = (raw[0] as any[]).map((h: any) =>
          String(h).trim().toLowerCase().replace(/\s+/g, '_')
        );

        const codigoIdx = headers.indexOf('codigo');
        const cantidadIdx = headers.indexOf('cantidad');
        const costoIdx = headers.indexOf('costo_unitario');
        const refIdx = headers.indexOf('referencia');
        const notasIdx = headers.indexOf('notas');

        if (codigoIdx === -1 || cantidadIdx === -1) {
          setUploadError('El archivo no tiene las columnas requeridas "codigo" y "cantidad"');
          return;
        }

        const rows: ParsedRow[] = [];

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i] as any[];
          const codigo = String(row[codigoIdx] || '').trim();
          const cantidadRaw = row[cantidadIdx];

          // Saltar filas vacías
          if (!codigo && !cantidadRaw) continue;

          const cantidad = parseFloat(String(cantidadRaw));
          let rowError: string | undefined;

          if (!codigo) rowError = 'Código vacío';
          else if (isNaN(cantidad) || cantidad <= 0) rowError = 'Cantidad inválida';

          rows.push({
            codigo,
            cantidad: isNaN(cantidad) ? 0 : cantidad,
            costo_unitario: costoIdx >= 0 && row[costoIdx] !== '' ? parseFloat(String(row[costoIdx])) : undefined,
            referencia: refIdx >= 0 ? String(row[refIdx] || '').trim() || undefined : undefined,
            notas: notasIdx >= 0 ? String(row[notasIdx] || '').trim() || undefined : undefined,
            _row: i + 1,
            _error: rowError,
          });
        }

        if (rows.length === 0) {
          setUploadError('No se encontraron filas de datos en el archivo');
          return;
        }

        setParsedRows(rows);
        setStep(2);
      } catch {
        setUploadError('Error al leer el archivo. Asegúrese de que es un archivo Excel (.xlsx o .xls) válido');
      }
    };
    reader.readAsBinaryString(file);

    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const validRows = parsedRows.filter(r => !r._error);
  const invalidRows = parsedRows.filter(r => r._error);

  const handleConfirm = () => {
    if (validRows.length === 0) return;

    bulkMutation.mutate({
      type: movementType,
      reference_number: globalReference || undefined,
      notes: globalNotes || undefined,
      items: validRows.map(r => ({
        component_code: r.codigo,
        quantity: r.cantidad,
        unit_cost: r.costo_unitario,
        notes: r.notas || r.referencia || undefined,
      })),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Carga Masiva de Movimientos</DialogTitle>
      <DialogContent>
        <Stepper activeStep={result ? 3 : step} sx={{ mb: 3, mt: 1 }}>
          {STEPS.map(label => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {/* PASO 0: Configurar tipo */}
        {step === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Seleccione el tipo de movimiento y descargue la plantilla Excel. Luego llénela con los
              componentes y cantidades, y cárguela en el siguiente paso.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Tipo de Movimiento"
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                >
                  {MOVEMENT_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Referencia global (opcional)"
                  placeholder="Ej: OC-2024-001"
                  value={globalReference}
                  onChange={(e) => setGlobalReference(e.target.value)}
                  helperText="Se aplica a todos los movimientos si no tienen referencia propia"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas globales (opcional)"
                  placeholder="Notas que aplican a todos los movimientos"
                  value={globalNotes}
                  onChange={(e) => setGlobalNotes(e.target.value)}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>Columnas de la plantilla:</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Columna</TableCell>
                      <TableCell>Requerida</TableCell>
                      <TableCell>Ejemplo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {TEMPLATE_COLUMNS.map(col => (
                      <TableRow key={col.key}>
                        <TableCell><code>{col.label}</code></TableCell>
                        <TableCell>
                          <Chip
                            label={col.required ? 'Sí' : 'No'}
                            color={col.required ? 'error' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{col.example}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        )}

        {/* PASO 1: Cargar archivo */}
        {step === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Cargue la plantilla Excel diligenciada. El archivo debe tener los encabezados exactos:
              <strong> codigo, cantidad, costo_unitario, referencia, notas</strong>
            </Typography>

            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError('')}>
                {uploadError}
              </Alert>
            )}

            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6">
                {fileName ? fileName : 'Haga clic para seleccionar el archivo'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Formatos aceptados: .xlsx, .xls
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </Box>
          </Box>
        )}

        {/* PASO 2: Revisar */}
        {step === 2 && !result && (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${validRows.length} filas válidas`}
                color="success"
              />
              {invalidRows.length > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${invalidRows.length} filas con error (se omitirán)`}
                  color="error"
                />
              )}
              <Chip
                label={movementType === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                color={movementType === 'entrada' ? 'success' : 'error'}
                variant="outlined"
              />
            </Box>

            {invalidRows.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Las siguientes filas tienen errores y no serán procesadas:
                {invalidRows.map(r => (
                  <div key={r._row}>Fila {r._row}: {r.codigo || '(vacío)'} — {r._error}</div>
                ))}
              </Alert>
            )}

            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError('')}>
                {uploadError}
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Costo Unit.</TableCell>
                    <TableCell>Referencia</TableCell>
                    <TableCell>Notas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow
                      key={row._row}
                      sx={row._error ? { backgroundColor: '#fff3f3' } : undefined}
                    >
                      <TableCell>
                        {row._row}
                        {row._error && (
                          <Typography variant="caption" color="error" display="block">
                            {row._error}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{row.codigo}</TableCell>
                      <TableCell align="right">{row._error ? '-' : row.cantidad}</TableCell>
                      <TableCell align="right">
                        {row.costo_unitario != null ? `$${row.costo_unitario}` : '-'}
                      </TableCell>
                      <TableCell>{row.referencia || globalReference || '-'}</TableCell>
                      <TableCell>{row.notas || globalNotes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* RESULTADO */}
        {result && (
          <Box>
            <Alert
              severity={result.failed === 0 ? 'success' : result.processed > 0 ? 'warning' : 'error'}
              sx={{ mb: 2 }}
            >
              {result.message}
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Errores durante el procesamiento:
                </Typography>
                {result.errors.map((e: any, i: number) => (
                  <Typography key={i} variant="body2" color="error">
                    • {e.component_code}: {e.error}
                  </Typography>
                ))}
              </Box>
            )}

            {result.results && result.results.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Componente</TableCell>
                      <TableCell align="right">Cantidad</TableCell>
                      <TableCell align="right">Costo Total</TableCell>
                      <TableCell align="right">Nuevo Stock</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.results.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{r.component_code}</TableCell>
                        <TableCell>{r.component_name}</TableCell>
                        <TableCell align="right">{r.quantity}</TableCell>
                        <TableCell align="right">${r.total_cost.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Chip label={r.new_stock} size="small" color="primary" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {result ? 'Cerrar' : 'Cancelar'}
        </Button>

        {/* Paso 0 */}
        {step === 0 && (
          <>
            <Button
              startIcon={<GetApp />}
              variant="outlined"
              onClick={downloadTemplate}
            >
              Descargar Plantilla
            </Button>
            <Button variant="contained" onClick={() => setStep(1)}>
              Siguiente
            </Button>
          </>
        )}

        {/* Paso 1 */}
        {step === 1 && (
          <>
            <Button onClick={() => setStep(0)}>Atrás</Button>
            <Button
              startIcon={<GetApp />}
              variant="outlined"
              onClick={downloadTemplate}
            >
              Descargar Plantilla
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar Archivo
            </Button>
          </>
        )}

        {/* Paso 2 */}
        {step === 2 && !result && (
          <>
            <Button
              onClick={() => {
                setParsedRows([]);
                setFileName('');
                setUploadError('');
                setStep(1);
              }}
            >
              Cargar otro archivo
            </Button>
            <Button
              variant="contained"
              color={movementType === 'entrada' ? 'success' : 'error'}
              onClick={handleConfirm}
              disabled={validRows.length === 0 || bulkMutation.isPending}
              startIcon={bulkMutation.isPending ? <CircularProgress size={18} /> : undefined}
            >
              {bulkMutation.isPending
                ? 'Procesando...'
                : `Confirmar ${validRows.length} movimiento${validRows.length !== 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
