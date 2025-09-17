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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  Add,
  ArrowUpward,
  ArrowDownward,
  BookmarkAdd,
  Receipt,
  Delete,
  AddCircle,
  DeleteSweep,
  Visibility,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { movementsService } from '../services/movements.service';
import { componentsService } from '../services/components.service';
import { movementTypesService } from '../services/movement-types.service';
import { recipesService } from '../services/recipes.service';
import { authService } from '../services/auth.service';

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
  // Obtener usuario actual para verificar permisos
  const currentUser = authService.getCurrentUser();
  const isViewer = currentUser?.role === 'viewer';
  const isAdmin = currentUser?.role === 'admin';
  
  const [tabValue, setTabValue] = useState(0);
  const [openMovementDialog, setOpenMovementDialog] = useState(false);
  const [openReservationDialog, setOpenReservationDialog] = useState(false);
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
    component_name: string;
    quantity: number;
    unit: string;
    cost_price?: number;
  }>>([]);
  const [useRecipe, setUseRecipe] = useState(false);
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: () => movementsService.getMovements(),
  });

  const { data: reservationsData, isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => movementsService.getReservations(),
  });

  const { data: componentsData } = useQuery({
    queryKey: ['components-list'],
    queryFn: () => componentsService.getComponents(),
  });

  const { data: movementTypesData } = useQuery({
    queryKey: ['movement-types'],
    queryFn: () => movementTypesService.getMovementTypes(),
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
      setOpenMovementDialog(false);
      resetMovement();
      
      // Mostrar mensaje de éxito
      alert(`Movimiento creado exitosamente. ${response?.message || ''}`);
    },
    onError: (error: any) => {
      console.error('Error al crear movimiento:', error);
      alert(`Error al crear movimiento: ${error.response?.data?.error || error.message}`);
    },
  });

  const createReservationMutation = useMutation({
    mutationFn: movementsService.createReservation,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenReservationDialog(false);
      resetReservation();
      
      // Mostrar mensaje de éxito
      alert(`Reserva creada exitosamente. ${response?.message || ''}`);
    },
    onError: (error: any) => {
      console.error('Error al crear reserva:', error);
      alert(`Error al crear reserva: ${error.response?.data?.error || error.message}`);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: movementsService.createInvoice,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenInvoiceDialog(false);
      resetInvoice();
      setInvoiceItems([]);
      setSelectedComponent(null);
      setIsNewComponent(false);
      
      // Mostrar mensaje de éxito
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
    formState: { errors: movementErrors },
  } = useForm();

  const {
    register: registerReservation,
    handleSubmit: handleSubmitReservation,
    reset: resetReservation,
    control: controlReservation,
    formState: { errors: reservationErrors },
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

  // Watch form values para validación en tiempo real
  const selectedComponentId = watchMovement('component_id');
  const selectedMovementTypeId = watchMovement('movement_type_id');
  // const enteredQuantity = watchMovement('quantity');

  // Obtener componente seleccionado
  const selectedComponentData = componentsData?.components.find(c => c.id === selectedComponentId);
  
  // Obtener tipo de movimiento seleccionado
  const selectedMovementType = movementTypesData?.movementTypes.find(mt => mt.id === selectedMovementTypeId);

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
        return (
          <Typography variant="body2">
            {notes || '-'}
          </Typography>
        );
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

  const reservationColumns: GridColDef[] = [
    {
      field: 'reserved_at',
      headerName: 'Fecha Reserva',
      width: 150,
      valueFormatter: (params) =>
        format(new Date(params.value), 'dd/MM/yyyy HH:mm'),
    },
    { field: 'component_name', headerName: 'Componente', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: 'Cantidad', width: 100, type: 'number' },
    {
      field: 'status',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => {
        const statusColors = {
          active: 'warning',
          completed: 'success',
          cancelled: 'error',
        };
        return (
          <Chip
            label={params.value}
            color={statusColors[params.value as keyof typeof statusColors] as any}
            size="small"
          />
        );
      },
    },
    { field: 'reference', headerName: 'Referencia', width: 150 },
    {
      field: 'expires_at',
      headerName: 'Expira',
      width: 150,
      valueFormatter: (params) =>
        params.value ? format(new Date(params.value), 'dd/MM/yyyy') : '-',
    },
    {
      field: 'user',
      headerName: 'Reservado por',
      width: 150,
      valueGetter: (params) => {
        if (params.row.username) return params.row.username;
        if (params.row.first_name || params.row.last_name) {
          return `${params.row.first_name || ''} ${params.row.last_name || ''}`.trim();
        }
        return 'Usuario desconocido';
      },
    },
  ];

  const onSubmitMovement = (data: any) => {
    // Si estamos usando una receta, procesar múltiples movimientos
    if (useRecipe && movementItems.length > 0) {
      // Validar que todos los items tengan datos válidos
      const validItems = movementItems.filter(item => 
        item.component_id && 
        item.quantity && 
        item.quantity > 0
      );
      
      if (validItems.length === 0) {
        alert('No hay componentes válidos en la receta seleccionada');
        return;
      }
      
      console.log('Creando movimientos para:', validItems);
      
      // Crear movimientos para cada componente de la receta
      Promise.all(
        validItems.map(item => 
          movementsService.createMovement({
            movement_type_id: data.movement_type_id,
            component_id: item.component_id,
            quantity: parseFloat(item.quantity.toString()),
            unit_cost: item.cost_price ? parseFloat(item.cost_price.toString()) : 0,
            reference_number: data.reference_number,
            notes: `${data.notes || ''} - Receta: ${selectedRecipe?.name || ''} (x${recipeMultiplier})`.trim()
          })
        )
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ['movements'] });
        queryClient.invalidateQueries({ queryKey: ['components'] });
        setOpenMovementDialog(false);
        resetMovement();
        setMovementItems([]);
        setSelectedRecipe(null);
        setUseRecipe(false);
        setRecipeMultiplier(1);
        alert('Movimientos creados exitosamente desde la receta');
      }).catch((error) => {
        console.error('Error al crear movimientos:', error);
        alert(`Error al crear movimientos: ${error.response?.data?.error || error.message}`);
      });
    } else {
      // Movimiento individual normal
      createMovementMutation.mutate(data);
    }
  };

  const onSubmitReservation = (data: any) => {
    createReservationMutation.mutate(data);
  };

  const onSubmitInvoice = (data: any) => {
    if (invoiceItems.length === 0) {
      alert('Debe agregar al menos un item a la factura');
      return;
    }
    createInvoiceMutation.mutate({
      ...data,
      shipping_cost: parseFloat(data.shipping_cost || 0),
      shipping_tax: parseFloat(data.shipping_tax || 0),
      items: invoiceItems,
    });
  };

  const onAddItem = (data: any) => {
    // Validar que se haya seleccionado un componente o se esté creando uno nuevo
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
              startIcon={<BookmarkAdd />}
              onClick={() => setOpenReservationDialog(true)}
            >
              Nueva Reserva
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
        {isViewer ? (
          <Typography variant="h6" sx={{ p: 2 }}>
            Historial de Movimientos
          </Typography>
        ) : (
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Movimientos" />
            <Tab label="Reservas" />
          </Tabs>
        )}

        {!isViewer ? (
          <TabPanel value={tabValue} index={0}>
          <DataGrid
            rows={movementsData?.movements || []}
            columns={movementColumns}
            loading={movementsLoading}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'created_at', sort: 'desc' }],
              },
            }}
            sx={{
              '& .MuiDataGrid-cell:hover': {
                color: 'primary.main',
              },
            }}
          />
          </TabPanel>
        ) : (
          <Box sx={{ py: 3 }}>
          <DataGrid
            rows={reservationsData?.reservations || []}
            columns={reservationColumns}
            loading={reservationsLoading}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'reserved_at', sort: 'desc' }],
              },
            }}
            sx={{
              '& .MuiDataGrid-cell:hover': {
                color: 'primary.main',
              },
            }}
          />
          </Box>
        )}

        {!isViewer && (
          <TabPanel value={tabValue} index={1}>
            <DataGrid
              rows={reservationsData?.reservations || []}
              columns={reservationColumns}
              loading={reservationsLoading}
              autoHeight
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
                sorting: {
                  sortModel: [{ field: 'reserved_at', sort: 'desc' }],
                },
              }}
              sx={{
                '& .MuiDataGrid-cell:hover': {
                  color: 'primary.main',
                },
              }}
            />
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
              {/* Switch para usar receta */}
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
              
              {/* Selector de receta si está activado */}
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
                          console.log('Receta seleccionada:', newValue);
                          try {
                            // Obtener detalles completos de la receta incluyendo ingredientes
                            const recipeDetails = await recipesService.getRecipeById(newValue.id);
                            console.log('Detalles de receta:', recipeDetails);
                            
                            if (recipeDetails.recipe.ingredients && recipeDetails.recipe.ingredients.length > 0) {
                              const items = recipeDetails.recipe.ingredients.map((ingredient: any) => ({
                                component_id: ingredient.component_id,
                                component_name: ingredient.component_name || ingredient.component?.name,
                                quantity: ingredient.quantity * recipeMultiplier,
                                unit: ingredient.unit_symbol || ingredient.component?.unit_symbol || 'unit',
                                cost_price: ingredient.cost_price || ingredient.component?.cost_price || 0
                              }));
                              console.log('Items de movimiento creados:', items);
                              setMovementItems(items);
                            } else {
                              console.warn('La receta no tiene ingredientes');
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
                        <TextField
                          {...params}
                          label="Seleccionar Receta"
                          required={useRecipe}
                        />
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
                        // Actualizar cantidades de los items
                        if (selectedRecipe) {
                          try {
                            const recipeDetails = await recipesService.getRecipeById(selectedRecipe.id);
                            if (recipeDetails.recipe.ingredients) {
                              const items = recipeDetails.recipe.ingredients.map((ingredient: any) => ({
                                component_id: ingredient.component_id,
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
                  
                  {/* Mostrar componentes de la receta */}
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
                  {...registerMovement('movement_type_id', {
                    required: 'El tipo de movimiento es requerido',
                  })}
                  error={!!movementErrors.movement_type_id}
                  helperText={movementErrors.movement_type_id?.message as string}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {movementTypesData?.movementTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name} ({type.operation})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              {/* Solo mostrar selector de componente si no estamos usando receta */}
              {!useRecipe && (
                <Grid item xs={12}>
                  <Controller
                    name="component_id"
                    control={controlMovement}
                    rules={{
                      required: !useRecipe ? 'El componente es requerido' : false,
                    }}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <Autocomplete
                        options={componentsData?.components || []}
                        getOptionLabel={(option) => `${option.code} - ${option.name}`}
                        value={componentsData?.components.find(c => c.id === value) || null}
                        onChange={(event, newValue) => {
                          onChange(newValue ? newValue.id : '');
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
                        renderOption={(props, option) => {
                          const availableStock = option.current_stock - option.reserved_stock;
                          return (
                            <Box component="li" {...props}>
                              <Box sx={{ width: '100%' }}>
                                <Typography variant="body2">
                                  <strong>{option.code}</strong> - {option.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Disponible: {availableStock} {option.unit_symbol} 
                                  {availableStock <= option.min_stock && (
                                    <span style={{color: 'orange', marginLeft: '8px'}}>
                                      ⚠️ Stock bajo
                                    </span>
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        }}
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
              {/* Solo mostrar cantidad si no estamos usando receta */}
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
                          const availableStock = selectedComponentData.current_stock - selectedComponentData.reserved_stock;
                          if (parseFloat(value) > availableStock) {
                            return `Stock insuficiente. Disponible: ${availableStock} unidades`;
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
              
              {/* Mostrar información de stock para movimientos de salida */}
              {!useRecipe && selectedMovementType?.operation === 'OUT' && selectedComponentData && (
                <Grid item xs={12}>
                  <Alert 
                    severity={
                      selectedComponentData.current_stock - selectedComponentData.reserved_stock <= 0 
                        ? 'error' 
                        : selectedComponentData.current_stock - selectedComponentData.reserved_stock <= selectedComponentData.min_stock
                        ? 'warning'
                        : 'info'
                    }
                    sx={{ mt: 1 }}
                  >
                    <strong>{selectedComponentData.name}</strong>
                    <br />
                    Stock actual: {selectedComponentData.current_stock} | 
                    Stock reservado: {selectedComponentData.reserved_stock} | 
                    <strong> Disponible: {selectedComponentData.current_stock - selectedComponentData.reserved_stock}</strong>
                    {selectedComponentData.current_stock - selectedComponentData.reserved_stock <= selectedComponentData.min_stock && (
                      <>
                        <br />
                        <span style={{color: 'orange'}}>⚠️ Stock por debajo del mínimo ({selectedComponentData.min_stock})</span>
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
                    {...registerMovement('unit_cost', { min: 0 })}
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

      {/* Dialog para nueva reserva */}
      <Dialog
        open={openReservationDialog}
        onClose={() => setOpenReservationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmitReservation(onSubmitReservation)}>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="component_id"
                  control={controlReservation}
                  rules={{
                    required: 'El componente es requerido',
                  }}
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <Autocomplete
                      options={componentsData?.components || []}
                      getOptionLabel={(option) => `${option.code} - ${option.name}`}
                      value={componentsData?.components.find(c => c.id === value) || null}
                      onChange={(event, newValue) => {
                        onChange(newValue ? newValue.id : '');
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
                      renderOption={(props, option) => {
                        const availableStock = option.current_stock - option.reserved_stock;
                        return (
                          <Box component="li" {...props}>
                            <Box sx={{ width: '100%' }}>
                              <Typography variant="body2">
                                <strong>{option.code}</strong> - {option.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Stock disponible: {availableStock} {option.unit_symbol}
                                {availableStock <= 0 && (
                                  <span style={{color: 'red', marginLeft: '8px'}}>
                                    ❌ Sin stock
                                  </span>
                                )}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Cantidad"
                  type="number"
                  {...registerReservation('quantity', {
                    required: 'La cantidad es requerida',
                    min: { value: 0.01, message: 'La cantidad debe ser mayor a 0' },
                  })}
                  error={!!reservationErrors.quantity}
                  helperText={reservationErrors.quantity?.message as string}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Referencia"
                  {...registerReservation('reference')}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="expires_at"
                  control={controlReservation}
                  render={({ field }) => (
                    <DatePicker
                      label="Fecha de Expiración"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                        },
                      }}
                      {...field}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={2}
                  {...registerReservation('notes')}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenReservationDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createReservationMutation.isPending}
            >
              Crear Reserva
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
                  {...registerInvoice('movement_type_id', {
                    required: 'El tipo de movimiento es requerido',
                  })}
                  error={!!invoiceErrors.movement_type_id}
                  helperText={invoiceErrors.movement_type_id?.message as string}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {movementTypesData?.movementTypes
                    .filter(type => type.operation === 'IN')
                    .map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
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
                  InputProps={{ inputProps: { step: "0.01" } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Impuestos de Envío"
                  type="number"
                  defaultValue="0"
                  {...registerInvoice('shipping_tax')}
                  InputProps={{ inputProps: { step: "0.01" } }}
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

          {/* Formulario para agregar items */}
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
                label={isNewComponent ? "Crear componente nuevo" : "Seleccionar componente existente"}
              />
            </Box>
            
            <form onSubmit={handleSubmitItem(onAddItem)}>
              <Grid container spacing={2} alignItems="center">
                {!isNewComponent ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        label="Código"
                        {...registerItem('component_code', {
                          required: 'Requerido',
                        })}
                        error={!!itemErrors.component_code}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Nombre"
                        {...registerItem('component_name', {
                          required: 'Requerido',
                        })}
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
                    InputProps={{ inputProps: { step: "0.01" } }}
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
                    InputProps={{ inputProps: { step: "0.01" } }}
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

          {/* Tabla de items */}
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
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeItem(index)}
                        >
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
            Esta acción eliminará TODOS los movimientos registrados en el sistema.
            Esta operación no se puede deshacer.
          </Alert>
          <Typography sx={{ mt: 2 }}>
            ¿Está seguro que desea eliminar todos los movimientos?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenClearDialog(false)}
            color="primary"
          >
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

      {/* Dialog para ver detalles del movimiento */}
      <Dialog
        open={openDetailsDialog}
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Detalles del Movimiento
        </DialogTitle>
        <DialogContent>
          {selectedMovement && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Fecha
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedMovement.created_at), 'dd/MM/yyyy HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Tipo de Movimiento
                </Typography>
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
                <Typography variant="subtitle2" color="text.secondary">
                  Componente
                </Typography>
                <Typography variant="body1">
                  {selectedMovement.component_name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Cantidad
                </Typography>
                <Typography variant="body1">
                  {selectedMovement.quantity}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Costo Unitario
                </Typography>
                <Typography variant="body1">
                  ${selectedMovement.unit_cost || '0.00'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Costo Total
                </Typography>
                <Typography variant="body1">
                  ${selectedMovement.total_cost || '0.00'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Número de Referencia
                </Typography>
                <Typography variant="body1">
                  {selectedMovement.reference_number || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Usuario
                </Typography>
                <Typography variant="body1">
                  {selectedMovement.username || 
                   `${selectedMovement.first_name || ''} ${selectedMovement.last_name || ''}`.trim() ||
                   'Usuario desconocido'}
                </Typography>
              </Grid>
              {selectedMovement.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notas
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                    <Typography variant="body1">
                      {selectedMovement.notes}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}