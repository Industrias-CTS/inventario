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
import { useForm } from 'react-hook-form';
import { componentsService } from '../services/components.service';
import { unitsService } from '../services/units.service';
import { categoriesService } from '../services/categories.service';
import { Component } from '../types';

export default function Components() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Partial<Component>>();

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
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={() => handleView(params.row)}
            color="info"
          >
            <Visibility />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleEdit(params.row)}
            color="primary"
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            color="error"
          >
            <Delete />
          </IconButton>
        </>
      ),
    },
  ];

  const handleView = (component: Component) => {
    // Implementar vista detallada
    console.log('Ver componente:', component);
  };

  const handleEdit = (component: Component) => {
    setSelectedComponent(component);
    setValue('code', component.code);
    setValue('name', component.name);
    setValue('description', component.description);
    setValue('min_stock', component.min_stock);
    setValue('max_stock', component.max_stock);
    setValue('location', component.location);
    setValue('cost_price', component.cost_price);
    setValue('sale_price', component.sale_price);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este componente?')) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: Partial<Component>) => {
    if (selectedComponent) {
      updateMutation.mutate({ id: selectedComponent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedComponent(null);
    reset();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Componentes de Inventario</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          Nuevo Componente
        </Button>
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
                <TextField
                  fullWidth
                  label="Categoría"
                  select
                  defaultValue=""
                  {...register('category_id')}
                >
                  <MenuItem value="">Sin categoría</MenuItem>
                  {categoriesData?.categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Unidad"
                  select
                  defaultValue=""
                  {...register('unit_id', { required: 'La unidad es requerida' })}
                  error={!!errors.unit_id}
                  helperText={errors.unit_id?.message}
                >
                  <MenuItem value="">Seleccionar...</MenuItem>
                  {unitsData?.units.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio de Costo"
                  type="number"
                  {...register('cost_price', { min: 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio de Venta"
                  type="number"
                  {...register('sale_price', { min: 0 })}
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
    </Box>
  );
}