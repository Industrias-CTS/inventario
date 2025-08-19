import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { deliveriesService, CreateDeliveryData } from '../services/deliveries.service';
import { componentsService } from '../services/components.service';
import { Delivery, Component } from '../types';

interface DeliveryFormProps {
  delivery?: Delivery | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface DeliveryItemForm {
  id?: string;
  component_id: string;
  component?: Component;
  quantity: number;
  serial_numbers: string;
  unit_price: number;
  notes: string;
}

export default function DeliveryForm({ delivery, onSuccess, onCancel }: DeliveryFormProps) {
  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_company: '',
    recipient_id: '',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_address: '',
    phone: '',
    email: '',
    notes: '',
    status: 'pending' as 'pending' | 'delivered' | 'cancelled',
  });

  const [items, setItems] = useState<DeliveryItemForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: componentsData } = useQuery({
    queryKey: ['components'],
    queryFn: () => componentsService.getComponents(),
  });

  const createMutation = useMutation({
    mutationFn: deliveriesService.createDelivery,
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Error al crear remisión:', error);
      setErrors({ submit: 'Error al crear la remisión' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      deliveriesService.updateDelivery(id, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Error al actualizar remisión:', error);
      setErrors({ submit: 'Error al actualizar la remisión' });
    },
  });

  useEffect(() => {
    if (delivery) {
      setFormData({
        recipient_name: delivery.recipient_name,
        recipient_company: delivery.recipient_company || '',
        recipient_id: delivery.recipient_id || '',
        delivery_date: delivery.delivery_date.split('T')[0],
        delivery_address: delivery.delivery_address || '',
        phone: delivery.phone || '',
        email: delivery.email || '',
        notes: delivery.notes || '',
        status: delivery.status,
      });
    }
  }, [delivery]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        component_id: '',
        quantity: 1,
        serial_numbers: '',
        unit_price: 0,
        notes: '',
      },
    ]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const getComponentById = (componentId: string): Component | undefined => {
    return componentsData?.components.find((c: Component) => c.id === componentId);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recipient_name.trim()) {
      newErrors.recipient_name = 'El nombre del destinatario es requerido';
    }

    if (items.length === 0) {
      newErrors.items = 'Debe agregar al menos un item';
    }

    items.forEach((item, index) => {
      if (!item.component_id) {
        newErrors[`item_${index}_component`] = 'Seleccione un componente';
      }
      if (item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'La cantidad debe ser mayor a 0';
      }
      if (item.unit_price < 0) {
        newErrors[`item_${index}_price`] = 'El precio no puede ser negativo';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: CreateDeliveryData = {
      ...formData,
      items: items.map(item => ({
        component_id: item.component_id,
        quantity: item.quantity,
        serial_numbers: item.serial_numbers,
        unit_price: item.unit_price,
        notes: item.notes,
      })),
    };

    try {
      if (delivery) {
        await updateMutation.mutateAsync({
          id: delivery.id,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch (error) {
      console.error('Error al enviar formulario:', error);
    }
  };

  const components = componentsData?.components || [];

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {errors.submit && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.submit}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        Información del Destinatario
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            label="Nombre del Destinatario *"
            value={formData.recipient_name}
            onChange={(e) => handleInputChange('recipient_name', e.target.value)}
            error={!!errors.recipient_name}
            helperText={errors.recipient_name}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Empresa"
            value={formData.recipient_company}
            onChange={(e) => handleInputChange('recipient_company', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Documento de Identidad"
            value={formData.recipient_id}
            onChange={(e) => handleInputChange('recipient_id', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Fecha de Entrega"
            type="date"
            value={formData.delivery_date}
            onChange={(e) => handleInputChange('delivery_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Teléfono"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Dirección de Entrega"
            value={formData.delivery_address}
            onChange={(e) => handleInputChange('delivery_address', e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Grid>
        {delivery && (
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.status}
                label="Estado"
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                <MenuItem value="pending">Pendiente</MenuItem>
                <MenuItem value="delivered">Entregado</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Items de la Remisión
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addItem}
        >
          Agregar Item
        </Button>
      </Box>

      {errors.items && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.items}
        </Alert>
      )}

      {items.length > 0 && (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Componente *</TableCell>
                <TableCell>Cantidad *</TableCell>
                <TableCell>Seriales</TableCell>
                <TableCell>Precio Unit.</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Notas</TableCell>
                <TableCell width="50">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => {
                const component = getComponentById(item.component_id);
                const total = item.quantity * item.unit_price;

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Autocomplete
                        options={components}
                        getOptionLabel={(option: Component) => `${option.code} - ${option.name}`}
                        value={component || null}
                        onChange={(_, newValue) => {
                          updateItem(index, 'component_id', newValue?.id || '');
                          updateItem(index, 'component', newValue);
                          if (newValue) {
                            updateItem(index, 'unit_price', newValue.cost_price || 0);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Seleccionar componente"
                            error={!!errors[`item_${index}_component`]}
                            helperText={errors[`item_${index}_component`]}
                            size="small"
                          />
                        )}
                        size="small"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        error={!!errors[`item_${index}_quantity`]}
                        helperText={errors[`item_${index}_quantity`]}
                        size="small"
                        fullWidth
                        inputProps={{ min: 0.01, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.serial_numbers}
                        onChange={(e) => updateItem(index, 'serial_numbers', e.target.value)}
                        placeholder="Números de serie"
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                        error={!!errors[`item_${index}_price`]}
                        helperText={errors[`item_${index}_price`]}
                        size="small"
                        fullWidth
                        inputProps={{ min: 0, step: 0.01 }}
                        InputProps={{
                          startAdornment: '$',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        ${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.notes}
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                        placeholder="Notas del item"
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => removeItem(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {items.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Typography variant="h6">
            Total: ${calculateTotal().toLocaleString('es-CO', { minimumFractionDigits: 2 })}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <TextField
            label="Notas Adicionales"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {delivery ? 'Actualizar' : 'Crear'} Remisión
        </Button>
      </Box>
    </Box>
  );
}