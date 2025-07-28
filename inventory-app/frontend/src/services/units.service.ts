import api from './api';
import { Unit } from '../types';

export const unitsService = {
  async getUnits(): Promise<{ units: Unit[] }> {
    const response = await api.get<{ units: Unit[] }>('/units');
    return response.data;
  },

  async createUnit(unitData: {
    name: string;
    symbol: string;
  }): Promise<{
    message: string;
    unit: Unit;
  }> {
    const response = await api.post<{
      message: string;
      unit: Unit;
    }>('/units', unitData);
    return response.data;
  },

  async updateUnit(
    id: string,
    unitData: { name: string; symbol: string }
  ): Promise<{
    message: string;
    unit: Unit;
  }> {
    const response = await api.put<{
      message: string;
      unit: Unit;
    }>(`/units/${id}`, unitData);
    return response.data;
  },

  async deleteUnit(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete<{
      message: string;
    }>(`/units/${id}`);
    return response.data;
  },
};