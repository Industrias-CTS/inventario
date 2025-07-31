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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  Search,
  Refresh,
  Visibility,
  AddCircle,
  RemoveCircle,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { recipesService } from '../services/recipes.service';
import { componentsService } from '../services/components.service';
import { authService } from '../services/auth.service';
import { Recipe } from '../types';

interface RecipeFormData {
  code: string;
  name: string;
  description?: string;
  output_component_id: string;
  output_quantity: number;
  ingredients: Array<{
    component_id: string;
    quantity: number;
  }>;
}

export default function Recipes() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(false);
  const queryClient = useQueryClient();
  
  // Obtener usuario actual para verificar permisos
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['recipes', searchTerm],
    queryFn: () => recipesService.getRecipes({ search: searchTerm }),
  });

  const { data: componentsData } = useQuery({
    queryKey: ['components'],
    queryFn: () => componentsService.getComponents({ is_active: true }),
  });

  const createMutation = useMutation({
    mutationFn: recipesService.createRecipe,
    onSuccess: () => {
      console.log('Recipe created successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setOpenDialog(false);
      reset({
        code: '',
        name: '',
        description: '',
        output_component_id: '',
        output_quantity: 1,
        ingredients: [{ component_id: '', quantity: 1 }],
      });
    },
    onError: (error: any) => {
      console.error('Error al crear receta:', error);
      alert(`Error al crear receta: ${error.response?.data?.error || error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecipeFormData }) =>
      recipesService.updateRecipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setOpenDialog(false);
      setSelectedRecipe(null);
      reset();
    },
    onError: (error: any) => {
      console.error('Error al actualizar receta:', error);
      alert(`Error al actualizar receta: ${error.response?.data?.error || error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: recipesService.deleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<RecipeFormData>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      output_component_id: '',
      output_quantity: 1,
      ingredients: [{ component_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ingredients',
  });

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Código', width: 100 },
    { field: 'name', headerName: 'Nombre', flex: 1, minWidth: 150 },
    { field: 'description', headerName: 'Descripción', flex: 1, minWidth: 150,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'output_component_name',
      headerName: 'Producto Final',
      width: 160,
      renderCell: (params) => (
        <Chip 
          label={`${params.value} (${params.row.output_quantity} ${params.row.output_unit_symbol})`}
          color="primary"
          size="small"
        />
      ),
    },
    {
      field: 'ingredients_count',
      headerName: 'Ingredientes',
      width: 100,
      type: 'number',
      valueGetter: (params) => params.row.ingredients?.length || 0,
    },
    {
      field: 'total_cost',
      headerName: 'Costo Total',
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold" color="secondary">
          ${params.value?.toFixed(2) || '0.00'}
        </Typography>
      ),
    },
    {
      field: 'unit_cost',
      headerName: 'Costo Unitario',
      width: 120,
      type: 'number',
      renderCell: (params) => `$${params.value?.toFixed(2) || '0.00'}`,
    },
    {
      field: 'is_active',
      headerName: 'Estado',
      width: 90,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Activa' : 'Inactiva'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
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
            title="Ver receta"
          >
            <Visibility />
          </IconButton>
          {isAdmin && (
            <>
              <IconButton
                size="small"
                onClick={() => handleEdit(params.row)}
                color="primary"
                title="Editar receta"
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(params.row.id)}
                color="error"
                title="Eliminar receta"
              >
                <Delete />
              </IconButton>
            </>
          )}
        </>
      ),
    },
  ];

  const handleView = async (recipe: Recipe) => {
    try {
      const fullRecipe = await recipesService.getRecipeById(recipe.id);
      setSelectedRecipe(fullRecipe.recipe);
      setViewMode(true);
      setOpenDialog(true);
    } catch (error) {
      console.error('Error al cargar receta:', error);
    }
  };

  const handleEdit = async (recipe: Recipe) => {
    try {
      const fullRecipe = await recipesService.getRecipeById(recipe.id);
      const recipeData = fullRecipe.recipe;
      
      setSelectedRecipe(recipeData);
      
      // Resetear completamente el formulario con los nuevos datos
      const ingredients = recipeData.ingredients || [];
      const formData = {
        code: recipeData.code,
        name: recipeData.name,
        description: recipeData.description || '',
        output_component_id: recipeData.output_component_id,
        output_quantity: recipeData.output_quantity,
        ingredients: ingredients.map(ing => ({
          component_id: ing.component_id,
          quantity: ing.quantity
        }))
      };
      
      reset(formData);
      
      setViewMode(false);
      setOpenDialog(true);
    } catch (error) {
      console.error('Error al cargar receta:', error);
      alert('Error al cargar la receta para edición');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta receta?')) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: RecipeFormData) => {
    console.log('Form submitted with data:', data);
    if (selectedRecipe && !viewMode) {
      console.log('Updating recipe:', selectedRecipe.id);
      updateMutation.mutate({ id: selectedRecipe.id, data });
    } else if (!viewMode) {
      console.log('Creating new recipe');
      createMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRecipe(null);
    setViewMode(false);
    reset({
      code: '',
      name: '',
      description: '',
      output_component_id: '',
      output_quantity: 1,
      ingredients: [{ component_id: '', quantity: 1 }],
    });
  };

  const addIngredient = () => {
    append({ component_id: '', quantity: 1 });
  };

  const removeIngredient = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Log para debug cuando se abra el diálogo
  React.useEffect(() => {
    if (openDialog && selectedRecipe && !viewMode) {
      console.log('Receta seleccionada para edición:', selectedRecipe);
      console.log('Ingredientes del formulario (fields):', fields);
      console.log('Ingredientes de la receta:', selectedRecipe.ingredients);
    }
  }, [openDialog, selectedRecipe, viewMode, fields]);


  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Recetas</Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              console.log('Opening dialog for new recipe');
              setSelectedRecipe(null);
              setViewMode(false);
              reset({
                code: '',
                name: '',
                description: '',
                output_component_id: '',
                output_quantity: 1,
                ingredients: [{ component_id: '', quantity: 1 }],
              });
              setOpenDialog(true);
            }}
          >
            Nueva Receta
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar recetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'action.disabled' }} />,
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          <IconButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['recipes'] })}
          >
            <Refresh />
          </IconButton>
        </Box>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={data?.recipes || []}
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        {viewMode ? (
          <>
            <DialogTitle>Ver Receta</DialogTitle>
            <DialogContent>
              {selectedRecipe && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Información General
                        </Typography>
                        <Typography><strong>Código:</strong> {selectedRecipe.code}</Typography>
                        <Typography><strong>Nombre:</strong> {selectedRecipe.name}</Typography>
                        {selectedRecipe.description && (
                          <Typography><strong>Descripción:</strong> {selectedRecipe.description}</Typography>
                        )}
                        <Typography>
                          <strong>Producto Final:</strong> {selectedRecipe.output_component_name} 
                          ({selectedRecipe.output_quantity} {selectedRecipe.output_unit_symbol})
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Ingredientes
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Componente</TableCell>
                                <TableCell align="right">Cantidad</TableCell>
                                <TableCell>Unidad</TableCell>
                                <TableCell align="right">Costo Unit.</TableCell>
                                <TableCell align="right">Costo Total</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedRecipe.ingredients?.map((ingredient) => (
                                <TableRow key={ingredient.id}>
                                  <TableCell>{ingredient.component_name}</TableCell>
                                  <TableCell align="right">{ingredient.quantity}</TableCell>
                                  <TableCell>{ingredient.unit_symbol}</TableCell>
                                  <TableCell align="right">
                                    ${ingredient.cost_price?.toFixed(2) || '0.00'}
                                  </TableCell>
                                  <TableCell align="right">
                                    ${ingredient.ingredient_cost?.toFixed(2) || '0.00'}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={4} align="right">
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    Costo Total de la Receta:
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="subtitle1" fontWeight="bold" color="secondary">
                                    ${selectedRecipe.total_cost?.toFixed(2) || '0.00'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} align="right">
                                  <Typography variant="body2">
                                    Costo por {selectedRecipe.output_unit_symbol}:
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" color="primary">
                                    ${selectedRecipe.unit_cost?.toFixed(2) || '0.00'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Cerrar</Button>
            </DialogActions>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogTitle>
              {selectedRecipe ? 'Editar Receta' : 'Nueva Receta'}
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
                <Grid item xs={12} sm={8}>
                  <Controller
                    name="output_component_id"
                    control={control}
                    rules={{ required: 'El producto final es requerido' }}
                    render={({ field, fieldState }) => (
                      <TextField
                        fullWidth
                        label="Producto Final"
                        select
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      >
                        <MenuItem value="">Seleccionar...</MenuItem>
                        {componentsData?.components.map((component) => (
                          <MenuItem key={component.id} value={component.id}>
                            {component.name} ({component.unit_symbol})
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Cantidad de Salida"
                    type="number"
                    {...register('output_quantity', { 
                      required: 'La cantidad es requerida',
                      min: { value: 0.01, message: 'Debe ser mayor a 0' },
                      valueAsNumber: true
                    })}
                    inputProps={{ step: '0.01' }}
                    error={!!errors.output_quantity}
                    helperText={errors.output_quantity?.message}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Ingredientes</Typography>
                    <Button
                      type="button"
                      startIcon={<AddCircle />}
                      onClick={addIngredient}
                      color="primary"
                    >
                      Agregar Ingrediente
                    </Button>
                  </Box>
                  
                  {fields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={8}>
                        <Controller
                          name={`ingredients.${index}.component_id`}
                          control={control}
                          rules={{ required: 'El componente es requerido' }}
                          render={({ field: controllerField, fieldState }) => (
                            <TextField
                              fullWidth
                              label="Componente"
                              select
                              value={controllerField.value || ''}
                              onChange={controllerField.onChange}
                              error={!!fieldState.error}
                              helperText={fieldState.error?.message}
                            >
                              <MenuItem value="">Seleccionar...</MenuItem>
                              {componentsData?.components.map((component) => (
                                <MenuItem key={component.id} value={component.id}>
                                  {component.name} ({component.unit_symbol})
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      </Grid>
                      <Grid item xs={10} sm={3}>
                        <Controller
                          name={`ingredients.${index}.quantity`}
                          control={control}
                          rules={{ 
                            required: 'La cantidad es requerida',
                            min: { value: 0.01, message: 'Debe ser mayor a 0' }
                          }}
                          render={({ field: controllerField, fieldState }) => (
                            <TextField
                              fullWidth
                              label="Cantidad"
                              type="number"
                              value={controllerField.value || ''}
                              onChange={(e) => controllerField.onChange(parseFloat(e.target.value) || 0)}
                              inputProps={{ step: '0.01' }}
                              error={!!fieldState.error}
                              helperText={fieldState.error?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={2} sm={1}>
                        <IconButton
                          color="error"
                          onClick={() => removeIngredient(index)}
                          disabled={fields.length === 1}
                          sx={{ mt: 1 }}
                        >
                          <RemoveCircle />
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}
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
                {selectedRecipe ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </Box>
  );
}