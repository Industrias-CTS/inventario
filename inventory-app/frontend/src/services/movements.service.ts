import api from './api';
import { Movement, Reservation } from '../types';

export const movementsService = {
  async getMovements(params?: {
    component_id?: string;
    movement_type_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ movements: Movement[] }> {
    const response = await api.get<{ movements: Movement[] }>('/movements', {
      params,
    });
    return response.data;
  },

  async createMovement(data: {
    movement_type_id: string;
    component_id: string;
    quantity: number;
    unit_cost?: number;
    reference_number?: string;
    notes?: string;
    recipe_id?: string;
  }): Promise<{
    message: string;
    movement: Movement;
    newStock: number;
    newReservedStock: number;
  }> {
    const response = await api.post<{
      message: string;
      movement: Movement;
      newStock: number;
      newReservedStock: number;
    }>('/movements', data);
    return response.data;
  },

  async getReservations(params?: {
    component_id?: string;
    status?: string;
  }): Promise<{ reservations: Reservation[] }> {
    const response = await api.get<{ reservations: Reservation[] }>(
      '/movements/reservations',
      { params }
    );
    return response.data;
  },

  async createReservation(data: {
    component_id: string;
    quantity: number;
    reference?: string;
    notes?: string;
    expires_at?: string;
  }): Promise<{
    message: string;
    reservation: Reservation;
  }> {
    const response = await api.post<{
      message: string;
      reservation: Reservation;
    }>('/movements/reservations', data);
    return response.data;
  },
};