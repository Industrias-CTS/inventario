import api from './api';
import { Category } from '../types';

export const categoriesService = {
  async getCategories(): Promise<{ categories: Category[] }> {
    const response = await api.get<{ categories: Category[] }>('/categories');
    return response.data;
  },

  async createCategory(categoryData: {
    name: string;
    description?: string;
  }): Promise<{
    message: string;
    category: Category;
  }> {
    const response = await api.post<{
      message: string;
      category: Category;
    }>('/categories', categoryData);
    return response.data;
  },
};