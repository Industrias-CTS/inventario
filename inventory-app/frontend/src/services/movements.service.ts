import api from './api';
import { Movement, Reservation } from '../types';

export const movementsService = {
  async getMovements(params?: {
    component_id?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    recipe_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ movements: Movement[] }> {
    const response = await api.get<{ movements: Movement[] }>('/movements', {
      params,
    });
    return response.data;
  },

  async createMovement(data: {
    type: string;
    component_id: string;
    quantity: number;
    unit_cost?: number;
    reference_number?: string;
    notes?: string;
    recipe_id?: string;
    recipe_name?: string;
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

  async createInvoice(data: {
    type: string;
    reference_number: string;
    notes?: string;
    shipping_cost?: number;
    shipping_tax?: number;
    items: Array<{
      component_code: string;
      component_name: string;
      quantity: number;
      total_cost: number;
      unit?: string;
    }>;
  }): Promise<any> {
    const response = await api.post('/movements/invoice', data);
    return response.data;
  },

  async clearAllMovements(): Promise<{
    message: string;
    deleted: number;
    remaining: number;
  }> {
    const response = await api.delete<{
      message: string;
      deleted: number;
      remaining: number;
    }>('/movements/clear-all');
    return response.data;
  },
};