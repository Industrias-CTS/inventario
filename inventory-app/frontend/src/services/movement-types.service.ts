import api from './api';
import { MovementType } from '../types';

export const movementTypesService = {
  async getMovementTypes(): Promise<{ movementTypes: MovementType[] }> {
    const response = await api.get<{ movementTypes: MovementType[] }>('/movement-types');
    return response.data;
  },

  async createMovementType(data: {
    code: string;
    name: string;
    operation: 'IN' | 'OUT' | 'RESERVE' | 'RELEASE';
  }): Promise<{
    message: string;
    movementType: MovementType;
  }> {
    const response = await api.post<{
      message: string;
      movementType: MovementType;
    }>('/movement-types', data);
    return response.data;
  },
};