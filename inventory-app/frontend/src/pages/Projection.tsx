import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Calculate as CalculateIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recipesService, Recipe } from '../services/recipes.service';
import { componentsService, Component } from '../services/components.service';
import { projectionsService } from '../services/projections.service';

interface RecipeProjection {
  recipe: Recipe;
  quantity: number;
}

interface ComponentRequirement {
  component: Component;
  requiredQuantity: number;
  availableQuantity: number;
  shortage: number;
  isAvailable: boolean;
}

export const Projection: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeProjection[]>([]);
  const [componentRequirements, setComponentRequirements] = useState<ComponentRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [projectionName, setProjectionName] = useState('');
  const [projectionDescription, setProjectionDescription] = useState('');
  const queryClient = useQueryClient();

  const saveProjectionMutation = useMutation({
    mutationFn: projectionsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      setOpenSaveDialog(false);
      setProjectionName('');
      setProjectionDescription('');
      alert('Proyección guardada exitosamente');
    },
    onError: (error: any) => {
      console.error('Error al guardar proyección:', error);
      alert(`Error al guardar proyección: ${error.response?.data?.error || error.message}`);
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recipesData, componentsData] = await Promise.all([
        recipesService.getAll(),
        componentsService.getAll(),
      ]);
      setRecipes(recipesData);
      setComponents(componentsData);
    } catch (err) {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const addRecipe = (recipe: Recipe) => {
    const existing = selectedRecipes.find(r => r.recipe.id === recipe.id);
    if (existing) {
      setSelectedRecipes(
        selectedRecipes.map(r =>
          r.recipe.id === recipe.id
            ? { ...r, quantity: r.quantity + 1 }
            : r
        )
      );
    } else {
      setSelectedRecipes([...selectedRecipes, { recipe, quantity: 1 }]);
    }
  };

  const updateQuantity = (recipeId: string, quantity: number) => {
    if (quantity <= 0) {
      removeRecipe(recipeId);
    } else {
      setSelectedRecipes(
        selectedRecipes.map(r =>
          r.recipe.id === recipeId ? { ...r, quantity } : r
        )
      );
    }
  };

  const removeRecipe = (recipeId: string) => {
    setSelectedRecipes(selectedRecipes.filter(r => r.recipe.id !== recipeId));
  };

  const calculateProjection = () => {
    const componentMap = new Map<string, ComponentRequirement>();

    // Calcular requerimientos totales
    selectedRecipes.forEach(({ recipe, quantity }) => {
      recipe.ingredients?.forEach(rc => {
        const componentId = rc.component_id;
        const requiredQty = rc.quantity * quantity;
        
        if (componentMap.has(componentId)) {
          const existing = componentMap.get(componentId)!;
          existing.requiredQuantity += requiredQty;
        } else {
          const component = components.find(c => c.id === componentId);
          if (component) {
            componentMap.set(componentId, {
              component,
              requiredQuantity: requiredQty,
              availableQuantity: component.current_stock || 0,
              shortage: 0,
              isAvailable: true,
            });
          }
        }
      });
    });

    // Calcular faltantes
    const requirements = Array.from(componentMap.values()).map(req => ({
      ...req,
      shortage: Math.max(0, req.requiredQuantity - req.availableQuantity),
      isAvailable: req.availableQuantity >= req.requiredQuantity,
    }));

    setComponentRequirements(requirements);
  };

  const clearProjection = () => {
    setSelectedRecipes([]);
    setComponentRequirements([]);
  };

  const handleSaveProjection = () => {
    if (componentRequirements.length === 0) {
      alert('Debes calcular la proyección antes de guardarla');
      return;
    }
    setOpenSaveDialog(true);
  };

  const handleConfirmSave = () => {
    if (!projectionName.trim()) {
      alert('El nombre de la proyección es requerido');
      return;
    }

    const recipes = selectedRecipes.map(sr => ({
      recipe_id: sr.recipe.id,
      quantity: sr.quantity,
    }));

    const requirements = componentRequirements.map(cr => ({
      component_id: cr.component.id,
      required_quantity: cr.requiredQuantity,
      available_quantity: cr.availableQuantity,
      shortage: cr.shortage,
      is_available: cr.isAvailable,
    }));

    saveProjectionMutation.mutate({
      name: projectionName,
      description: projectionDescription,
      recipes,
      requirements,
    });
  };

  const allComponentsAvailable = componentRequirements.length > 0 && 
    componentRequirements.every(req => req.isAvailable);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Proyección de Producción
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Selección de Recetas */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recetas Disponibles
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {recipes.map(recipe => (
                <Card
                  key={recipe.id}
                  sx={{ 
                    width: '100%', 
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => addRecipe(recipe)}
                >
                  <CardContent sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle1">{recipe.name}</Typography>
                      <IconButton size="small" color="primary">
                        <AddIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {recipe.ingredients?.length || 0} componentes
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Recetas Seleccionadas */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recetas Seleccionadas
            </Typography>
            {selectedRecipes.length === 0 ? (
              <Typography color="text.secondary">
                Selecciona recetas para proyectar
              </Typography>
            ) : (
              <Box>
                {selectedRecipes.map(({ recipe, quantity }) => (
                  <Box
                    key={recipe.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      mb: 2,
                      p: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1">{recipe.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => updateQuantity(recipe.id, quantity - 1)}
                      >
                        <RemoveIcon />
                      </IconButton>
                      <TextField
                        type="number"
                        value={quantity}
                        onChange={(e) => updateQuantity(recipe.id, parseInt(e.target.value) || 0)}
                        sx={{ width: 80 }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => updateQuantity(recipe.id, quantity + 1)}
                      >
                        <AddIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeRecipe(recipe.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<CalculateIcon />}
                    onClick={calculateProjection}
                    disabled={selectedRecipes.length === 0}
                  >
                    Calcular Proyección
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveProjection}
                    disabled={componentRequirements.length === 0}
                  >
                    Guardar Proyección
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={clearProjection}
                    disabled={selectedRecipes.length === 0}
                  >
                    Limpiar
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Resultados de la Proyección */}
        {componentRequirements.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Requerimientos de Componentes
                </Typography>
                <Chip
                  icon={allComponentsAvailable ? <CheckCircleIcon /> : <WarningIcon />}
                  label={allComponentsAvailable ? 'Todos disponibles' : 'Hay faltantes'}
                  color={allComponentsAvailable ? 'success' : 'warning'}
                />
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Componente</TableCell>
                      <TableCell align="right">Requerido</TableCell>
                      <TableCell align="right">Disponible</TableCell>
                      <TableCell align="right">Faltante</TableCell>
                      <TableCell align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {componentRequirements.map((req) => (
                      <TableRow key={req.component.id}>
                        <TableCell>{req.component.name}</TableCell>
                        <TableCell align="right">{req.requiredQuantity}</TableCell>
                        <TableCell align="right">{req.availableQuantity}</TableCell>
                        <TableCell align="right">
                          {req.shortage > 0 && (
                            <Typography color="error">
                              {req.shortage}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {req.isAvailable ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Disponible"
                              color="success"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<WarningIcon />}
                              label="Faltante"
                              color="error"
                              size="small"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Dialog para guardar proyección */}
      <Dialog open={openSaveDialog} onClose={() => setOpenSaveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Guardar Proyección</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre de la Proyección"
                placeholder="Ej: Producción Enero 2024"
                value={projectionName}
                onChange={(e) => setProjectionName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción (Opcional)"
                placeholder="Descripción adicional de la proyección"
                multiline
                rows={3}
                value={projectionDescription}
                onChange={(e) => setProjectionDescription(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSaveDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            disabled={saveProjectionMutation.isPending || !projectionName.trim()}
          >
            {saveProjectionMutation.isPending ? 'Guardando...' : 'Guardar Proyección'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};