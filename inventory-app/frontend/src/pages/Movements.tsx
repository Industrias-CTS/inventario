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
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { movementsService } from '../services/movements.service';
import { componentsService } from '../services/components.service';
import { movementTypesService } from '../services/movement-types.service';
import { recipesService } from '../services/recipes.service';

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
  }>>([]);
  const [useRecipe, setUseRecipe] = useState(false);
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

  const {
    register: registerMovement,
    handleSubmit: handleSubmitMovement,
    reset: resetMovement,
    // control: controlMovement,
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
            unit_cost: parseFloat(data.unit_cost) || 0,
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
        </Box>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Movimientos" />
          <Tab label="Reservas" />
        </Tabs>

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
                      onChange={(event, newValue) => {
                        setSelectedRecipe(newValue);
                        if (newValue) {
                          console.log('Receta seleccionada:', newValue);
                          // Cargar los componentes de la receta
                          if (newValue.components && newValue.components.length > 0) {
                            const items = newValue.components.map((comp: any) => ({
                              component_id: comp.component_id,
                              component_name: comp.component_name,
                              quantity: comp.quantity * recipeMultiplier,
                              unit: comp.unit_symbol || 'unit'
                            }));
                            console.log('Items de movimiento creados:', items);
                            setMovementItems(items);
                          } else {
                            console.warn('La receta no tiene componentes o tiene estructura incorrecta');
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
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        setRecipeMultiplier(value);
                        // Actualizar cantidades de los items
                        if (selectedRecipe) {
                          const items = selectedRecipe.components.map((comp: any) => ({
                            component_id: comp.component_id,
                            component_name: comp.component_name,
                            quantity: comp.quantity * value,
                            unit: comp.unit_symbol || 'unit'
                          }));
                          setMovementItems(items);
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
                  <TextField
                    fullWidth
                    label="Componente"
                    select
                    {...registerMovement('component_id', {
                      required: !useRecipe ? 'El componente es requerido' : false,
                    })}
                    error={!!movementErrors.component_id}
                    helperText={movementErrors.component_id?.message as string}
                  >
                    <MenuItem value="">Seleccionar...</MenuItem>
                    {componentsData?.components.map((component) => {
                      const availableStock = component.current_stock - component.reserved_stock;
                      return (
                        <MenuItem key={component.id} value={component.id}>
                          {component.name} - {component.code} (Disponible: {availableStock})
                        </MenuItem>
                      );
                    })}
                  </TextField>
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
                <TextField
                  fullWidth
                  label="Componente"
                  select
                  {...registerReservation('component_id', {
                    required: 'El componente es requerido',
                  })}
                  error={!!reservationErrors.component_id}
                  helperText={reservationErrors.component_id?.message as string}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {componentsData?.components.map((component) => (
                    <MenuItem key={component.id} value={component.id}>
                      {component.name} - Stock disponible: {component.current_stock - component.reserved_stock}
                    </MenuItem>
                  ))}
                </TextField>
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
    </Box>
  );
}