import React from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import { Add } from '@mui/icons-material';

export default function Recipes() {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Recetas</Typography>
        <Button variant="contained" startIcon={<Add />}>
          Nueva Receta
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Alert severity="info">
          El módulo de recetas se encuentra en desarrollo. Próximamente podrás crear
          y gestionar recetas para facilitar las asignaciones de componentes por grupo.
        </Alert>
      </Paper>
    </Box>
  );
}