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
  Checkbox,
} from '@mui/material';
import {
  CloudUpload,
  GetApp,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { movementsService } from '../services/movements.service';
import { componentsService } from '../services/components.service';
import { unitsService } from '../services/units.service';
import { categoriesService } from '../services/categories.service';
import { recipesService } from '../services/recipes.service';

const MOVEMENT_TYPES = [
  { value: 'entrada', label: 'Entrada (agregar stock)' },
  { value: 'salida', label: 'Salida (retirar stock)' },
];

const TEMPLATE_COLUMNS = [
  { key: 'codigo', label: 'codigo', required: true, example: 'RES-001' },
  { key: 'nombre', label: 'nombre', required: false, example: 'Resistencia 1kΩ' },
  { key: 'cantidad', label: 'cantidad', required: true, example: '10' },
  { key: 'costo_unitario', label: 'costo_unitario', required: false, example: '1500' },
  { key: 'referencia', label: 'referencia', required: false, example: 'OC-2024-001' },
  { key: 'notas', label: 'notas', required: false, example: 'Compra proveedor X' },
];

interface ParsedRow {
  codigo: string;
  nombre?: string;
  cantidad: number;
  costo_unitario?: number;
  referencia?: string;
  notas?: string;
  _row: number;
  _error?: string;
}

interface ValidationResult {
  code: string;
  found: boolean;
  component?: { id: string; code: string; name: string; unit_id: string };
  matchType?: 'code' | 'name';
  nombre?: string;
}

interface MissingForm {
  selected: boolean;
  nombre: string;
  unit_id: string;
  category_id: string;
}

interface StockError {
  component_code: string;
  component_name?: string;
  available_stock: number;
  requested_quantity: number;
  error: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Configurar', 'Cargar archivo', 'Validar componentes', 'Revisar y confirmar'];

export default function BulkMovementDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [movementType, setMovementType] = useState('entrada');
  const [globalReference, setGlobalReference] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedRecipeName, setSelectedRecipeName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [missingForms, setMissingForms] = useState<Record<string, MissingForm>>({});
  const [isCreatingComponents, setIsCreatingComponents] = useState(false);
  const [createError, setCreateError] = useState('');
  const [stockErrors, setStockErrors] = useState<StockError[] | null>(null);

  const { data: unitsData } = useQuery({
    queryKey: ['units'],
    queryFn: unitsService.getUnits,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.getCategories,
  });

  const { data: recipesData } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipesService.getRecipes({ is_active: true }),
    enabled: open,
  });

  const bulkMutation = useMutation({
    mutationFn: movementsService.createBulkMovements,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['components-list'] });
      if (selectedRecipeId) {
        queryClient.invalidateQueries({ queryKey: ['recipe-movements', selectedRecipeId] });
      }
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      const errors: StockError[] = errData?.errors;
      if (errors?.length > 0) {
        setStockErrors(errors);
      } else {
        setUploadError(errData?.error || error.message);
      }
    },
  });

  const handleClose = () => {
    setStep(0);
    setMovementType('entrada');
    setGlobalReference('');
    setGlobalNotes('');
    setSelectedRecipeId('');
    setSelectedRecipeName('');
    setParsedRows([]);
    setFileName('');
    setUploadError('');
    setResult(null);
    setValidationResults([]);
    setIsValidating(false);
    setMissingForms({});
    setIsCreatingComponents(false);
    setCreateError('');
    setStockErrors(null);
    onClose();
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const headers = TEMPLATE_COLUMNS.map(c => c.label);
    const exampleRows = [
      ['RES-001', 'Resistencia 1kΩ', 10, 1500, 'OC-2024-001', 'Ejemplo entrada'],
      ['CAP-100', 'Capacitor 100uF', 50, 200, 'OC-2024-001', ''],
      ['LED-5MM', 'LED Rojo 5mm', 100, '', '', ''],
    ];

    const wsData = [headers, ...exampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 18 }, // codigo
      { wch: 28 }, // descripcion
      { wch: 12 }, // cantidad
      { wch: 16 }, // costo_unitario
      { wch: 18 }, // referencia
      { wch: 30 }, // notas
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

    const instrData = [
      ['INSTRUCCIONES DE USO'],
      [''],
      ['Campo', 'Requerido', 'Descripción'],
      ['codigo', 'SÍ', 'Código del componente en el sistema'],
      ['nombre', 'NO', 'Nombre del componente (se usa para buscarlo o crearlo si no existe)'],
      ['cantidad', 'SÍ', 'Cantidad a mover (número positivo)'],
      ['costo_unitario', 'NO', 'Costo por unidad (solo aplica para entradas)'],
      ['referencia', 'NO', 'Número de orden, factura u otra referencia'],
      ['notas', 'NO', 'Observaciones adicionales para este componente'],
      [''],
      ['NOTAS IMPORTANTES:'],
      ['- No modificar los nombres de las columnas'],
      ['- Si el código no existe, se validará también por nombre'],
      ['- Los componentes faltantes se pueden crear antes de registrar el movimiento'],
      ['- La cantidad debe ser un número mayor a cero'],
      ['- Para salidas: no se puede retirar más stock del disponible'],
      ['- Elimine las filas de ejemplo antes de cargar'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    XLSX.writeFile(wb, `plantilla_movimientos_${movementType}.xlsx`);
  };

  const validateComponents = async (rows: ParsedRow[]) => {
    setIsValidating(true);
    setUploadError('');
    setCreateError('');
    try {
      const validItems = rows.filter(r => !r._error && r.codigo);
      const uniqueCodes = Array.from(new Set(validItems.map(r => r.codigo)));
      const items = uniqueCodes.map(code => {
        const row = validItems.find(r => r.codigo === code);
        return { code, nombre: row?.nombre };
      });

      const { results } = await componentsService.validateBulk(items);
      setValidationResults(results);

      // Update codes in rows for found-by-name (use actual component code)
      const codeMap: Record<string, string> = {};
      const forms: Record<string, MissingForm> = {};

      results.forEach(r => {
        if (r.found && r.matchType === 'name' && r.component) {
          codeMap[r.code] = r.component.code;
        } else if (!r.found) {
          forms[r.code] = {
            selected: true,
            nombre: r.nombre || '',
            unit_id: '',
            category_id: '',
          };
        }
      });

      setMissingForms(forms);

      if (Object.keys(codeMap).length > 0) {
        setParsedRows(rows.map(row =>
          codeMap[row.codigo] ? { ...row, codigo: codeMap[row.codigo] } : row
        ));
      }
    } catch {
      setUploadError('Error al validar los componentes contra el sistema. Verifique la conexión.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setFileName(file.name);
    setValidationResults([]);
    setMissingForms({});

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) {
          setUploadError('El archivo está vacío o no tiene filas de datos');
          return;
        }

        const headers: string[] = (raw[0] as any[]).map((h: any) =>
          String(h).trim().toLowerCase().replace(/\s+/g, '_')
        );

        const codigoIdx = headers.indexOf('codigo');
        const cantidadIdx = headers.indexOf('cantidad');
        const nombreIdx = headers.indexOf('nombre');
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

          if (!codigo && !cantidadRaw) continue;

          const cantidad = parseFloat(String(cantidadRaw));
          let rowError: string | undefined;

          if (!codigo) rowError = 'Código vacío';
          else if (isNaN(cantidad) || cantidad <= 0) rowError = 'Cantidad inválida';

          rows.push({
            codigo,
            nombre: nombreIdx >= 0 ? String(row[nombreIdx] || '').trim() || undefined : undefined,
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
        await validateComponents(rows);
      } catch {
        setUploadError('Error al leer el archivo. Asegúrese de que es un archivo Excel (.xlsx o .xls) válido');
      }
    };
    reader.readAsBinaryString(file);

    e.target.value = '';
  };

  const handleCreateAndContinue = async () => {
    const toCreate = Object.entries(missingForms).filter(
      ([, f]) => f.selected
    );

    setIsCreatingComponents(true);
    setCreateError('');

    const errors: string[] = [];
    for (const [code, form] of toCreate) {
      try {
        await componentsService.createComponent({
          code,
          name: form.nombre,
          unit_id: form.unit_id,
          category_id: form.category_id || undefined,
        });
      } catch (err: any) {
        errors.push(`${code}: ${err.response?.data?.error || err.message}`);
      }
    }

    setIsCreatingComponents(false);

    if (errors.length > 0) {
      setCreateError(`Errores al crear componentes: ${errors.join(' | ')}`);
      return;
    }

    if (toCreate.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    }

    // Mark uncreated (unchecked) missing codes as errors so they're excluded from validRows
    const uncreatedCodes = new Set(
      Object.entries(missingForms)
        .filter(([, f]) => !f.selected)
        .map(([code]) => code)
    );

    if (uncreatedCodes.size > 0) {
      setParsedRows(prev => prev.map(row =>
        uncreatedCodes.has(row.codigo)
          ? { ...row, _error: 'Componente no registrado en el sistema' }
          : row
      ));
    }

    setStep(3);
  };

  const validRows = parsedRows.filter(r => !r._error);
  const invalidRows = parsedRows.filter(r => r._error);

  const handleConfirm = () => {
    if (validRows.length === 0) return;

    bulkMutation.mutate({
      type: movementType,
      reference_number: globalReference || undefined,
      notes: globalNotes || undefined,
      recipe_id: selectedRecipeId || undefined,
      recipe_name: selectedRecipeName || undefined,
      items: validRows.map(r => ({
        component_code: r.codigo,
        quantity: r.cantidad,
        unit_cost: r.costo_unitario,
        notes: r.notas || r.referencia || undefined,
      })),
    });
  };

  // Derived validation state
  const foundByCode = validationResults.filter(r => r.found && r.matchType === 'code');
  const foundByName = validationResults.filter(r => r.found && r.matchType === 'name');
  const notFound = validationResults.filter(r => !r.found);
  const allFound = validationResults.length > 0 && notFound.length === 0;
  const selectedToCreate = Object.values(missingForms).filter(f => f.selected).length;
  const hasInvalidForms = Object.values(missingForms).some(
    f => f.selected && (!f.nombre.trim() || !f.unit_id)
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {stockErrors ? 'Componentes sin stock suficiente' : 'Carga Masiva de Movimientos'}
      </DialogTitle>
      <DialogContent>

        {/* VISTA DE STOCK INSUFICIENTE */}
        {stockErrors && (
          <Box>
            <Alert severity="error" sx={{ mb: 2 }}>
              No se creó ningún movimiento. Los siguientes componentes no tienen stock suficiente:
            </Alert>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Componente</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell align="right">Disponible</TableCell>
                    <TableCell align="right">Solicitado</TableCell>
                    <TableCell align="right">Faltante</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockErrors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.component_name || '-'}</TableCell>
                      <TableCell><code>{e.component_code}</code></TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                        {e.available_stock ?? 0}
                      </TableCell>
                      <TableCell align="right">{e.requested_quantity ?? '-'}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                        {e.available_stock != null && e.requested_quantity != null
                          ? `-${e.requested_quantity - e.available_stock}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {!stockErrors && <>
        <Stepper activeStep={result ? 4 : step} sx={{ mb: 3, mt: 1 }}>
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Vincular a receta (opcional)"
                  value={selectedRecipeId}
                  onChange={(e) => {
                    const recipe = recipesData?.recipes?.find((r: any) => r.id === e.target.value);
                    setSelectedRecipeId(e.target.value);
                    setSelectedRecipeName(recipe?.name || '');
                  }}
                  helperText="Los movimientos quedarán vinculados al historial de esta receta"
                >
                  <MenuItem value="">Sin receta</MenuItem>
                  {(recipesData?.recipes || []).map((r: any) => (
                    <MenuItem key={r.id} value={r.id}>{r.code} — {r.name}</MenuItem>
                  ))}
                </TextField>
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
              <strong> codigo, nombre, cantidad, costo_unitario, referencia, notas</strong>
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

        {/* PASO 2: Validar componentes */}
        {step === 2 && (
          <Box>
            {isValidating ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography color="text.secondary">Validando componentes en el sistema...</Typography>
              </Box>
            ) : (
              <>
                {/* Resumen */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {foundByCode.length > 0 && (
                    <Chip
                      icon={<CheckCircle />}
                      label={`${foundByCode.length} encontrado${foundByCode.length !== 1 ? 's' : ''} por código`}
                      color="success"
                      size="small"
                    />
                  )}
                  {foundByName.length > 0 && (
                    <Chip
                      label={`${foundByName.length} encontrado${foundByName.length !== 1 ? 's' : ''} por descripción`}
                      color="warning"
                      size="small"
                    />
                  )}
                  {notFound.length > 0 && (
                    <Chip
                      icon={<ErrorIcon />}
                      label={`${notFound.length} no encontrado${notFound.length !== 1 ? 's' : ''}`}
                      color="error"
                      size="small"
                    />
                  )}
                </Box>

                {allFound && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Todos los componentes están registrados. Puede continuar.
                  </Alert>
                )}

                {/* Encontrados por nombre — se usará su código real */}
                {foundByName.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Componentes encontrados por descripción (se usará su código real):
                    </Typography>
                    {foundByName.map(r => (
                      <Typography key={r.code} variant="body2">
                        • Plantilla: <strong>{r.code}</strong> → Real: <strong>{r.component?.code}</strong> ({r.component?.name})
                      </Typography>
                    ))}
                  </Alert>
                )}

                {/* No encontrados */}
                {notFound.length > 0 && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Componentes no encontrados — seleccione cuáles desea crear:
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox">Crear</TableCell>
                            <TableCell>Código</TableCell>
                            <TableCell>Nombre *</TableCell>
                            <TableCell>Unidad *</TableCell>
                            <TableCell>Categoría</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {notFound.map(r => {
                            const form = missingForms[r.code] ?? {
                              selected: false, nombre: '', unit_id: '', category_id: '',
                            };
                            return (
                              <TableRow key={r.code}>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={form.selected}
                                    onChange={(e) => setMissingForms(prev => ({
                                      ...prev,
                                      [r.code]: { ...form, selected: e.target.checked },
                                    }))}
                                  />
                                </TableCell>
                                <TableCell>
                                  <code>{r.code}</code>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    value={form.nombre}
                                    onChange={(e) => setMissingForms(prev => ({
                                      ...prev,
                                      [r.code]: { ...form, nombre: e.target.value },
                                    }))}
                                    placeholder="Nombre del componente"
                                    disabled={!form.selected}
                                    error={form.selected && !form.nombre.trim()}
                                    sx={{ minWidth: 180 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    select
                                    size="small"
                                    value={form.unit_id}
                                    onChange={(e) => setMissingForms(prev => ({
                                      ...prev,
                                      [r.code]: { ...form, unit_id: e.target.value },
                                    }))}
                                    disabled={!form.selected}
                                    error={form.selected && !form.unit_id}
                                    sx={{ minWidth: 110 }}
                                    SelectProps={{ displayEmpty: true }}
                                  >
                                    <MenuItem value="" disabled>Unidad</MenuItem>
                                    {unitsData?.units.map(u => (
                                      <MenuItem key={u.id} value={u.id}>
                                        {u.name} ({u.symbol})
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    select
                                    size="small"
                                    value={form.category_id}
                                    onChange={(e) => setMissingForms(prev => ({
                                      ...prev,
                                      [r.code]: { ...form, category_id: e.target.value },
                                    }))}
                                    disabled={!form.selected}
                                    sx={{ minWidth: 120 }}
                                    SelectProps={{ displayEmpty: true }}
                                  >
                                    <MenuItem value="">Sin categoría</MenuItem>
                                    {categoriesData?.categories.map(c => (
                                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                                  </TextField>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}

                {uploadError && (
                  <Alert severity="error" sx={{ mb: 1 }} onClose={() => setUploadError('')}>
                    {uploadError}
                  </Alert>
                )}
                {createError && (
                  <Alert severity="error" onClose={() => setCreateError('')}>
                    {createError}
                  </Alert>
                )}
              </>
            )}
          </Box>
        )}

        {/* PASO 3: Revisar */}
        {step === 3 && !result && (
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
                    • {e.component_name ? `${e.component_name} (${e.component_code})` : e.component_code}: {e.error}
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
        </>}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {result || stockErrors ? 'Cerrar' : 'Cancelar'}
        </Button>

        {!stockErrors && <>
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
        {step === 2 && !isValidating && (
          <>
            <Button
              onClick={() => {
                setParsedRows([]);
                setFileName('');
                setUploadError('');
                setValidationResults([]);
                setMissingForms({});
                setStep(1);
              }}
            >
              Cargar otro archivo
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateAndContinue}
              disabled={isCreatingComponents || hasInvalidForms}
              startIcon={isCreatingComponents ? <CircularProgress size={18} /> : undefined}
            >
              {isCreatingComponents
                ? 'Creando componentes...'
                : selectedToCreate > 0
                  ? `Crear ${selectedToCreate} componente${selectedToCreate !== 1 ? 's' : ''} y continuar`
                  : 'Continuar'}
            </Button>
          </>
        )}

        {/* Paso 3 */}
        {step === 3 && !result && (
          <>
            <Button
              onClick={() => {
                setParsedRows([]);
                setFileName('');
                setUploadError('');
                setValidationResults([]);
                setMissingForms({});
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
        </>}
      </DialogActions>
    </Dialog>
  );
}
