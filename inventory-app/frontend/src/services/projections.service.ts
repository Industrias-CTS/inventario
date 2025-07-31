import api from './api';

export interface Projection {
  id: string;
  name: string;
  description?: string;
  total_recipes: number;
  total_items: number;
  is_feasible: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  recipes?: ProjectionRecipe[];
  requirements?: ProjectionRequirement[];
}

export interface ProjectionRecipe {
  id: string;
  projection_id: string;
  recipe_id: string;
  quantity: number;
  recipe_code?: string;
  recipe_name?: string;
}

export interface ProjectionRequirement {
  id: string;
  projection_id: string;
  component_id: string;
  required_quantity: number;
  available_quantity: number;
  shortage: number;
  is_available: boolean;
  component_code?: string;
  component_name?: string;
  unit_symbol?: string;
}

export const projectionsService = {
  async getAll(): Promise<Projection[]> {
    const response = await api.get<{ projections: Projection[] }>('/projections');
    return response.data.projections;
  },

  async getById(id: string): Promise<Projection> {
    const response = await api.get<{ projection: Projection }>(`/projections/${id}`);
    return response.data.projection;
  },

  async create(data: {
    name: string;
    description?: string;
    recipes: Array<{
      recipe_id: string;
      quantity: number;
    }>;
    requirements: Array<{
      component_id: string;
      required_quantity: number;
      available_quantity: number;
      shortage: number;
      is_available: boolean;
    }>;
  }): Promise<{
    message: string;
    projection: Projection;
  }> {
    const response = await api.post<{
      message: string;
      projection: Projection;
    }>('/projections', data);
    return response.data;
  },

  async delete(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete<{
      message: string;
    }>(`/projections/${id}`);
    return response.data;
  },
};