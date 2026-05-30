import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  Chip,
  Alert,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add,
  ArrowUpward,
  ArrowDownward,
  Receipt,
  Delete,
  AddCircle,
  DeleteSweep,
  Visibility,
  ExpandMore,
  ExpandLess,
  TableChart,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { movementsService } from '../services/movements.service';
import { componentsService } from '../services/components.service';
import { recipesService } from '../services/recipes.service';
import { authService } from '../services/auth.service';
import BulkMovementDialog from '../components/BulkMovementDialog';

const MOVEMENT_TYPES = [
  { value: 'entrada', label: 'Entrada', operation: 'IN' },
  { value: 'salida', label: 'Salida', operation: 'OUT' },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Movements() {
  const currentUser = authService.getCurrentUser();
  const isViewer = currentUser?.role === 'viewer';
  const isAdmin = currentUser?.role === 'admin';

  const [tabValue, setTabValue] = useState(0);
  const [openMovementDialog, setOpenMovementDialog] = useState(false);
  const [openInvoiceDialog, setOpenInvoiceDialog] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<Array<{
    component_code: string;
    component_name: string;
    quantity: number;
    total_cost: number;
    unit: string;
  }>>([]);
  const [isNewComponent, setIsNewComponent] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [recipeMultiplier, setRecipeMultiplier] = useState(1);
  const [movementItems, setMovementItems] = useState<Array<{
    component_id: string;
    component_code?: string;
    component_name: string;
    quantity: number;
    unit: string;
    cost_price?: number;
  }>>([]);
  const [useRecipe, setUseRecipe] = useState(false);
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [openBulkDialog, setOpenBulkDialog] = useState(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
  const [stockErrorsList, setStockErrorsList] = useState<any[]>([]);
  const [openStockErrorDialog, setOpenStockErrorDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: () => movementsService.getMovements(),
  });

  const { data: componentsData } = useQuery({
    queryKey: ['components-list'],
    queryFn: () => componentsService.getComponents(),
  });

  const { data: recipesData } = useQuery({
    queryKey: ['recipes-list'],
    queryFn: () => recipesService.getRecipes({ is_active: true }),
  });

  const createMovementMutation = useMutation({
    mutationFn: movementsService.createMovement,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['components-list'] });
      setOpenMovementDialog(false);
      resetMovement();
      alert(`Movimiento creado exitosamente. ${response?.message || ''}`);
    },
    onError: (error: any) => {
      console.error('Error al crear movimiento:', error);
      alert(`Error al crear movimiento: ${error.response?.data?.error || error.message}`);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: movementsService.createInvoice,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      queryClient.invalidateQueries({ queryKey: ['components-list'] });
      setOpenInvoiceDialog(false);
      resetInvoice();
      setInvoiceItems([]);
      setSelectedComponent(null);
      setIsNewComponent(false);
      alert(`Factura procesada exitosamente. ${response?.message || 'Movimientos de inventario actualizados.'}`);
    },
    onError: (error: any) => {
      console.error('Error al procesar factura:', error);
      alert(`Error al procesar factura: ${error.response?.data?.error || error.message}`);
    },
  });

  const clearMovementsMutation = useMutation({
    mutationFn: movementsService.clearAllMovements,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      setOpenClearDialog(false);
      alert(response.message || 'Movimientos eliminados exitosamente');
    },
    onError: (error: any) => {
      console.error('Error al limpiar movimientos:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  const {
    register: registerMovement,
    handleSubmit: handleSubmitMovement,
    reset: resetMovement,
    control: controlMovement,
    watch: watchMovement,
    setValue: setValueMovement,
    formState: { errors: movementErrors },
  } = useForm();

  const {
    register: registerInvoice,
    handleSubmit: handleSubmitInvoice,
    reset: resetInvoice,
    watch: watchInvoice,
    formState: { errors: invoiceErrors },
  } = useForm();

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    reset: resetItem,
    formState: { errors: itemErrors },
  } = useForm();

  const selectedComponentId = watchMovement('component_id');
  const selectedMovementTypeValue = watchMovement('type');
  const selectedComponentData = componentsData?.components.find((c: any) => c.id === selectedComponentId);
  const selectedMovementType = MOVEMENT_TYPES.find(mt => mt.value === selectedMovementTypeValue);

  const movementColumns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Fecha',
      width: 150,
      valueFormatter: (params) =>
        format(new Date(params.value), 'dd/MM/yyyy HH:mm'),
    },
    {
      field: 'movement_type_name',
      headerName: 'Tipo',
      width: 150,
      renderCell: (params) => {
        const operation = params.row.operation;
        const isEntry = operation === 'IN';
        const icon = isEntry ? <ArrowDownward /> : <ArrowUpward />;
        const color = isEntry ? '#22c55e' : '#ef4444';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ color, display: 'flex' }}>{icon}</Box>
            <Typography sx={{ color, fontWeight: 500 }}>
              {params.value}
            </Typography>
          </Box>
        );
      },
    },
    { field: 'component_name', headerName: 'Componente', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: 'Cantidad', width: 100, type: 'number' },
    { field: 'unit_cost', headerName: 'Costo Unit.', width: 100, type: 'number' },
    { field: 'total_cost', headerName: 'Costo Total', width: 120, type: 'number' },
    { field: 'reference_number', headerName: 'Referencia', width: 150 },
    {
      field: 'notes',
      headerName: 'Notas',
      width: 200,
      renderCell: (params) => {
        const notes = params.value || '';
        if (notes.length > 50) {
          return (
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {notes.substring(0, 50)}...
            </Typography>
          );
        }
        return <Typography variant="body2">{notes || '-'}</Typography>;
      },
    },
    {
      field: 'user',
      headerName: 'Usuario',
      width: 150,
      valueGetter: (params) => {
        if (params.row.username) return params.row.username;
        if (params.row.first_name || params.row.last_name) {
          return `${params.row.first_name || ''} ${params.row.last_name || ''}`.trim();
        }
        return 'Usuario desconocido';
      },
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => {
            setSelectedMovement(params.row);
            setOpenDetailsDialog(true);
          }}
          sx={{ color: 'primary.main' }}
        >
          <Visibility />
        </IconButton>
      ),
    },
  ];

  const onSubmitMovement = (data: any) => {
    if (useRecipe && movementItems.length > 0) {
      // Verificar que todos los componentes tienen código válido
      const missingCode = movementItems.filter(item => !(item.component_code || item.component_id));
      if (missingCode.length > 0) {
        alert(`${missingCode.length} componente(s) de la receta no tienen código válido. Verifique la receta.`);
        return;
      }

      const allItems = movementItems.filter(item => item.quantity > 0);
      if (allItems.length === 0) {
        alert('No hay componentes con cantidad válida en la receta seleccionada');
        return;
      }

      movementsService.createBulkMovements({
        type: data.type,
        reference_number: data.reference_number || undefined,
        notes: `${data.notes || ''} - Receta: ${selectedRecipe?.name} (x${recipeMultiplier})`.trim(),
        recipe_id: selectedRecipe?.id || undefined,
        recipe_name: selectedRecipe?.name || undefined,
        items: allItems.map(item => ({
          component_code: item.component_code || item.component_id,
          quantity: parseFloat(item.quantity.toString()),
          unit_cost: item.cost_price ? parseFloat(item.cost_price.toString()) : 0,
        })),
      }).then((result) => {
        queryClient.invalidateQueries({ queryKey: ['movements'] });
        queryClient.invalidateQueries({ queryKey: ['components'] });
        queryClient.invalidateQueries({ queryKey: ['components-list'] });
        setOpenMovementDialog(false);
        resetMovement();
        setMovementItems([]);
        setSelectedRecipe(null);
        setUseRecipe(false);
        setRecipeMultiplier(1);
        setSuccessMessage(`${result.processed} movimiento(s) creados correctamente`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }).catch((error) => {
        const errData = error.response?.data;
        const errors: any[] = Array.isArray(errData?.errors) ? errData.errors : [];
        setOpenMovementDialog(false);
        if (errors.length > 0) {
          setStockErrorsList(errors);
        } else {
          // Fallback: construir una entrada genérica desde el mensaje de error
          setStockErrorsList([{
            component_name: errData?.error || error.message || 'Error desconocido',
            component_code: null,
            available_stock: null,
            requested_quantity: null,
            error: errData?.error || error.message,
          }]);
        }
        setOpenStockErrorDialog(true);
      });
    } else {
      createMovementMutation.mutate({
        type: data.type,
        component_id: data.component_id,
        quantity: parseFloat(data.quantity),
        unit_cost: data.unit_cost ? parseFloat(data.unit_cost) : 0,
        reference_number: data.reference_number,
        notes: data.notes,
      });
    }
  };

  const onSubmitInvoice = (data: any) => {
    if (invoiceItems.length === 0) {
      alert('Debe agregar al menos un item a la factura');
      return;
    }
    createInvoiceMutation.mutate({
      type: data.type,
      reference_number: data.reference_number,
      notes: data.notes,
      shipping_cost: parseFloat(data.shipping_cost || 0),
      shipping_tax: parseFloat(data.shipping_tax || 0),
      items: invoiceItems,
    });
  };

  const onAddItem = (data: any) => {
    if (!isNewComponent && !selectedComponent) {
      alert('Debe seleccionar un componente existente o cambiar a "Crear componente nuevo"');
      return;
    }

    const itemData = {
      component_code: isNewComponent ? data.component_code : selectedComponent?.code || data.component_code,
      component_name: isNewComponent ? data.component_name : selectedComponent?.name || data.component_name,
      quantity: parseFloat(data.quantity),
      total_cost: parseFloat(data.total_cost),
      unit: isNewComponent ? (data.unit || 'unit') : (selectedComponent?.unit_symbol || 'unit'),
    };

    setInvoiceItems([...invoiceItems, itemData]);
    resetItem();
    setSelectedComponent(null);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Movimientos de Inventario</Typography>
        {!isViewer && (
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenMovementDialog(true)}
            >
              Nuevo Movimiento
            </Button>
            <Button
              variant="outlined"
              startIcon={<Receipt />}
              onClick={() => setOpenInvoiceDialog(true)}
            >
              Nueva Factura
            </Button>
            <Button
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => setOpenBulkDialog(true)}
            >
              Carga Masiva
            </Button>
            {isAdmin && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweep />}
                onClick={() => setOpenClearDialog(true)}
              >
                Limpiar Todo
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Movimientos" />
          {!isViewer && <Tab label="Por Receta" />}
        </Tabs>

        {/* Tab 0: Historial completo de movimientos */}
        <TabPanel value={tabValue} index={0}>
          <DataGrid
            rows={movementsData?.movements || []}
            columns={movementColumns}
            loading={movementsLoading}
            autoHeight
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'created_at', sort: 'desc' }] },
            }}
            sx={{ '& .MuiDataGrid-cell:hover': { color: 'primary.main' } }}
          />
        </TabPanel>

        {/* Tab 1: Movimientos agrupados por ejecución de receta */}
        {!isViewer && (
          <TabPanel value={tabValue} index={1}>
            {(() => {
              const recipeMovements = (movementsData?.movements || []).filter((m: any) => m.recipe_id);
              const groups = recipeMovements.reduce((acc: any, m: any) => {
                // Agrupar por receta + referencia (o por minuto si no hay referencia)
                const batchKey = m.reference_number
                  ? `ref:${m.reference_number}`
                  : `ts:${m.created_at ? m.created_at.substring(0, 16) : ''}`;
                const key = `${m.recipe_id}||${batchKey}`;
                if (!acc[key]) {
                  acc[key] = {
                    key,
                    recipe_id: m.recipe_id,
                    recipe_name: m.recipe_name || 'Receta',
                    reference: m.reference_number,
                    date: m.created_at,
                    movements: [],
                  };
                }
                if (m.created_at > acc[key].date) acc[key].date = m.created_at;
                acc[key].movements.push(m);
                return acc;
              }, {} as Record<string, any>);

              const groupList = Object.values(groups) as any[];

              if (groupList.length === 0) {
                return (
                  <Typography color="textSecondary" sx={{ p: 2 }}>
                    No hay movimientos asociados a recetas
                  </Typography>
                );
              }

              return (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={40} />
                        <TableCell>Receta</TableCell>
                        <TableCell>Orden / Referencia</TableCell>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell align="right">Componentes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupList
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((group: any) => {
                          const groupType = group.movements[0]?.type || 'salida';
                          const isEntry = groupType === 'entrada';
                          return (
                          <React.Fragment key={group.key}>
                            <TableRow
                              hover
                              sx={{ cursor: 'pointer', backgroundColor: 'action.hover' }}
                              onClick={() =>
                                setExpandedRecipes(prev => {
                                  const next = new Set(prev);
                                  next.has(group.key) ? next.delete(group.key) : next.add(group.key);
                                  return next;
                                })
                              }
                            >
                              <TableCell>
                                {expandedRecipes.has(group.key) ? <ExpandLess /> : <ExpandMore />}
                              </TableCell>
                              <TableCell><strong>{group.recipe_name}</strong></TableCell>
                              <TableCell>{group.reference || '-'}</TableCell>
                              <TableCell>{format(new Date(group.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                              <TableCell>
                                <Chip
                                  label={isEntry ? 'Entrada' : 'Salida'}
                                  size="small"
                                  color={isEntry ? 'success' : 'error'}
                                  icon={isEntry ? <ArrowDownward sx={{ fontSize: '14px !important' }} /> : <ArrowUpward sx={{ fontSize: '14px !important' }} />}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Chip label={group.movements.length} size="small" />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                                <Collapse in={expandedRecipes.has(group.key)} timeout="auto" unmountOnExit>
                                  <Box sx={{ m: 1, pl: 4 }}>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Componente</TableCell>
                                          <TableCell>Tipo</TableCell>
                                          <TableCell align="right">Cantidad</TableCell>
                                          <TableCell align="right">Costo Unit.</TableCell>
                                          <TableCell>Hora</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {group.movements.map((m: any) => (
                                          <TableRow key={m.id}>
                                            <TableCell>{m.component_name}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={m.type === 'entrada' ? 'Entrada' : 'Salida'}
                                                size="small"
                                                color={m.type === 'entrada' ? 'success' : 'error'}
                                              />
                                            </TableCell>
                                            <TableCell align="right">{m.quantity}</TableCell>
                                            <TableCell align="right">${m.unit_cost || 0}</TableCell>
                                            <TableCell>{format(new Date(m.created_at), 'HH:mm:ss')}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              );
            })()}
          </TabPanel>
        )}
      </Paper>

      {/* Dialog para nuevo movimiento */}
      <Dialog
        open={openMovementDialog}
        onClose={() => setOpenMovementDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmitMovement(onSubmitMovement)}>
          <DialogTitle>Nuevo Movimiento</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useRecipe}
                      onChange={(e) => {
                        setUseRecipe(e.target.checked);
                        if (e.target.checked) {
                          setMovementItems([]);
                          setSelectedRecipe(null);
                          setRecipeMultiplier(1);
                        }
                      }}
                    />
                  }
                  label="Usar receta para múltiples componentes"
                />
              </Grid>

              {useRecipe && (
                <>
                  <Grid item xs={12} sm={8}>
                    <Autocomplete
                      options={recipesData?.recipes || []}
                      getOptionLabel={(option) => option.name}
                      value={selectedRecipe}
                      onChange={async (event, newValue) => {
                        setSelectedRecipe(newValue);
                        if (newValue) {
                          try {
                            const recipeDetails = await recipesService.getRecipeById(newValue.id);
                            if (recipeDetails.recipe.ingredients && recipeDetails.recipe.ingredients.length > 0) {
                              const items = recipeDetails.recipe.ingredients.map((ingredient: any) => ({
                                component_id: ingredient.component_id,
                                component_code: ingredient.component_code,
                                component_name: ingredient.component_name || ingredient.component?.name,
                                quantity: ingredient.quantity * recipeMultiplier,
                                unit: ingredient.unit_symbol || ingredient.component?.unit_symbol || 'unit',
                                cost_price: ingredient.cost_price || ingredient.component?.cost_price || 0
                              }));
                              setMovementItems(items);
                            } else {
                              setMovementItems([]);
                            }
                          } catch (error) {
                            console.error('Error al cargar detalles de receta:', error);
                            setMovementItems([]);
                          }
                        } else {
                          setMovementItems([]);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Seleccionar Receta" required={useRecipe} />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Multiplicador"
                      type="number"
                      value={recipeMultiplier}
                      onChange={async (e) => {
                        const value = parseInt(e.target.value) || 1;
                        setRecipeMultiplier(value);
                        if (selectedRecipe) {
                          try {
                            const recipeDetails = await recipesService.getRecipeById(selectedRecipe.id);
                            if (recipeDetails.recipe.ingredients) {
                              const items = recipeDetails.recipe.ingredients.map((ingredient: any) => ({
                                component_id: ingredient.component_id,
                                component_code: ingredient.component_code,
                                component_name: ingredient.component_name || ingredient.component?.name,
                                quantity: ingredient.quantity * value,
                                unit: ingredient.unit_symbol || ingredient.component?.unit_symbol || 'unit',
                                cost_price: ingredient.cost_price || ingredient.component?.cost_price || 0
                              }));
                              setMovementItems(items);
                            }
                          } catch (error) {
                            console.error('Error al actualizar multiplicador:', error);
                          }
                        }
                      }}
                      InputProps={{ inputProps: { min: 1 } }}
                      helperText="Cantidad de veces a aplicar la receta"
                    />
                  </Grid>

                  {movementItems.length > 0 && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Componentes de la receta (x{recipeMultiplier}):
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Componente</TableCell>
                                <TableCell align="right">Cantidad</TableCell>
                                <TableCell>Unidad</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {movementItems.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.component_name}</TableCell>
                                  <TableCell align="right">{item.quantity}</TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    </Grid>
                  )}
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tipo de Movimiento"
                  select
                  {...registerMovement('type', {
                    required: 'El tipo de movimiento es requerido',
                  })}
                  error={!!movementErrors.type}
                  helperText={movementErrors.type?.message as string}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {MOVEMENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {!useRecipe && (
                <Grid item xs={12}>
                  <Controller
                    name="component_id"
                    control={controlMovement}
                    rules={{ required: !useRecipe ? 'El componente es requerido' : false }}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <Autocomplete
                        options={componentsData?.components || []}
                        getOptionLabel={(option) => `${option.code} - ${option.name}`}
                        value={componentsData?.components.find(c => c.id === value) || null}
                        onChange={(event, newValue) => {
                          onChange(newValue ? newValue.id : '');
                          if (newValue?.cost_price) {
                            setValueMovement('unit_cost', newValue.cost_price);
                          } else {
                            setValueMovement('unit_cost', 0);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Componente"
                            error={!!error}
                            helperText={error?.message}
                            placeholder="Buscar por código o nombre..."
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box sx={{ width: '100%' }}>
                              <Typography variant="body2">
                                <strong>{option.code}</strong> - {option.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Stock: {option.current_stock} {option.unit_symbol}
                                {option.min_stock > 0 && option.current_stock < option.min_stock && (
                                  <span style={{ color: 'orange', marginLeft: '8px' }}>
                                    ⚠️ Stock bajo
                                  </span>
                                )}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        filterOptions={(options, { inputValue }) => {
                          if (!inputValue) return options;
                          const searchTerm = inputValue.toLowerCase();
                          return options.filter(option =>
                            option.code.toLowerCase().includes(searchTerm) ||
                            option.name.toLowerCase().includes(searchTerm)
                          );
                        }}
                        noOptionsText="No se encontraron componentes"
                      />
                    )}
                  />
                </Grid>
              )}

              {!useRecipe && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Cantidad"
                    type="number"
                    {...registerMovement('quantity', {
                      required: !useRecipe ? 'La cantidad es requerida' : false,
                      min: { value: 0.01, message: 'La cantidad debe ser mayor a 0' },
                      validate: (value) => {
                        if (!useRecipe && selectedMovementType?.operation === 'OUT' && selectedComponentData) {
                          if (parseFloat(value) > (selectedComponentData as any).current_stock) {
                            return `Stock insuficiente. Disponible: ${(selectedComponentData as any).current_stock} unidades`;
                          }
                        }
                        return true;
                      }
                    })}
                    error={!!movementErrors.quantity}
                    helperText={movementErrors.quantity?.message as string}
                  />
                </Grid>
              )}

              {!useRecipe && selectedComponentData && (
                <Grid item xs={12}>
                  <Alert
                    severity={
                      (selectedComponentData as any).current_stock <= 0
                        ? 'error'
                        : (selectedComponentData as any).min_stock > 0 && (selectedComponentData as any).current_stock < (selectedComponentData as any).min_stock
                        ? 'warning'
                        : 'info'
                    }
                    sx={{ mt: 1 }}
                  >
                    <strong>{(selectedComponentData as any).name}</strong>
                    <br />
                    Stock actual: {(selectedComponentData as any).current_stock} | Precio: ${(selectedComponentData as any).cost_price || 0}
                    {(selectedComponentData as any).min_stock > 0 && (selectedComponentData as any).current_stock < (selectedComponentData as any).min_stock && (
                      <>
                        <br />
                        <span style={{ color: 'orange' }}>Stock por debajo del mínimo ({(selectedComponentData as any).min_stock})</span>
                      </>
                    )}
                  </Alert>
                </Grid>
              )}

              {!useRecipe && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Costo Unitario"
                    type="number"
                    inputProps={{ step: 'any' }}
                    {...registerMovement('unit_cost', { min: 0 })}
                    helperText={selectedComponentData
                      ? `Precio registrado: $${(selectedComponentData as any).cost_price || 0}`
                      : ''}
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Número de Referencia"
                  {...registerMovement('reference_number')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={2}
                  {...registerMovement('notes')}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenMovementDialog(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMovementMutation.isPending}
            >
              Crear Movimiento
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog para nueva factura */}
      <Dialog
        open={openInvoiceDialog}
        onClose={() => {
          setOpenInvoiceDialog(false);
          setInvoiceItems([]);
          resetInvoice();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Nueva Factura</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmitInvoice(onSubmitInvoice)}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Tipo de Movimiento"
                  select
                  {...registerInvoice('type', {
                    required: 'El tipo de movimiento es requerido',
                  })}
                  error={!!invoiceErrors.type}
                  helperText={invoiceErrors.type?.message as string}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {MOVEMENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Número de Factura"
                  {...registerInvoice('reference_number', {
                    required: 'El número de factura es requerido',
                  })}
                  error={!!invoiceErrors.reference_number}
                  helperText={invoiceErrors.reference_number?.message as string}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Costo de Envío"
                  type="number"
                  defaultValue="0"
                  {...registerInvoice('shipping_cost')}
                  InputProps={{ inputProps: { step: '0.01' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Impuestos de Envío"
                  type="number"
                  defaultValue="0"
                  {...registerInvoice('shipping_tax')}
                  InputProps={{ inputProps: { step: '0.01' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Total Adicional"
                  value={
                    (parseFloat(watchInvoice('shipping_cost') || 0) +
                     parseFloat(watchInvoice('shipping_tax') || 0)).toFixed(2)
                  }
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={2}
                  {...registerInvoice('notes')}
                />
              </Grid>
            </Grid>
          </form>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Agregar Items
            </Typography>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isNewComponent}
                    onChange={(e) => {
                      setIsNewComponent(e.target.checked);
                      setSelectedComponent(null);
                      resetItem();
                    }}
                  />
                }
                label={isNewComponent ? 'Crear componente nuevo' : 'Seleccionar componente existente'}
              />
            </Box>

            <form onSubmit={handleSubmitItem(onAddItem)}>
              <Grid container spacing={2} alignItems="center">
                {!isNewComponent ? (
                  <Grid item xs={12} sm={5}>
                    <Autocomplete
                      options={componentsData?.components || []}
                      getOptionLabel={(option) => `${option.code} - ${option.name}`}
                      value={selectedComponent}
                      onChange={(event, newValue) => {
                        setSelectedComponent(newValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Seleccionar Componente"
                          error={!selectedComponent && !!itemErrors.component_code}
                          helperText={!selectedComponent && itemErrors.component_code ? 'Debe seleccionar un componente' : ''}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props}>
                          <Box>
                            <Typography variant="body2">
                              <strong>{option.code}</strong> - {option.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Stock: {option.current_stock} {option.unit_symbol} | Costo: ${option.cost_price}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    />
                  </Grid>
                ) : (
                  <>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        label="Código"
                        {...registerItem('component_code', { required: 'Requerido' })}
                        error={!!itemErrors.component_code}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Nombre"
                        {...registerItem('component_name', { required: 'Requerido' })}
                        error={!!itemErrors.component_name}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    label="Cantidad"
                    type="number"
                    {...registerItem('quantity', {
                      required: 'Requerido',
                      min: { value: 0.01, message: 'Mayor a 0' },
                    })}
                    error={!!itemErrors.quantity}
                    InputProps={{ inputProps: { step: '0.01' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    label="Costo Total"
                    type="number"
                    {...registerItem('total_cost', {
                      required: 'Requerido',
                      min: { value: 0.01, message: 'Mayor a 0' },
                    })}
                    error={!!itemErrors.total_cost}
                    InputProps={{ inputProps: { step: '0.01' } }}
                  />
                </Grid>
                {isNewComponent && (
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Unidad"
                      defaultValue="unit"
                      {...registerItem('unit')}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={isNewComponent ? 1 : 3}>
                  <IconButton
                    color="primary"
                    type="submit"
                    size="large"
                    disabled={!isNewComponent && !selectedComponent}
                  >
                    <AddCircle />
                  </IconButton>
                  {selectedComponent && !isNewComponent && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption">
                        Stock actual: {selectedComponent.current_stock} {selectedComponent.unit_symbol}
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </form>
          </Box>

          {invoiceItems.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Costo Total</TableCell>
                    <TableCell align="right">Costo Unit.</TableCell>
                    <TableCell>Unidad</TableCell>
                    <TableCell width="50"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoiceItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.component_code}</TableCell>
                      <TableCell>{item.component_name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">${item.total_cost.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        ${(item.total_cost / item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <strong>Total Items: {invoiceItems.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                    </TableCell>
                    <TableCell colSpan={2} align="right">
                      <strong>Total: ${invoiceItems.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenInvoiceDialog(false);
              setInvoiceItems([]);
              resetInvoice();
              setSelectedComponent(null);
              setIsNewComponent(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitInvoice(onSubmitInvoice)}
            disabled={createInvoiceMutation.isPending || invoiceItems.length === 0}
          >
            Procesar Factura
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmación para limpiar movimientos */}
      <Dialog
        open={openClearDialog}
        onClose={() => setOpenClearDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          ⚠️ Confirmar Eliminación de Todos los Movimientos
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Esta acción eliminará TODOS los registros de movimientos (entradas y salidas).
            Esta operación no se puede deshacer.
          </Alert>
          <Alert severity="info" sx={{ mt: 1 }}>
            Las <strong>recetas</strong>, componentes y demás datos del inventario
            <strong> NO se verán afectados</strong>. Solo se borra el historial de movimientos.
          </Alert>
          <Typography sx={{ mt: 2 }}>
            ¿Está seguro que desea eliminar todos los movimientos?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClearDialog(false)} color="primary">
            Cancelar
          </Button>
          <Button
            onClick={() => clearMovementsMutation.mutate()}
            color="error"
            variant="contained"
            disabled={clearMovementsMutation.isPending}
          >
            {clearMovementsMutation.isPending ? 'Eliminando...' : 'Eliminar Todo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de carga masiva */}
      <BulkMovementDialog
        open={openBulkDialog}
        onClose={() => setOpenBulkDialog(false)}
      />

      {/* Dialog para ver detalles del movimiento */}
      <Dialog
        open={openDetailsDialog}
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalles del Movimiento</DialogTitle>
        <DialogContent>
          {selectedMovement && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Fecha</Typography>
                <Typography variant="body1">
                  {format(new Date(selectedMovement.created_at), 'dd/MM/yyyy HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Tipo de Movimiento</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{
                    color: selectedMovement.operation === 'IN' ? '#22c55e' : '#ef4444',
                    display: 'flex'
                  }}>
                    {selectedMovement.operation === 'IN' ? <ArrowDownward /> : <ArrowUpward />}
                  </Box>
                  <Typography sx={{
                    color: selectedMovement.operation === 'IN' ? '#22c55e' : '#ef4444',
                    fontWeight: 500
                  }}>
                    {selectedMovement.movement_type_name}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Componente</Typography>
                <Typography variant="body1">{selectedMovement.component_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Cantidad</Typography>
                <Typography variant="body1">{selectedMovement.quantity}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Costo Unitario</Typography>
                <Typography variant="body1">${selectedMovement.unit_cost || '0.00'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">Costo Total</Typography>
                <Typography variant="body1">${selectedMovement.total_cost || '0.00'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Número de Referencia</Typography>
                <Typography variant="body1">{selectedMovement.reference_number || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Usuario</Typography>
                <Typography variant="body1">
                  {selectedMovement.username ||
                   `${selectedMovement.first_name || ''} ${selectedMovement.last_name || ''}`.trim() ||
                   'Usuario desconocido'}
                </Typography>
              </Grid>
              {selectedMovement.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Notas</Typography>
                  <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                    <Typography variant="body1">{selectedMovement.notes}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de componentes sin stock suficiente */}
      <Dialog
        open={openStockErrorDialog}
        onClose={() => { setOpenStockErrorDialog(false); setStockErrorsList([]); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
          Movimiento cancelado — stock insuficiente
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>No se creó ningún movimiento.</strong> Para que el movimiento se procese,
            todos los componentes deben tener stock suficiente. Corrija el inventario
            o ajuste la receta antes de reintentar.
          </Alert>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Descripción</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Disponible</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Solicitado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>Faltante</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockErrorsList.map((e: any, i: number) => (
                  <TableRow
                    key={i}
                    sx={{ '&:nth-of-type(odd)': { backgroundColor: 'grey.50' } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                        {e.component_code || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {e.component_name || e.error || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'warning.dark', fontWeight: 'bold' }}>
                      {e.available_stock ?? '—'}
                    </TableCell>
                    <TableCell align="right">
                      {e.requested_quantity ?? '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                      {e.available_stock != null && e.requested_quantity != null
                        ? `${e.requested_quantity - e.available_stock}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => { setOpenStockErrorDialog(false); setStockErrorsList([]); }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
