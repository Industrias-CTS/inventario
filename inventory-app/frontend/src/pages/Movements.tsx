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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  Add,
  ArrowUpward,
  ArrowDownward,
  BookmarkAdd,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { movementsService } from '../services/movements.service';
import { componentsService } from '../services/components.service';
import { movementTypesService } from '../services/movement-types.service';
// import { Movement, Reservation } from '../types';

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
  // const [selectedComponent, setSelectedComponent] = useState<string>('');
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

  const createMovementMutation = useMutation({
    mutationFn: movementsService.createMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenMovementDialog(false);
      resetMovement();
    },
  });

  const createReservationMutation = useMutation({
    mutationFn: movementsService.createReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenReservationDialog(false);
      resetReservation();
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
        const color = operation === 'IN' ? 'success' : 'error';
        const icon = operation === 'IN' ? <ArrowDownward /> : <ArrowUpward />;
        return (
          <Chip
            label={params.value}
            color={color}
            size="small"
            icon={icon}
          />
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
      valueGetter: (params) =>
        params.row.username || `${params.row.first_name} ${params.row.last_name}`,
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
      valueGetter: (params) =>
        params.row.username || `${params.row.first_name} ${params.row.last_name}`,
    },
  ];

  const onSubmitMovement = (data: any) => {
    createMovementMutation.mutate(data);
  };

  const onSubmitReservation = (data: any) => {
    createReservationMutation.mutate(data);
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Componente"
                  select
                  {...registerMovement('component_id', {
                    required: 'El componente es requerido',
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cantidad"
                  type="number"
                  {...registerMovement('quantity', {
                    required: 'La cantidad es requerida',
                    min: { value: 0.01, message: 'La cantidad debe ser mayor a 0' },
                    validate: (value) => {
                      if (selectedMovementType?.operation === 'OUT' && selectedComponentData) {
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
              
              {/* Mostrar información de stock para movimientos de salida */}
              {selectedMovementType?.operation === 'OUT' && selectedComponentData && (
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
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Costo Unitario"
                  type="number"
                  {...registerMovement('unit_cost', { min: 0 })}
                />
              </Grid>
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
    </Box>
  );
}