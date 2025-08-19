import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  LocalShipping as DeliveryIcon,
  Preview as PreviewIcon,
  GetApp as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ChangeCircle as StatusIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveriesService } from '../services/deliveries.service';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DeliveryForm from '../components/DeliveryForm';
import DeliveryPreview from '../components/DeliveryPreview';
import { Delivery, DeliveryWithItems } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`delivery-tabpanel-${index}`}
      aria-labelledby={`delivery-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Deliveries() {
  const [currentTab, setCurrentTab] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | DeliveryWithItems | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'delivered' | 'cancelled'>('pending');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();

  // Helper para obtener ID de delivery
  const getDeliveryId = (delivery: Delivery | DeliveryWithItems) => {
    return 'delivery' in delivery ? delivery.delivery.id : delivery.id;
  };

  // Helper para obtener data de delivery
  const getDeliveryData = (delivery: Delivery | DeliveryWithItems) => {
    return 'delivery' in delivery ? delivery.delivery : delivery;
  };

  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ['deliveries', page + 1, rowsPerPage, search, currentTab],
    queryFn: () =>
      deliveriesService.getDeliveries({
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: getStatusFromTab(currentTab),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deliveriesService.deleteDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: deliveriesService.downloadDeliveryPDF,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Primero obtener todos los datos de la remisión
      const fullDelivery = await deliveriesService.getDeliveryById(id);
      const deliveryData = fullDelivery.delivery;
      
      // Enviar todos los datos con el nuevo estado
      return deliveriesService.updateDelivery(id, {
        recipient_name: deliveryData.recipient_name,
        recipient_company: deliveryData.recipient_company,
        recipient_id: deliveryData.recipient_id,
        delivery_date: deliveryData.delivery_date,
        notes: deliveryData.notes,
        delivery_address: deliveryData.delivery_address,
        phone: deliveryData.phone,
        email: deliveryData.email,
        status: status as 'pending' | 'delivered' | 'cancelled'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setIsStatusDialogOpen(false);
      setSelectedDelivery(null);
    },
    onError: (error) => {
      console.error('Error al actualizar estado:', error);
    },
  });

  function getStatusFromTab(tab: number): string | undefined {
    switch (tab) {
      case 1: return 'pending';
      case 2: return 'delivered';
      case 3: return 'cancelled';
      default: return undefined;
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    setPage(0);
  };

  const handleSearch = (searchTerm: string) => {
    setSearch(searchTerm);
    setPage(0);
  };

  const handleEdit = async (delivery: Delivery) => {
    try {
      // Obtener los detalles completos de la remisión incluidos los items
      const fullDelivery = await deliveriesService.getDeliveryById(delivery.id);
      setSelectedDelivery(fullDelivery);
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error al obtener detalles de la remisión:', error);
      // Si hay error, usar la información básica
      setSelectedDelivery(delivery);
      setIsFormOpen(true);
    }
  };

  const handlePreview = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setIsPreviewOpen(true);
  };

  const handleDelete = async (delivery: Delivery) => {
    if (window.confirm(`¿Estás seguro de eliminar la remisión ${delivery.delivery_number}?`)) {
      try {
        await deleteMutation.mutateAsync(delivery.id);
      } catch (error) {
        console.error('Error al eliminar remisión:', error);
      }
    }
  };

  const handleDownload = async (delivery: Delivery | DeliveryWithItems) => {
    try {
      const deliveryId = getDeliveryId(delivery);
      await downloadMutation.mutateAsync(deliveryId);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
    }
  };

  const handleChangeStatus = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    const deliveryData = getDeliveryData(delivery);
    setNewStatus(deliveryData.status as 'pending' | 'delivered' | 'cancelled');
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = () => {
    if (selectedDelivery) {
      updateStatusMutation.mutate({
        id: getDeliveryId(selectedDelivery),
        status: newStatus,
      });
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'warning' as const },
      delivered: { label: 'Entregado', color: 'success' as const },
      cancelled: { label: 'Cancelado', color: 'error' as const },
    };
    
    return statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'default' as const };
  };

  const columns: GridColDef[] = [
    { 
      field: 'delivery_number', 
      headerName: 'Número', 
      width: 130,
      flex: 0 
    },
    { 
      field: 'recipient_name', 
      headerName: 'Destinatario', 
      width: 200,
      flex: 1
    },
    { 
      field: 'recipient_company', 
      headerName: 'Empresa', 
      width: 180,
      flex: 1
    },
    { 
      field: 'delivery_date', 
      headerName: 'Fecha', 
      width: 120,
      flex: 0,
      valueFormatter: (value: any) => {
        if (!value) return '';
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) return '';
          return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        } catch {
          return '';
        }
      }
    },
    {
      field: 'status',
      headerName: 'Estado',
      width: 120,
      flex: 0,
      renderCell: (params: any) => {
        const statusConfig = getStatusChip(params.value);
        return (
          <Box
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: 
                statusConfig.color === 'warning' ? '#fff3e0' :
                statusConfig.color === 'success' ? '#e8f5e8' :
                statusConfig.color === 'error' ? '#ffebee' : '#f5f5f5',
              color:
                statusConfig.color === 'warning' ? '#f57c00' :
                statusConfig.color === 'success' ? '#2e7d32' :
                statusConfig.color === 'error' ? '#c62828' : '#666',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {statusConfig.label}
          </Box>
        );
      },
    },
    { 
      field: 'items_count', 
      headerName: 'Items', 
      width: 80,
      flex: 0,
      align: 'center',
      headerAlign: 'center',
    },
    { 
      field: 'total_amount', 
      headerName: 'Total', 
      width: 120,
      flex: 0,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: any) => {
        if (!value || isNaN(Number(value))) return '$0.00';
        return `$${Number(value).toLocaleString('es-CO', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        })}`;
      }
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 240,
      flex: 0,
      sortable: false,
      filterable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Vista previa">
            <IconButton size="small" onClick={() => handlePreview(params.row)}>
              <PreviewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Descargar PDF">
            <IconButton 
              size="small" 
              onClick={() => handleDownload(params.row)}
              disabled={downloadMutation.isPending}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cambiar Estado">
            <IconButton size="small" onClick={() => handleChangeStatus(params.row)}>
              <StatusIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton 
              size="small" 
              onClick={() => handleDelete(params.row)}
              color="error"
              disabled={deleteMutation.isPending}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DeliveryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Remisiones
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedDelivery(null);
            setIsFormOpen(true);
          }}
        >
          Nueva Remisión
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="delivery tabs">
            <Tab label="Todas" />
            <Tab label="Pendientes" />
            <Tab label="Entregadas" />
            <Tab label="Canceladas" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={currentTab}>
          <Box sx={{ mb: 2 }}>
            <TextField
              placeholder="Buscar por número de remisión o destinatario..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{ minWidth: 300 }}
            />
          </Box>
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={deliveriesData?.deliveries || []}
              columns={columns}
              loading={isLoading}
              pageSizeOptions={[5, 10, 25]}
              paginationModel={{ page, pageSize: rowsPerPage }}
              onPaginationModelChange={(model) => {
                setPage(model.page);
                setRowsPerPage(model.pageSize);
              }}
              disableRowSelectionOnClick
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none',
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            />
          </Box>
        </TabPanel>
      </Paper>

      {/* Dialog para crear/editar remisión */}
      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedDelivery ? 'Editar Remisión' : 'Nueva Remisión'}
        </DialogTitle>
        <DialogContent>
          <DeliveryForm
            delivery={selectedDelivery}
            onSuccess={() => {
              setIsFormOpen(false);
              setSelectedDelivery(null);
              queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedDelivery(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para vista previa */}
      <Dialog open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Vista Previa - {selectedDelivery ? getDeliveryData(selectedDelivery).delivery_number : ''}
        </DialogTitle>
        <DialogContent>
          {selectedDelivery && (
            <DeliveryPreview deliveryId={getDeliveryId(selectedDelivery)} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPreviewOpen(false)}>
            Cerrar
          </Button>
          {selectedDelivery && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownload(selectedDelivery)}
              disabled={downloadMutation.isPending}
            >
              Descargar PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog para cambiar estado */}
      <Dialog open={isStatusDialogOpen} onClose={() => setIsStatusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Cambiar Estado - {selectedDelivery ? getDeliveryData(selectedDelivery).delivery_number : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Nuevo Estado</InputLabel>
              <Select
                value={newStatus}
                label="Nuevo Estado"
                onChange={(e) => setNewStatus(e.target.value as 'pending' | 'delivered' | 'cancelled')}
              >
                <MenuItem value="pending">Pendiente</MenuItem>
                <MenuItem value="delivered">Entregado</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsStatusDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmStatusChange}
            disabled={updateStatusMutation.isPending}
          >
            Confirmar Cambio
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}