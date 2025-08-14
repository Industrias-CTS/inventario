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
  Folder as FolderIcon,
  Visibility as VisibilityIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recipesService, Recipe } from '../services/recipes.service';
import { componentsService, Component } from '../services/components.service';
import { projectionsService, Projection as ProjectionType } from '../services/projections.service';

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

export default function Projection() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeProjection[]>([]);
  const [componentRequirements, setComponentRequirements] = useState<ComponentRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [projectionName, setProjectionName] = useState('');
  const [projectionDescription, setProjectionDescription] = useState('');
  const [savedProjections, setSavedProjections] = useState<ProjectionType[]>([]);
  const [selectedProjection, setSelectedProjection] = useState<ProjectionType | null>(null);
  const queryClient = useQueryClient();

  const saveProjectionMutation = useMutation({
    mutationFn: projectionsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      setOpenSaveDialog(false);
      setProjectionName('');
      setProjectionDescription('');
      alert('Proyección guardada exitosamente');
      loadSavedProjections(); // Recargar la lista
    },
    onError: (error: any) => {
      console.error('Error al guardar proyección:', error);
      alert(`Error al guardar proyección: ${error.response?.data?.error || error.message}`);
    },
  });

  const deleteProjectionMutation = useMutation({
    mutationFn: projectionsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      alert('Proyección eliminada exitosamente');
      loadSavedProjections(); // Recargar la lista
    },
    onError: (error: any) => {
      console.error('Error al eliminar proyección:', error);
      alert(`Error al eliminar proyección: ${error.response?.data?.error || error.message}`);
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

  const loadSavedProjections = async () => {
    try {
      const projections = await projectionsService.getAll();
      setSavedProjections(projections);
    } catch (err) {
      console.error('Error al cargar proyecciones guardadas:', err);
    }
  };

  const handleViewSavedProjections = () => {
    loadSavedProjections();
    setOpenViewDialog(true);
  };

  const handleViewProjectionDetail = async (projection: ProjectionType) => {
    try {
      const fullProjection = await projectionsService.getById(projection.id);
      setSelectedProjection(fullProjection);
      setOpenDetailDialog(true);
    } catch (err) {
      console.error('Error al cargar detalles de proyección:', err);
      alert('Error al cargar los detalles de la proyección');
    }
  };

  const handleDeleteProjection = (projectionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta proyección?')) {
      deleteProjectionMutation.mutate(projectionId);
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

  const generatePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const recipesHtml = selectedRecipes.map(({ recipe, quantity }) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${recipe.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${recipe.ingredients?.length || 0}</td>
      </tr>
    `).join('');

    const componentsHtml = componentRequirements.map(req => `
      <tr style="background-color: ${req.isAvailable ? '#f8f9fa' : '#fff3cd'};">
        <td style="padding: 8px; border: 1px solid #ddd;">${req.component.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${req.requiredQuantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${req.availableQuantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; ${req.shortage > 0 ? 'color: #dc3545; font-weight: bold;' : 'color: #28a745; font-weight: bold;'}">${req.shortage > 0 ? req.shortage : 'Completo'}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; color: white; background-color: ${req.isAvailable ? '#28a745' : '#dc3545'};">
            ${req.isAvailable ? 'Disponible' : 'Faltante'}
          </span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Proyección de Producción</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #007bff;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              color: #007bff;
              font-size: 28px;
            }
            .header .date {
              color: #666;
              font-size: 14px;
              margin-top: 10px;
            }
            .status-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 14px;
              margin: 10px 0;
              color: white;
              background-color: ${allComponentsAvailable ? '#28a745' : '#ffc107'};
            }
            .section {
              margin-bottom: 40px;
            }
            .section h2 {
              color: #007bff;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            th {
              background-color: #007bff;
              color: white;
              padding: 12px 8px;
              text-align: left;
              font-weight: bold;
            }
            th[style*="text-align: center"] {
              text-align: center;
            }
            th[style*="text-align: right"] {
              text-align: right;
            }
            td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .summary {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #007bff;
            }
            @media print {
              body { margin: 0; padding: 15px; }
              .section { page-break-inside: avoid; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Proyección de Producción</h1>
            <div class="date">Generado el ${dateStr}</div>
            <div class="status-badge">
              ${allComponentsAvailable ? '✅ Todos los componentes disponibles' : '⚠️ Hay componentes faltantes'}
            </div>
          </div>

          <div class="section">
            <h2>🔧 Recetas Seleccionadas</h2>
            <table>
              <thead>
                <tr>
                  <th>Nombre de la Receta</th>
                  <th style="text-align: center;">Cantidad a Producir</th>
                  <th style="text-align: center;">Componentes</th>
                </tr>
              </thead>
              <tbody>
                ${recipesHtml}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>📦 Requerimientos de Componentes</h2>
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th style="text-align: right;">Cantidad Requerida</th>
                  <th style="text-align: right;">Cantidad Disponible</th>
                  <th style="text-align: right;">Faltante</th>
                  <th style="text-align: center;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${componentsHtml}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <h3>📋 Resumen</h3>
            <ul>
              <li><strong>Total de recetas:</strong> ${selectedRecipes.length}</li>
              <li><strong>Total de componentes requeridos:</strong> ${componentRequirements.length}</li>
              <li><strong>Componentes disponibles:</strong> ${componentRequirements.filter(req => req.isAvailable).length}</li>
              <li><strong>Componentes faltantes:</strong> ${componentRequirements.filter(req => !req.isAvailable).length}</li>
              <li><strong>Estado general:</strong> ${allComponentsAvailable ? '✅ Factible - Se puede producir' : '⚠️ No factible - Faltan componentes'}</li>
            </ul>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Esperar a que se cargue el contenido antes de abrir el diálogo de impresión
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Proyección de Producción
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FolderIcon />}
          onClick={handleViewSavedProjections}
          sx={{ ml: 2 }}
        >
          Ver Proyecciones Guardadas
        </Button>
      </Box>

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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<GetAppIcon />}
                    onClick={generatePDF}
                    size="small"
                  >
                    Descargar PDF
                  </Button>
                  <Chip
                    icon={allComponentsAvailable ? <CheckCircleIcon /> : <WarningIcon />}
                    label={allComponentsAvailable ? 'Todos disponibles' : 'Hay faltantes'}
                    color={allComponentsAvailable ? 'success' : 'warning'}
                  />
                </Box>
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
                          {req.shortage > 0 ? (
                            <Typography color="error">
                              {req.shortage}
                            </Typography>
                          ) : (
                            <Typography color="success.main" fontWeight="bold">
                              Completo
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

      {/* Dialog para ver proyecciones guardadas */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Proyecciones Guardadas</DialogTitle>
        <DialogContent>
          {savedProjections.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No hay proyecciones guardadas
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="center">Recetas</TableCell>
                    <TableCell align="center">Items</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell>Creado por</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {savedProjections.map((projection) => (
                    <TableRow key={projection.id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {projection.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {projection.description || '-'}
                      </TableCell>
                      <TableCell align="center">{projection.total_recipes}</TableCell>
                      <TableCell align="center">{projection.total_items}</TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={projection.is_feasible ? <CheckCircleIcon /> : <WarningIcon />}
                          label={projection.is_feasible ? 'Factible' : 'Con Faltantes'}
                          color={projection.is_feasible ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {projection.username || 
                         `${projection.first_name || ''} ${projection.last_name || ''}`.trim() || 
                         'Usuario desconocido'}
                      </TableCell>
                      <TableCell>
                        {new Date(projection.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewProjectionDetail(projection)}
                            title="Ver detalles"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteProjection(projection.id)}
                            title="Eliminar proyección"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para ver detalles de proyección */}
      <Dialog 
        open={openDetailDialog} 
        onClose={() => setOpenDetailDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          {selectedProjection && (
            <Box>
              <Typography variant="h5" component="span">
                {selectedProjection.name}
              </Typography>
              <Chip
                icon={selectedProjection.is_feasible ? <CheckCircleIcon /> : <WarningIcon />}
                label={selectedProjection.is_feasible ? 'Factible' : 'Con Faltantes'}
                color={selectedProjection.is_feasible ? 'success' : 'warning'}
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedProjection && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                {selectedProjection.description && (
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    <strong>Descripción:</strong> {selectedProjection.description}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Creado por: {selectedProjection.username || 
                              `${selectedProjection.first_name || ''} ${selectedProjection.last_name || ''}`.trim() || 
                              'Usuario desconocido'} el {new Date(selectedProjection.created_at).toLocaleDateString('es-ES')}
                </Typography>
              </Grid>

              {/* Recetas de la proyección */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Recetas ({selectedProjection.recipes?.length || 0})
                  </Typography>
                  {selectedProjection.recipes && selectedProjection.recipes.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Código</TableCell>
                            <TableCell>Nombre</TableCell>
                            <TableCell align="right">Cantidad</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedProjection.recipes.map((recipe) => (
                            <TableRow key={recipe.id}>
                              <TableCell>{recipe.recipe_code || '-'}</TableCell>
                              <TableCell>{recipe.recipe_name || '-'}</TableCell>
                              <TableCell align="right">{recipe.quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography color="text.secondary">No hay recetas</Typography>
                  )}
                </Paper>
              </Grid>

              {/* Requerimientos de la proyección */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Requerimientos de Componentes
                  </Typography>
                  {selectedProjection.requirements && selectedProjection.requirements.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Componente</TableCell>
                            <TableCell align="right">Requerido</TableCell>
                            <TableCell align="right">Disponible</TableCell>
                            <TableCell align="center">Estado</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedProjection.requirements.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell>
                                <Typography variant="body2">
                                  {req.component_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {req.component_code}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {req.required_quantity} {req.unit_symbol}
                              </TableCell>
                              <TableCell align="right">
                                {req.available_quantity} {req.unit_symbol}
                              </TableCell>
                              <TableCell align="center">
                                {req.is_available ? (
                                  <Chip
                                    icon={<CheckCircleIcon />}
                                    label="Completo"
                                    color="success"
                                    size="small"
                                  />
                                ) : (
                                  <Chip
                                    icon={<WarningIcon />}
                                    label={req.shortage > 0 ? `Falta ${req.shortage}` : "Completo"}
                                    color={req.shortage > 0 ? "error" : "success"}
                                    size="small"
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography color="text.secondary">No hay requerimientos</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailDialog(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}