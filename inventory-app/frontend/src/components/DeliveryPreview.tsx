import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  LinearProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { deliveriesService } from '../services/deliveries.service';

interface DeliveryPreviewProps {
  deliveryId: string;
}

export default function DeliveryPreview({ deliveryId }: DeliveryPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['delivery', deliveryId],
    queryFn: () => deliveriesService.getDeliveryById(deliveryId),
  });

  if (isLoading) {
    return <LinearProgress />;
  }

  if (error || !data) {
    return (
      <Alert severity="error">
        Error al cargar la remisión
      </Alert>
    );
  }

  const { delivery, items } = data;

  const getStatusChip = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'warning' as const },
      delivered: { label: 'Entregado', color: 'success' as const },
      cancelled: { label: 'Cancelado', color: 'error' as const },
    };
    
    return statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'default' as const };
  };

  const statusConfig = getStatusChip(delivery.status);
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
      {/* Encabezado */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          REMISIÓN DE ENTREGA
        </Typography>
        <Typography variant="h6" color="primary" gutterBottom>
          No. {delivery.delivery_number}
        </Typography>
        <Chip 
          label={statusConfig.label} 
          color={statusConfig.color}
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Información de la empresa/sistema */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              SISTEMA DE INVENTARIO
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sistema de gestión de inventario
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: { md: 'right' } }}>
            <Typography variant="body2" gutterBottom>
              <strong>Fecha:</strong> {new Date(delivery.delivery_date).toLocaleDateString('es-CO')}
            </Typography>
            {delivery.created_by_username && (
              <Typography variant="body2">
                <strong>Creado por:</strong> {delivery.created_by_username}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Información del destinatario */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
          ENTREGAR A:
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body1" gutterBottom>
              <strong>Nombre:</strong> {delivery.recipient_name}
            </Typography>
            {delivery.recipient_company && (
              <Typography variant="body1" gutterBottom>
                <strong>Empresa:</strong> {delivery.recipient_company}
              </Typography>
            )}
            {delivery.recipient_id && (
              <Typography variant="body1" gutterBottom>
                <strong>Documento:</strong> {delivery.recipient_id}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {delivery.phone && (
              <Typography variant="body1" gutterBottom>
                <strong>Teléfono:</strong> {delivery.phone}
              </Typography>
            )}
            {delivery.email && (
              <Typography variant="body1" gutterBottom>
                <strong>Email:</strong> {delivery.email}
              </Typography>
            )}
            {delivery.delivery_address && (
              <Typography variant="body1" gutterBottom>
                <strong>Dirección:</strong> {delivery.delivery_address}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Items de la remisión */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'primary.main' }}>
        ITEMS ENTREGADOS:
      </Typography>

      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Código</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Descripción</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Cantidad</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Unidad</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Precio Unit.</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                <TableRow sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                  <TableCell>{item.component_code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.component_name}
                    </Typography>
                    {item.component_description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.component_description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell align="center">{item.unit_symbol || 'UN'}</TableCell>
                  <TableCell align="right">
                    ${item.unit_price.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="medium">
                      ${item.total_price.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                </TableRow>
                {item.serial_numbers && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 1, bgcolor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Números de serie:</strong> {item.serial_numbers}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {item.notes && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 1, bgcolor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Notas:</strong> {item.notes}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Total */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Paper elevation={1} sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Typography variant="h6">
            TOTAL: ${totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
          </Typography>
        </Paper>
      </Box>

      {/* Notas */}
      {delivery.notes && (
        <Paper elevation={1} sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            NOTAS:
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
            {delivery.notes}
          </Typography>
        </Paper>
      )}

      {/* Firmas */}
      <Grid container spacing={4} sx={{ mt: 4 }}>
        <Grid item xs={12} md={6}>
          <Box sx={{ textAlign: 'center' }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" fontWeight="medium">
              ENTREGADO POR
            </Typography>
            {delivery.created_by_username && (
              <Typography variant="caption" color="text.secondary">
                {delivery.created_by_username}
              </Typography>
            )}
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ textAlign: 'center' }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" fontWeight="medium">
              RECIBIDO POR
            </Typography>
            {delivery.signature_data && (
              <Typography variant="caption" color="primary.main" sx={{ mt: 1, display: 'block' }}>
                ✓ Firmado digitalmente
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Información adicional */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Documento generado el {new Date().toLocaleDateString('es-CO')} a las {new Date().toLocaleTimeString('es-CO')}
        </Typography>
      </Box>
    </Box>
  );
}