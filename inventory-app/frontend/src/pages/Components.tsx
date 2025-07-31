import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  // Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Search,
  Refresh,
  Visibility,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { componentsService } from '../services/components.service';
import { unitsService } from '../services/units.service';
import { categoriesService } from '../services/categories.service';
import { authService } from '../services/auth.service';
import { Component } from '../types';

export default function Components() {
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openUnitDialog, setOpenUnitDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [viewingComponent, setViewingComponent] = useState<Component | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  
  // Obtener usuario actual para verificar permisos
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['components', searchTerm],
    queryFn: () => componentsService.getComponents({ search: searchTerm }),
  });

  const { data: unitsData } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitsService.getUnits(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getCategories(),
  });

  const createMutation = useMutation({
    mutationFn: componentsService.createComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenDialog(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Component> }) =>
      componentsService.updateComponent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setOpenDialog(false);
      setSelectedComponent(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: componentsService.deleteComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: unitsService.createUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setOpenUnitDialog(false);
      resetUnitForm();
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setOpenCategoryDialog(false);
      resetCategoryForm();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<Partial<Component>>();

  const {
    register: registerUnit,
    handleSubmit: handleSubmitUnit,
    reset: resetUnitForm,
    formState: { errors: unitErrors },
  } = useForm<{ name: string; symbol: string }>();

  const {
    register: registerCategory,
    handleSubmit: handleSubmitCategory,
    reset: resetCategoryForm,
    formState: { errors: categoryErrors },
  } = useForm<{ name: string; description: string }>();

  const onSubmit = (data: Partial<Component>) => {
    if (selectedComponent) {
      updateMutation.mutate({ id: selectedComponent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const onSubmitUnit = (data: { name: string; symbol: string }) => {
    createUnitMutation.mutate(data);
  };

  const onSubmitCategory = (data: { name: string; description: string }) => {
    createCategoryMutation.mutate(data);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedComponent(null);
    reset();
  };

  const handleEdit = (component: Component) => {
    setSelectedComponent(component);
    
    // Resetear el formulario con todos los datos del componente
    reset({
      code: component.code,
      name: component.name,
      description: component.description || '',
      category_id: component.category_id || '',
      unit_id: component.unit_id || '',
      min_stock: component.min_stock || 0,
      max_stock: component.max_stock || undefined,
      location: component.location || '',
      cost_price: component.cost_price || 0,
    });
    
    setOpenDialog(true);
  };

  const handleView = (component: Component) => {
    setViewingComponent(component);
    setOpenViewDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este componente?')) {
      deleteMutation.mutate(id);
    }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Código', width: 120 },
    { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 200 },
    {
      field: 'category_name',
      headerName: 'Categoría',
      width: 150,
      renderCell: (params) => params.value || 'Sin categoría',
    },
    {
      field: 'current_stock',
      headerName: 'Stock Actual',
      width: 120,
      type: 'number',
      renderCell: (params) => {
        const stock = params.row.current_stock;
        const minStock = params.row.min_stock;
        const color = stock <= minStock ? 'error' : 'success';
        return <Chip label={stock} color={color} size="small" />;
      },
    },
    {
      field: 'reserved_stock',
      headerName: 'Reservado',
      width: 100,
      type: 'number',
    },
    {
      field: 'available_stock',
      headerName: 'Disponible',
      width: 100,
      type: 'number',
      valueGetter: (params) =>
        params.row.current_stock - params.row.reserved_stock,
    },
    {
      field: 'unit_symbol',
      headerName: 'Unidad',
      width: 80,
    },
    {
      field: 'location',
      headerName: 'Ubicación',
      width: 120,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: isAdmin ? 150 : 80,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={() => handleView(params.row)}
            color="info"
            title="Ver detalles"
          >
            <Visibility />
          </IconButton>
          {isAdmin && (
            <>
              <IconButton
                size="small"
                onClick={() => handleEdit(params.row)}
                color="primary"
                title="Editar componente"
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(params.row.id)}
                color="error"
                title="Eliminar componente"
              >
                <Delete />
              </IconButton>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Componentes de Inventario</Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenDialog(true)}
          >
            Nuevo Componente
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar componentes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'action.disabled' }} />,
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          <IconButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['components'] })}
          >
            <Refresh />
          </IconButton>
        </Box>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={data?.components || []}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
          checkboxSelection
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell:hover': {
              color: 'primary.main',
            },
          }}
        />
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedComponent ? 'Editar Componente' : 'Nuevo Componente'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Código"
                  {...register('code', { required: 'El código es requerido' })}
                  error={!!errors.code}
                  helperText={errors.code?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre"
                  {...register('name', { required: 'El nombre es requerido' })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  multiline
                  rows={2}
                  {...register('description')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Stock Mínimo"
                  type="number"
                  {...register('min_stock', {
                    required: 'El stock mínimo es requerido',
                    min: 0,
                  })}
                  error={!!errors.min_stock}
                  helperText={errors.min_stock?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Stock Máximo"
                  type="number"
                  {...register('max_stock', { min: 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ubicación"
                  {...register('location')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" gap={1} alignItems="start">
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        fullWidth
                        label="Categoría"
                        select
                        value={field.value || ''}
                        onChange={field.onChange}
                      >
                        <MenuItem value="">Sin categoría</MenuItem>
                        {categoriesData?.categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setOpenCategoryDialog(true)}
                    sx={{ mt: 0, minWidth: 'auto', px: 2 }}
                    title="Crear nueva categoría"
                  >
                    <Add />
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" gap={1} alignItems="start">
                  <Controller
                    name="unit_id"
                    control={control}
                    rules={{ required: 'La unidad es requerida' }}
                    render={({ field, fieldState }) => (
                      <TextField
                        fullWidth
                        label="Unidad"
                        select
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      >
                        <MenuItem value="">Seleccionar...</MenuItem>
                        {unitsData?.units.map((unit) => (
                          <MenuItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  {isAdmin && (
                    <IconButton
                      color="primary"
                      onClick={() => setOpenUnitDialog(true)}
                      sx={{ mt: 1 }}
                      title="Agregar nueva unidad"
                    >
                      <Add />
                    </IconButton>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio de Costo"
                  type="number"
                  {...register('cost_price', { min: 0 })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {selectedComponent ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal de Visualización */}
      <Dialog 
        open={openViewDialog} 
        onClose={() => setOpenViewDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Detalles del Componente
        </DialogTitle>
        <DialogContent>
          {viewingComponent && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Código
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.code}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Nombre
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.name}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Descripción
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.description || 'Sin descripción'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Categoría
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.category_name || 'Sin categoría'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Unidad
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.unit_name} ({viewingComponent.unit_symbol})
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stock Actual
                </Typography>
                <Chip 
                  label={viewingComponent.current_stock}
                  color={viewingComponent.current_stock <= viewingComponent.min_stock ? 'error' : 'success'}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stock Reservado
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.reserved_stock}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stock Disponible
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.current_stock - viewingComponent.reserved_stock}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stock Mínimo
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.min_stock}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stock Máximo
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.max_stock || 'No definido'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Ubicación
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.location || 'Sin ubicación'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Precio de Costo
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  ${viewingComponent.cost_price || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Fecha de Creación
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {new Date(viewingComponent.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Última Actualización
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {viewingComponent.updated_at ? 
                    new Date(viewingComponent.updated_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Nunca'
                  }
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>
            Cerrar
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              onClick={() => {
                setOpenViewDialog(false);
                if (viewingComponent) {
                  handleEdit(viewingComponent);
                }
              }}
              startIcon={<Edit />}
            >
              Editar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog para agregar nueva unidad */}
      <Dialog open={openUnitDialog} onClose={() => setOpenUnitDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmitUnit(onSubmitUnit)}>
          <DialogTitle>Agregar Nueva Unidad</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre de la Unidad"
                  placeholder="Ej: Kilogramos, Metros, Litros"
                  {...registerUnit('name', { 
                    required: 'El nombre es requerido',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                  })}
                  error={!!unitErrors.name}
                  helperText={unitErrors.name?.message}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Símbolo"
                  placeholder="Ej: kg, m, L"
                  {...registerUnit('symbol', { 
                    required: 'El símbolo es requerido',
                    minLength: { value: 1, message: 'Mínimo 1 caracter' },
                    maxLength: { value: 10, message: 'Máximo 10 caracteres' }
                  })}
                  error={!!unitErrors.symbol}
                  helperText={unitErrors.symbol?.message}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenUnitDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createUnitMutation.isPending}
            >
              {createUnitMutation.isPending ? 'Creando...' : 'Crear Unidad'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Diálogo para crear categoría */}
      <Dialog open={openCategoryDialog} onClose={() => setOpenCategoryDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmitCategory(onSubmitCategory)}>
          <DialogTitle>Nueva Categoría</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre de la Categoría"
                  {...registerCategory('name', { required: 'El nombre es requerido' })}
                  error={!!categoryErrors.name}
                  helperText={categoryErrors.name?.message}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  multiline
                  rows={3}
                  {...registerCategory('description')}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCategoryDialog(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}