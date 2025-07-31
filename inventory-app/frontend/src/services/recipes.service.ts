import api from './api';
import { Recipe } from '../types';

export type { Recipe } from '../types';

export const recipesService = {
  async getAll(): Promise<Recipe[]> {
    const response = await api.get<{ recipes: Recipe[] }>('/recipes');
    return response.data.recipes;
  },
  async getRecipes(params?: {
    is_active?: boolean;
    search?: string;
  }): Promise<{ recipes: Recipe[] }> {
    const response = await api.get<{ recipes: Recipe[] }>('/recipes', {
      params,
    });
    return response.data;
  },

  async getRecipeById(id: string): Promise<{ recipe: Recipe }> {
    const response = await api.get<{ recipe: Recipe }>(`/recipes/${id}`);
    return response.data;
  },

  async createRecipe(data: {
    code: string;
    name: string;
    description?: string;
    output_component_id: string;
    output_quantity: number;
    ingredients: Array<{
      component_id: string;
      quantity: number;
    }>;
  }): Promise<{
    message: string;
    recipe: Recipe;
  }> {
    const response = await api.post<{
      message: string;
      recipe: Recipe;
    }>('/recipes', data);
    return response.data;
  },

  async updateRecipe(
    id: string,
    data: {
      code: string;
      name: string;
      description?: string;
      output_component_id: string;
      output_quantity: number;
      ingredients: Array<{
        component_id: string;
        quantity: number;
      }>;
    }
  ): Promise<{
    message: string;
    recipe: Recipe;
  }> {
    const response = await api.put<{
      message: string;
      recipe: Recipe;
    }>(`/recipes/${id}`, data);
    return response.data;
  },

  async deleteRecipe(id: string): Promise<{
    message: string;
    recipe: Recipe;
  }> {
    const response = await api.delete<{
      message: string;
      recipe: Recipe;
    }>(`/recipes/${id}`);
    return response.data;
  },
};