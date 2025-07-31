import api from './api';
import { Component, StockInfo } from '../types';

export type { Component } from '../types';

export const componentsService = {
  async getAll(): Promise<Component[]> {
    const response = await api.get<{ components: Component[] }>('/components');
    return response.data.components;
  },
  async getComponents(params?: {
    category_id?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<{ components: Component[] }> {
    const response = await api.get<{ components: Component[] }>('/components', {
      params,
    });
    return response.data;
  },

  async getComponentById(id: string): Promise<{ component: Component }> {
    const response = await api.get<{ component: Component }>(`/components/${id}`);
    return response.data;
  },

  async createComponent(data: Partial<Component>): Promise<{
    message: string;
    component: Component;
  }> {
    const response = await api.post<{
      message: string;
      component: Component;
    }>('/components', data);
    return response.data;
  },

  async updateComponent(
    id: string,
    data: Partial<Component>
  ): Promise<{
    message: string;
    component: Component;
  }> {
    const response = await api.put<{
      message: string;
      component: Component;
    }>(`/components/${id}`, data);
    return response.data;
  },

  async deleteComponent(id: string): Promise<{
    message: string;
    component: Component;
  }> {
    const response = await api.delete<{
      message: string;
      component: Component;
    }>(`/components/${id}`);
    return response.data;
  },

  async getComponentStock(id: string): Promise<{ stock: StockInfo }> {
    const response = await api.get<{ stock: StockInfo }>(`/components/${id}/stock`);
    return response.data;
  },
};