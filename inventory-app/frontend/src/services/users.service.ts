import api from './api';
import { User } from '../types';

export const usersService = {
  async getUsers(): Promise<{ users: User[] }> {
    const response = await api.get<{ users: User[] }>('/users');
    return response.data;
  },

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: string;
  }): Promise<{
    message: string;
    user: User;
  }> {
    const response = await api.post<{
      message: string;
      user: User;
    }>('/users', userData);
    return response.data;
  },

  async updateUser(
    id: string,
    userData: Partial<User & { password?: string }>
  ): Promise<{
    message: string;
    user: User;
  }> {
    const response = await api.put<{
      message: string;
      user: User;
    }>(`/users/${id}`, userData);
    return response.data;
  },

  async deleteUser(id: string): Promise<{
    message: string;
  }> {
    const response = await api.delete<{
      message: string;
    }>(`/users/${id}`);
    return response.data;
  },
};