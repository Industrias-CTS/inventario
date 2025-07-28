import React from 'react';
import {
  Grid,
  Paper,
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  Inventory,
  TrendingUp,
  TrendingDown,
  Warning,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { componentsService } from '../services/components.service';
import { movementsService } from '../services/movements.service';

export default function Dashboard() {
  const { data: componentsData, isLoading: componentsLoading } = useQuery({
    queryKey: ['components'],
    queryFn: () => componentsService.getComponents(),
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['movements-recent'],
    queryFn: () => {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return movementsService.getMovements({
        start_date: lastWeek.toISOString(),
        end_date: today.toISOString(),
      });
    },
  });

  const calculateStats = () => {
    if (!componentsData?.components) {
      return {
        totalComponents: 0,
        lowStockCount: 0,
        totalValue: 0,
        activeComponents: 0,
      };
    }

    const components = componentsData.components;
    const totalComponents = components.length;
    const lowStockCount = components.filter(
      (c) => c.current_stock <= c.min_stock
    ).length;
    const totalValue = components.reduce(
      (sum, c) => sum + c.current_stock * c.cost_price,
      0
    );
    const activeComponents = components.filter((c) => c.is_active).length;

    return {
      totalComponents,
      lowStockCount,
      totalValue,
      activeComponents,
    };
  };

  const stats = calculateStats();

  const StatCard = ({
    title,
    value,
    icon,
    color,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
  }) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4">{value}</Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (componentsLoading || movementsLoading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Componentes"
            value={stats.totalComponents}
            icon={<Inventory sx={{ color: 'white' }} />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Componentes Activos"
            value={stats.activeComponents}
            icon={<TrendingUp sx={{ color: 'white' }} />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Stock Bajo"
            value={stats.lowStockCount}
            icon={<Warning sx={{ color: 'white' }} />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Valor Total"
            value={`$${stats.totalValue.toFixed(2)}`}
            icon={<TrendingDown sx={{ color: 'white' }} />}
            color="#9c27b0"
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Movimientos Recientes
            </Typography>
            {movementsData?.movements && movementsData.movements.length > 0 ? (
              <Box>
                {movementsData.movements.slice(0, 10).map((movement) => (
                  <Box
                    key={movement.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: '1px solid #e0e0e0',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box>
                      <Typography variant="body1">
                        {movement.component_name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {movement.movement_type_name} - {movement.quantity}{' '}
                        unidades
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color={
                        movement.operation === 'IN'
                          ? 'success.main'
                          : 'error.main'
                      }
                    >
                      {movement.operation === 'IN' ? '+' : '-'}
                      {movement.quantity}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No hay movimientos recientes
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Componentes con Stock Bajo
            </Typography>
            {componentsData?.components &&
            componentsData.components.filter((c) => c.current_stock <= c.min_stock)
              .length > 0 ? (
              <Box>
                {componentsData.components
                  .filter((c) => c.current_stock <= c.min_stock)
                  .slice(0, 5)
                  .map((component) => (
                    <Box
                      key={component.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1,
                        borderBottom: '1px solid #e0e0e0',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Box>
                        <Typography variant="body1">{component.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          Código: {component.code}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="error">
                        {component.current_stock} / {component.min_stock}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Todos los componentes tienen stock adecuado
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}