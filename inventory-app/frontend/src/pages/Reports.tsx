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
import autoTable from 'jspdf-autotable';
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
      if (!data || !data.movements || !Array.isArray(data.movements)) {
        throw new Error('Datos de movimientos inválidos o vacíos');
      }

      const doc = new jsPDF();
      
      // Header principal
      doc.setFontSize(20);
      doc.setTextColor(40, 116, 166);
      doc.text('📊 Reporte de Movimientos', 14, 25);
      
      // Información del reporte
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 35);
      doc.text(`Total de movimientos: ${data.movements.length}`, 14, 40);
      
      // Filtros aplicados
      if (startDate && endDate) {
        doc.text(`Período: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`, 14, 45);
      }
      if (movementType !== 'all') {
        doc.text(`Tipo: ${movementType}`, 14, 50);
      }
      
      if (data.movements.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('No se encontraron movimientos con los filtros aplicados.', 14, 70);
      } else {
        // Preparar datos para la tabla
        const tableData = data.movements.map((m: any) => [
          m.created_at ? format(new Date(m.created_at), 'dd/MM/yyyy') : '-',
          m.movement_type || '-',
          m.component_name || '-',
          (m.quantity || 0).toString(),
          m.unit_cost ? `$${m.unit_cost.toFixed(2)}` : '-',
          m.total_cost ? `$${m.total_cost.toFixed(2)}` : '-',
          m.reference || '-'
        ]);
        
        autoTable(doc, {
          head: [['Fecha', 'Tipo', 'Componente', 'Cantidad', 'Costo Unit.', 'Costo Total', 'Referencia']],
          body: tableData,
          startY: 60,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [40, 116, 166], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 30 },
          },
        });
        
        // Resumen
        const totalCost = data.movements.reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0);
        const yPos = (doc as any).lastAutoTable?.finalY + 10 || 150;
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`💰 Valor total de movimientos: $${totalCost.toFixed(2)}`, 14, yPos);
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Sistema de Inventario - Industrias CTS', 14, pageHeight - 10);
      
      const filename = `movimientos_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(filename);
      
    } catch (error: any) {
      throw new Error(`Error generando PDF de movimientos: ${error.message || error}`);
    }
  };

  const generateInventoryPDF = async (data: any) => {
    try {
      if (!data || !data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Datos de inventario inválidos o vacíos');
      }

      const doc = new jsPDF();
      
      // Header principal  
      doc.setFontSize(20);
      doc.setTextColor(34, 139, 34);
      doc.text('📦 Reporte de Inventario', 14, 25);
      
      // Información del reporte
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 35);
      doc.text(`Total de componentes: ${data.inventory.length}`, 14, 40);
      
      // Estadísticas
      const totalValue = data.inventory.reduce((sum: number, item: any) => 
        sum + ((item.current_stock || 0) * (item.cost_price || 0)), 0);
      const lowStockCount = data.inventory.filter((item: any) => 
        (item.current_stock || 0) <= (item.min_stock || 0)).length;
      
      doc.text(`Valor total del inventario: $${totalValue.toFixed(2)}`, 14, 45);
      doc.text(`Componentes con stock bajo: ${lowStockCount}`, 14, 50);
      
      if (data.inventory.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('No se encontraron componentes en el inventario.', 14, 70);
      } else {
        // Preparar datos para la tabla
        const tableData = data.inventory.map((item: any) => {
          const stockStatus = (item.current_stock || 0) <= (item.min_stock || 0) ? '⚠️' : '✅';
          return [
            item.code || '-',
            item.name || '-',
            item.category_name || '-',
            (item.current_stock || 0).toString(),
            (item.min_stock || 0).toString(),
            (item.reserved_stock || 0).toString(),
            item.unit_symbol || 'unit',
            `$${(item.cost_price || 0).toFixed(2)}`,
            stockStatus
          ];
        });
        
        autoTable(doc, {
          head: [['Código', 'Nombre', 'Categoría', 'Stock', 'Mín.', 'Reserv.', 'Unidad', 'Costo', 'Estado']],
          body: tableData,
          startY: 60,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [34, 139, 34], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 40 },
            2: { cellWidth: 25 },
            3: { cellWidth: 15, halign: 'right' },
            4: { cellWidth: 15, halign: 'right' },
            5: { cellWidth: 15, halign: 'right' },
            6: { cellWidth: 15 },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 15, halign: 'center' },
          },
        });
        
        // Resumen en la parte inferior
        const yPos = (doc as any).lastAutoTable?.finalY + 10 || 150;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`📊 Resumen del Inventario`, 14, yPos);
        doc.setFontSize(10);
        doc.text(`• Total de componentes: ${data.inventory.length}`, 14, yPos + 10);
        doc.text(`• Valor total: $${totalValue.toFixed(2)}`, 14, yPos + 15);
        doc.text(`• Componentes con stock bajo: ${lowStockCount}`, 14, yPos + 20);
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Sistema de Inventario - Industrias CTS', 14, pageHeight - 10);
      
      const filename = `inventario_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(filename);
      
    } catch (error: any) {
      throw new Error(`Error generando PDF de inventario: ${error.message || error}`);
    }
  };

  const generateLowStockPDF = async (data: any) => {
    try {
      if (!data || !data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Datos de inventario inválidos o vacíos');
      }

      // Filtrar componentes con stock bajo
      const lowStockItems = data.inventory.filter((item: any) => 
        (item.current_stock || 0) <= (item.min_stock || 0)
      );

      const doc = new jsPDF();
      
      // Header principal
      doc.setFontSize(20);
      doc.setTextColor(220, 53, 69);
      doc.text('⚠️ Reporte de Stock Bajo', 14, 25);
      
      // Información del reporte
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 35);
      doc.text(`Componentes con stock bajo: ${lowStockItems.length}`, 14, 40);
      doc.text(`Total de componentes analizados: ${data.inventory.length}`, 14, 45);
      
      if (lowStockItems.length === 0) {
        doc.setFontSize(16);
        doc.setTextColor(34, 139, 34);
        doc.text('✅ ¡Excelente! No hay componentes con stock bajo.', 14, 70);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Todos los componentes están por encima del stock mínimo establecido.', 14, 85);
      } else {
        // Calcular valor total en riesgo
        const totalValueAtRisk = lowStockItems.reduce((sum: number, item: any) => {
          const shortage = Math.max(0, (item.min_stock || 0) - (item.current_stock || 0));
          return sum + (shortage * (item.cost_price || 0));
        }, 0);
        
        doc.text(`Valor total en riesgo: $${totalValueAtRisk.toFixed(2)}`, 14, 50);
        
        // Tabla
        const tableData = lowStockItems.map((item: any) => {
          const shortage = Math.max(0, (item.min_stock || 0) - (item.current_stock || 0));
          const priorityLevel = shortage > 0 ? 'CRÍTICO' : 'BAJO';
          return [
            item.code || '-',
            item.name || '-',
            item.category_name || '-',
            (item.current_stock || 0).toString(),
            (item.min_stock || 0).toString(),
            shortage.toString(),
            item.unit_symbol || 'unit',
            `$${(item.cost_price || 0).toFixed(2)}`,
            priorityLevel
          ];
        });
        
        autoTable(doc, {
          head: [['Código', 'Nombre', 'Categoría', 'Stock', 'Mínimo', 'Faltante', 'Unidad', 'Costo', 'Prioridad']],
          body: tableData,
          startY: 60,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [220, 53, 69], textColor: 255 },
          alternateRowStyles: { fillColor: [255, 245, 245] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 40 },
            2: { cellWidth: 25 },
            3: { cellWidth: 18, halign: 'right' },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 15 },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 20, halign: 'center' },
          },
        });
        
        // Recomendaciones
        const yPos = (doc as any).lastAutoTable?.finalY + 15 || 150;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('📋 Recomendaciones:', 14, yPos);
        doc.setFontSize(10);
        doc.text('• Revisar proveedores para componentes críticos', 14, yPos + 10);
        doc.text('• Programar reabastecimiento urgente', 14, yPos + 15);
        doc.text('• Considerar ajustar stocks mínimos', 14, yPos + 20);
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Sistema de Inventario - Industrias CTS', 14, pageHeight - 10);
      
      const filename = `stock_bajo_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(filename);
      
    } catch (error: any) {
      throw new Error(`Error generando PDF de stock bajo: ${error.message || error}`);
    }
  };

  const generateReservationsPDF = async () => {
    try {
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
      
      const doc = new jsPDF();
      
      // Header principal
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229);
      doc.text('🔖 Reporte de Reservas', 14, 25);
      
      // Información del reporte
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      doc.text(`Generado: ${today}`, 14, 35);
      doc.text(`Componentes con reservas: ${reservations.length}`, 14, 40);
      
      // Calcular estadísticas
      const totalReserved = reservations.reduce((sum: number, item: any) => 
        sum + (item.reserved_stock || 0), 0);
      const totalValueReserved = reservations.reduce((sum: number, item: any) => 
        sum + ((item.reserved_stock || 0) * (item.cost_price || 0)), 0);
      
      doc.text(`Total de unidades reservadas: ${totalReserved}`, 14, 45);
      doc.text(`Valor total reservado: $${totalValueReserved.toFixed(2)}`, 14, 50);
      
      if (reservations.length === 0) {
        doc.setFontSize(16);
        doc.setTextColor(34, 139, 34);
        doc.text('📋 No hay componentes con stock reservado actualmente.', 14, 70);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Todas las unidades del inventario están disponibles para uso.', 14, 85);
      } else {
        // Tabla
        const tableData = reservations.map((item: any) => {
          const availableStock = (item.current_stock || 0) - (item.reserved_stock || 0);
          const reservationPercent = ((item.reserved_stock || 0) / (item.current_stock || 1) * 100).toFixed(1);
          return [
            item.code || '-',
            item.name || '-',
            item.category_name || '-',
            (item.current_stock || 0).toString(),
            (item.reserved_stock || 0).toString(),
            availableStock.toString(),
            `${reservationPercent}%`,
            item.unit_symbol || 'unit',
            `$${(item.cost_price || 0).toFixed(2)}`
          ];
        });
        
        autoTable(doc, {
          head: [['Código', 'Componente', 'Categoría', 'Total', 'Reservado', 'Disponible', '% Reserv.', 'Unidad', 'Costo']],
          body: tableData,
          startY: 60,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [79, 70, 229], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 255] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 40 },
            2: { cellWidth: 25 },
            3: { cellWidth: 18, halign: 'right' },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 20, halign: 'right' },
            7: { cellWidth: 15 },
            8: { cellWidth: 20, halign: 'right' },
          },
        });
        
        // Resumen
        const yPos = (doc as any).lastAutoTable?.finalY + 15 || 150;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('📊 Resumen de Reservas:', 14, yPos);
        doc.setFontSize(10);
        doc.text(`• Total de componentes con reservas: ${reservations.length}`, 14, yPos + 10);
        doc.text(`• Total de unidades reservadas: ${totalReserved}`, 14, yPos + 15);
        doc.text(`• Valor total reservado: $${totalValueReserved.toFixed(2)}`, 14, yPos + 20);
        
        // Recomendaciones
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('💡 Revisar regularmente las reservas para liberar stock no utilizado', 14, yPos + 30);
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Sistema de Inventario - Industrias CTS', 14, pageHeight - 10);
      
      const filename = `reservas_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(filename);
      
    } catch (error: any) {
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
          
          console.log('Solicitando datos de movimientos...');
          const movResponse = await api.get(`/reports/movements?${params.toString()}`);
          console.log('Datos de movimientos recibidos:', movResponse.data);
          await generateMovementsPDF(movResponse.data.data);
          break;
          
        case 'inventory':
          // Obtener datos de inventario
          console.log('Solicitando datos de inventario...');
          const invResponse = await api.get('/reports/inventory');
          console.log('Datos de inventario recibidos:', invResponse.data);
          await generateInventoryPDF(invResponse.data.data);
          break;
          
        case 'low-stock':
          // Obtener datos de inventario y filtrar stock bajo
          console.log('Solicitando datos de inventario para stock bajo...');
          const stockResponse = await api.get('/reports/inventory');
          console.log('Datos de stock recibidos:', stockResponse.data);
          await generateLowStockPDF(stockResponse.data.data);
          break;
          
        case 'reservations':
          // Generar reporte de reservas
          console.log('Generando reporte de reservas...');
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