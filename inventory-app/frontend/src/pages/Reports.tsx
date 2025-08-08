import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
} from '@mui/material';
import {
  GetApp,
  Inventory,
  SwapHoriz,
  Warning,
  BookmarkBorder,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import api from '../services/api';

interface ReportCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  filename: string;
  hasDateRange?: boolean;
}

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const reportCards: ReportCard[] = [
    {
      title: 'Reporte de Inventario',
      description: 'Lista completa de todos los componentes con stock actual, m�nimo y ubicaci�n',
      icon: <Inventory color="primary" />,
      endpoint: '/reports/inventory',
      filename: 'reporte-inventario.pdf',
    },
    {
      title: 'Reporte de Movimientos',
      description: 'Historial de todas las entradas y salidas de inventario',
      icon: <SwapHoriz color="secondary" />,
      endpoint: '/reports/movements',
      filename: 'reporte-movimientos.pdf',
      hasDateRange: true,
    },
    {
      title: 'Reporte de Stock Bajo',
      description: 'Componentes que est�n por debajo del stock m�nimo establecido',
      icon: <Warning color="warning" />,
      endpoint: '/reports/low-stock',
      filename: 'reporte-stock-bajo.pdf',
    },
    {
      title: 'Reporte de Reservas',
      description: 'Lista de todas las reservas activas y completadas',
      icon: <BookmarkBorder color="info" />,
      endpoint: '/reports/reservations',
      filename: 'reporte-reservas.pdf',
    },
  ];

  const downloadReport = async (report: ReportCard) => {
    try {
      setLoading(report.title);
      setError(null);

      let url = report.endpoint;
      const params = new URLSearchParams();

      // A�adir par�metros de fecha si es necesario
      if (report.hasDateRange && startDate && endDate) {
        params.append('start_date', format(startDate, 'yyyy-MM-dd'));
        params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await api.get(url, {
        responseType: 'blob',
      });

      // Crear un blob y descargar el archivo
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = report.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Error descargando reporte:', err);
      setError(`Error al generar el reporte: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Reportes</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filtros de Fecha (para Reporte de Movimientos)
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <DatePicker
              label="Fecha de Inicio"
              value={startDate}
              onChange={setStartDate}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <DatePicker
              label="Fecha de Fin"
              value={endDate}
              onChange={setEndDate}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              variant="outlined"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              size="small"
            >
              Limpiar Fechas
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {reportCards.map((report) => (
          <Grid item xs={12} sm={6} md={4} key={report.title}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  {report.icon}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {report.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {report.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  variant="contained"
                  startIcon={<GetApp />}
                  onClick={() => downloadReport(report)}
                  disabled={loading === report.title}
                  fullWidth
                >
                  {loading === report.title ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Informaci�n sobre los Reportes
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Los reportes se generan en formato PDF y contienen tablas con la informaci�n m�s actualizada del sistema.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          " <strong>Reporte de Inventario:</strong> Muestra el estado actual de todos los componentes
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          " <strong>Reporte de Movimientos:</strong> Historial de entradas y salidas (opcionalmente filtrado por fecha)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          " <strong>Reporte de Stock Bajo:</strong> Componentes que requieren reposici�n
        </Typography>
        <Typography variant="body2" color="text.secondary">
          " <strong>Reporte de Reservas:</strong> Estado de todas las reservas del sistema
        </Typography>
      </Paper>
    </Box>
  );
}