import api from './api';
import { Delivery, DeliveryWithItems } from '../types';

export interface CreateDeliveryData {
  recipient_name: string;
  recipient_company?: string;
  recipient_id?: string;
  delivery_date?: string;
  notes?: string;
  delivery_address?: string;
  phone?: string;
  email?: string;
  items: {
    component_id: string;
    quantity: number;
    serial_numbers?: string;
    unit_price: number;
    notes?: string;
  }[];
}

export interface UpdateDeliveryData {
  recipient_name?: string;
  recipient_company?: string;
  recipient_id?: string;
  delivery_date?: string;
  notes?: string;
  signature_data?: string;
  delivery_address?: string;
  phone?: string;
  email?: string;
  status?: 'pending' | 'delivered' | 'cancelled';
}

export interface GetDeliveriesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface GetDeliveriesResponse {
  deliveries: Delivery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const deliveriesService = {
  async getDeliveries(params?: GetDeliveriesParams): Promise<GetDeliveriesResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    
    const queryString = searchParams.toString();
    const url = `/deliveries${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  async getDeliveryById(id: string): Promise<DeliveryWithItems> {
    const response = await api.get(`/deliveries/${id}`);
    return response.data;
  },

  async createDelivery(data: CreateDeliveryData): Promise<{ message: string; delivery: Delivery }> {
    const response = await api.post('/deliveries', data);
    return response.data;
  },

  async updateDelivery(id: string, data: UpdateDeliveryData): Promise<{ message: string; delivery: Delivery }> {
    const response = await api.put(`/deliveries/${id}`, data);
    return response.data;
  },

  async deleteDelivery(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/deliveries/${id}`);
    return response.data;
  },

  async downloadDeliveryPDF(id: string): Promise<void> {
    const response = await api.get(`/deliveries/${id}/pdf`, {
      responseType: 'blob',
    });
    
    // Crear un blob y un enlace para descargar
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Extraer el nombre del archivo de los headers si está disponible
    const disposition = response.headers['content-disposition'];
    let filename = 'remision.pdf';
    
    if (disposition && disposition.includes('filename=')) {
      const filenameMatch = disposition.match(/filename=([^;]+)/);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};