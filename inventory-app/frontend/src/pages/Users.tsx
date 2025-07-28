import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  // Add,
  Edit,
  Delete,
  PersonAdd,
  Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { usersService } from '../services/users.service';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function Users() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpenDialog(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User & { password?: string }> }) =>
      usersService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpenDialog(false);
      setSelectedUser(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Partial<User & { password?: string; confirmPassword?: string }>>();

  const columns: GridColDef[] = [
    { field: 'username', headerName: 'Usuario', width: 120 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    {
      field: 'full_name',
      headerName: 'Nombre Completo',
      width: 200,
      valueGetter: (params) => `${params.row.first_name} ${params.row.last_name}`,
    },
    {
      field: 'role',
      headerName: 'Rol',
      width: 100,
      renderCell: (params) => {
        const roleColors = {
          admin: 'error',
          user: 'primary',
          viewer: 'secondary',
        };
        return (
          <Chip
            label={params.value}
            color={roleColors[params.value as keyof typeof roleColors] as any}
            size="small"
          />
        );
      },
    },
    {
      field: 'is_active',
      headerName: 'Estado',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Activo' : 'Inactivo'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Fecha Creación',
      width: 150,
      valueFormatter: (params) =>
        format(new Date(params.value), 'dd/MM/yyyy'),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={() => handleEdit(params.row)}
            color="primary"
          >
            <Edit />
          </IconButton>
          {params.row.id !== currentUser?.id && (
            <IconButton
              size="small"
              onClick={() => handleDelete(params.row.id)}
              color="error"
            >
              <Delete />
            </IconButton>
          )}
        </>
      ),
    },
  ];

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setValue('username', user.username);
    setValue('email', user.email);
    setValue('first_name', user.first_name);
    setValue('last_name', user.last_name);
    setValue('role', user.role);
    setValue('is_active', user.is_active);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de desactivar este usuario?')) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: Partial<User & { password?: string; confirmPassword?: string }>) => {
    const { confirmPassword, ...userData } = data;
    
    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data: userData });
    } else {
      createMutation.mutate(userData as any);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    reset();
  };

  if (currentUser?.role !== 'admin') {
    return (
      <Box>
        <Alert severity="error">
          Acceso denegado: Se requieren permisos de administrador para ver esta página.
        </Alert>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">
          Error al cargar usuarios: {(error as any)?.response?.data?.error || 'Error desconocido'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestión de Usuarios</Typography>
        <Box display="flex" gap={2}>
          <IconButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          >
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setOpenDialog(true)}
          >
            Nuevo Usuario
          </Button>
        </Box>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={data?.users || []}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
          checkboxSelection
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell:hover': {
              color: 'primary.main',
            },
          }}
        />
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Usuario"
                  {...register('username', { required: 'El usuario es requerido' })}
                  error={!!errors.username}
                  helperText={errors.username?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...register('email', { 
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido'
                    }
                  })}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre"
                  {...register('first_name', { required: 'El nombre es requerido' })}
                  error={!!errors.first_name}
                  helperText={errors.first_name?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Apellido"
                  {...register('last_name', { required: 'El apellido es requerido' })}
                  error={!!errors.last_name}
                  helperText={errors.last_name?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Rol"
                  select
                  defaultValue="user"
                  {...register('role', { required: 'El rol es requerido' })}
                  error={!!errors.role}
                  helperText={errors.role?.message}
                >
                  <MenuItem value="admin">Administrador</MenuItem>
                  <MenuItem value="user">Usuario</MenuItem>
                  <MenuItem value="viewer">Visualizador</MenuItem>
                </TextField>
              </Grid>
              {selectedUser && (
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        {...register('is_active')}
                        defaultChecked={selectedUser.is_active}
                      />
                    }
                    label="Usuario Activo"
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={selectedUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  type="password"
                  {...register('password', { 
                    required: !selectedUser ? 'La contraseña es requerida' : false,
                    minLength: {
                      value: 6,
                      message: 'La contraseña debe tener al menos 6 caracteres'
                    }
                  })}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirmar Contraseña"
                  type="password"
                  {...register('confirmPassword', {
                    validate: (value, { password }) => {
                      if (!selectedUser && !value) return 'Confirme la contraseña';
                      if (password && value !== password) return 'Las contraseñas no coinciden';
                      return true;
                    }
                  })}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {selectedUser ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}