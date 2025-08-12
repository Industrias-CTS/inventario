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

  async createInvoice(data: {
    movement_type_id: string;
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
  }): Promise<{
    message: string;
    invoice: {
      reference_number: string;
      movement_type_id: string;
      items_count: number;
      total_items: number;
      shipping_cost: number;
      shipping_tax: number;
      additional_cost_per_unit: number;
    };
    movements: Array<Movement & {
      component_code: string;
      component_name: string;
      unit_cost_base: number;
      additional_cost: number;
      newStock: number;
      newReservedStock: number;
    }>;
  }> {
    // Intentar con el servidor principal primero, luego con el alternativo
    try {
      const response = await api.post('/movements/invoice', data);
      return response.data;
    } catch (error) {
      // Usar servidor alternativo en puerto 3004
      const alternativeResponse = await fetch('http://localhost:3004/api/movements/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!alternativeResponse.ok) {
        throw new Error('Error al procesar factura');
      }
      
      return alternativeResponse.json();
    }
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