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
  MenuItem,
  TextField,
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
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../services/api';

// Extender jsPDF con autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface ReportCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  type: 'inventory' | 'movements' | 'low-stock' | 'reservations';
  hasDateRange?: boolean;
}

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [movementType, setMovementType] = useState<string>('all');

  const reportCards: ReportCard[] = [
    {
      title: 'Reporte de Inventario',
      description: 'Lista completa de todos los componentes con stock actual, mínimo y ubicación',
      icon: <Inventory color="primary" />,
      type: 'inventory',
    },
    {
      title: 'Reporte de Movimientos',
      description: 'Historial de todas las entradas y salidas de inventario',
      icon: <SwapHoriz color="secondary" />,
      type: 'movements',
      hasDateRange: true,
    },
    {
      title: 'Reporte de Stock Bajo',
      description: 'Componentes que están por debajo del stock mínimo establecido',
      icon: <Warning color="warning" />,
      type: 'low-stock',
    },
    {
      title: 'Reporte de Reservas',
      description: 'Lista de todas las reservas activas del sistema',
      icon: <BookmarkBorder color="info" />,
      type: 'reservations',
    },
  ];

  const generateMovementsPDF = async (data: any) => {
    try {
      console.log('Generando PDF de movimientos con datos:', data);
      
      if (!data || !data.movements || !Array.isArray(data.movements)) {
        throw new Error('Datos de movimientos inválidos o vacíos');
      }

      const doc = new jsPDF();
      
      // Título del reporte
      doc.setFontSize(20);
      doc.text('Reporte de Movimientos', 14, 20);
      
      // Información del reporte
      doc.setFontSize(10);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 30);
      
      if (startDate && endDate) {
        const start = format(startDate, 'dd/MM/yyyy', { locale: es });
        const end = format(endDate, 'dd/MM/yyyy', { locale: es });
        doc.text(`Período: ${start} - ${end}`, 14, 36);
      }
      
      if (movementType !== 'all') {
        doc.text(`Tipo: ${movementType}`, 14, 42);
      }
      
      // Estadísticas
      if (data.stats) {
        doc.setFontSize(12);
        doc.text('Resumen:', 14, 52);
        doc.setFontSize(10);
        doc.text(`Total de movimientos: ${data.stats.totalMovements}`, 14, 58);
        doc.text(`Entradas: ${data.stats.totalIn || 0}`, 14, 64);
        doc.text(`Salidas: ${data.stats.totalOut || 0}`, 14, 70);
        doc.text(`Costo total: $${(data.stats.totalCost || 0).toFixed(2)}`, 14, 76);
      }
      
      // Validar que hay movimientos para mostrar
      if (data.movements.length === 0) {
        doc.text('No se encontraron movimientos para el período seleccionado.', 14, 90);
      } else {
        // Tabla de movimientos
        const tableData = data.movements.map((m: any) => [
          m.created_at ? format(new Date(m.created_at), 'dd/MM/yyyy HH:mm') : '-',
          m.movement_type || '-',
          m.component_name || '-',
          (m.quantity || 0).toString(),
          m.unit_symbol || 'unit',
          `$${(m.unit_cost || 0).toFixed(2)}`,
          `$${(m.total_cost || 0).toFixed(2)}`,
          m.reference_number || '-',
          m.username || 'Sistema'
        ]);
        
        doc.autoTable({
          head: [['Fecha', 'Tipo', 'Componente', 'Cant.', 'Unidad', 'C. Unit.', 'C. Total', 'Ref.', 'Usuario']],
          body: tableData,
          startY: 85,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 18 },
            2: { cellWidth: 40 },
            3: { cellWidth: 15, halign: 'right' },
            4: { cellWidth: 15 },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 20, halign: 'right' },
            7: { cellWidth: 20 },
            8: { cellWidth: 20 },
          },
        });
      }
      
      // Guardar el PDF
      const filename = `movimientos_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      console.log('Guardando PDF:', filename);
      doc.save(filename);
      
    } catch (error: any) {
      console.error('Error en generateMovementsPDF:', error);
      throw new Error(`Error generando PDF de movimientos: ${error.message || error}`);
    }
  };

  const generateInventoryPDF = async (data: any) => {
    try {
      console.log('Generando PDF de inventario con datos:', data);
      
      if (!data || !data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Datos de inventario inválidos o vacíos');
      }

      const doc = new jsPDF('landscape');
      
      // Título
      doc.setFontSize(20);
      doc.text('Reporte de Inventario', 14, 20);
      
      // Información del reporte
      doc.setFontSize(10);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 30);
      
      // Estadísticas
      if (data.stats) {
        doc.text(`Total de componentes: ${data.stats.totalComponents}`, 14, 36);
        doc.text(`Valor total: $${(data.stats.totalValue || 0).toFixed(2)}`, 14, 42);
        doc.text(`Stock bajo: ${data.stats.lowStockCount}`, 100, 36);
        doc.text(`Stock óptimo: ${data.stats.optimalStockCount}`, 100, 42);
      }
      
      if (data.inventory.length === 0) {
        doc.text('No se encontraron componentes en el inventario.', 14, 55);
      } else {
        // Tabla de inventario
        const tableData = data.inventory.map((item: any) => [
          item.code || '-',
          item.name || '-',
          item.category_name || '-',
          (item.current_stock || 0).toString(),
          (item.reserved_stock || 0).toString(),
          (item.available_stock || 0).toString(),
          (item.min_stock || 0).toString(),
          (item.max_stock || 0).toString(),
          item.unit_symbol || 'unit',
          `$${(item.cost_price || 0).toFixed(2)}`,
          `$${(item.total_value || 0).toFixed(2)}`
        ]);
        
        doc.autoTable({
          head: [['Código', 'Nombre', 'Categoría', 'Stock', 'Reservado', 'Disponible', 'Mín.', 'Máx.', 'Unidad', 'Costo', 'Valor Total']],
          body: tableData,
          startY: 50,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [66, 139, 202] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 45 },
            2: { cellWidth: 30 },
            3: { cellWidth: 18, halign: 'right' },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 15, halign: 'right' },
            7: { cellWidth: 15, halign: 'right' },
            8: { cellWidth: 18 },
            9: { cellWidth: 20, halign: 'right' },
            10: { cellWidth: 25, halign: 'right' },
          },
        });
      }
      
      // Guardar el PDF
      const filename = `inventario_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      console.log('Guardando PDF:', filename);
      doc.save(filename);
      
    } catch (error: any) {
      console.error('Error en generateInventoryPDF:', error);
      throw new Error(`Error generando PDF de inventario: ${error.message || error}`);
    }
  };

  const generateLowStockPDF = async (data: any) => {
    try {
      console.log('Generando PDF de stock bajo con datos:', data);
      
      if (!data || !data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Datos de inventario inválidos o vacíos');
      }

      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.text('Reporte de Stock Bajo', 14, 20);
      
      // Información
      doc.setFontSize(10);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 30);
      
      // Filtrar componentes con stock bajo
      const lowStockItems = data.inventory.filter((item: any) => 
        (item.current_stock || 0) <= (item.min_stock || 0)
      );
      
      doc.text(`Componentes con stock bajo: ${lowStockItems.length}`, 14, 36);
      
      if (lowStockItems.length === 0) {
        doc.text('¡Excelente! No hay componentes con stock bajo.', 14, 50);
      } else {
        // Tabla
        const tableData = lowStockItems.map((item: any) => [
          item.code || '-',
          item.name || '-',
          item.category_name || '-',
          (item.current_stock || 0).toString(),
          (item.min_stock || 0).toString(),
          Math.max(0, (item.min_stock || 0) - (item.current_stock || 0)).toString(),
          item.unit_symbol || 'unit',
          `$${(item.cost_price || 0).toFixed(2)}`
        ]);
        
        doc.autoTable({
          head: [['Código', 'Nombre', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Faltante', 'Unidad', 'Costo Unit.']],
          body: tableData,
          startY: 45,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [239, 68, 68] },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 50 },
            2: { cellWidth: 30 },
            3: { cellWidth: 22, halign: 'right' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 20, halign: 'right' },
            6: { cellWidth: 18 },
            7: { cellWidth: 22, halign: 'right' },
          },
        });
      }
      
      // Guardar
      const filename = `stock_bajo_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      console.log('Guardando PDF:', filename);
      doc.save(filename);
      
    } catch (error: any) {
      console.error('Error en generateLowStockPDF:', error);
      throw new Error(`Error generando PDF de stock bajo: ${error.message || error}`);
    }
  };

  const generateReservationsPDF = async () => {
    try {
      console.log('Generando PDF de reservas');
      
      // Obtener datos de reservas desde el inventario (componentes con reserved_stock > 0)
      const response = await api.get('/reports/inventory');
      const inventoryData = response.data;
      
      if (!inventoryData || !inventoryData.data || !inventoryData.data.inventory) {
        throw new Error('No se pudieron obtener los datos de inventario');
      }
      
      // Filtrar solo componentes con stock reservado
      const reservations = inventoryData.data.inventory.filter((item: any) => 
        (item.reserved_stock || 0) > 0
      );
      
      console.log('Reservas encontradas:', reservations.length);
      
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(20);
      doc.text('Reporte de Reservas', 14, 20);
      
      // Información
      doc.setFontSize(10);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 30);
      doc.text(`Total de componentes con reservas: ${reservations.length}`, 14, 36);
      
      if (reservations.length === 0) {
        doc.text('No hay componentes con stock reservado actualmente.', 14, 50);
      } else {
        // Tabla
        const tableData = reservations.map((item: any) => [
          item.code || '-',
          item.name || '-',
          (item.current_stock || 0).toString(),
          (item.reserved_stock || 0).toString(),
          (item.available_stock || 0).toString(),
          item.unit_symbol || 'unit'
        ]);
        
        doc.autoTable({
          head: [['Código', 'Componente', 'Stock Total', 'Reservado', 'Disponible', 'Unidad']],
          body: tableData,
          startY: 45,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [79, 70, 229] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 60 },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 20 },
          },
        });
      }
      
      // Guardar
      const filename = `reservas_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      console.log('Guardando PDF:', filename);
      doc.save(filename);
      
    } catch (error: any) {
      console.error('Error en generateReservationsPDF:', error);
      throw new Error(`Error generando PDF de reservas: ${error.message || error}`);
    }
  };

  const downloadReport = async (report: ReportCard) => {
    try {
      setLoading(report.title);
      setError(null);

      switch (report.type) {
        case 'movements':
          // Obtener datos de movimientos
          const params = new URLSearchParams();
          if (startDate) params.append('startDate', format(startDate, 'yyyy-MM-dd'));
          if (endDate) params.append('endDate', format(endDate, 'yyyy-MM-dd'));
          if (movementType !== 'all') params.append('movementType', movementType);
          
          const movResponse = await api.get(`/reports/movements?${params.toString()}`);
          await generateMovementsPDF(movResponse.data.data);
          break;
          
        case 'inventory':
          // Obtener datos de inventario
          const invResponse = await api.get('/reports/inventory');
          await generateInventoryPDF(invResponse.data.data);
          break;
          
        case 'low-stock':
          // Obtener datos de inventario y filtrar stock bajo
          const stockResponse = await api.get('/reports/inventory');
          await generateLowStockPDF(stockResponse.data.data);
          break;
          
        case 'reservations':
          // Generar reporte de reservas
          await generateReservationsPDF();
          break;
      }
    } catch (err: any) {
      console.error('Error generando reporte:', err);
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
          Filtros para Reportes
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
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
          <Grid item xs={12} sm={3}>
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
          <Grid item xs={12} sm={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Tipo de Movimiento"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="entrada">Entradas</MenuItem>
              <MenuItem value="salida">Salidas</MenuItem>
              <MenuItem value="reserva">Reservas</MenuItem>
              <MenuItem value="liberacion">Liberaciones</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              variant="outlined"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setMovementType('all');
              }}
              size="small"
              fullWidth
            >
              Limpiar Filtros
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {reportCards.map((report) => (
          <Grid item xs={12} sm={6} md={3} key={report.title}>
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
                {report.hasDateRange && startDate && endDate && (
                  <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                    {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  variant="contained"
                  startIcon={<GetApp />}
                  onClick={() => downloadReport(report)}
                  disabled={loading === report.title}
                  fullWidth
                  size="small"
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
          Información sobre los Reportes
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Los reportes se generan en formato PDF con la información más actualizada del sistema.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              • <strong>Inventario:</strong> Estado actual de todos los componentes
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              • <strong>Movimientos:</strong> Historial filtrable por fecha y tipo
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              • <strong>Stock Bajo:</strong> Componentes que requieren reposición
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              • <strong>Reservas:</strong> Estado actual de las reservas
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}