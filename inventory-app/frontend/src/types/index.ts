export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  created_at: string;
}

export interface Component {
  id: string;
  code: string;
  name: string;
  description?: string;
  category_id?: string;
  unit_id: string;
  min_stock: number;
  max_stock?: number;
  current_stock: number;
  reserved_stock: number;
  location?: string;
  cost_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string;
  unit_name?: string;
  unit_symbol?: string;
}

export interface Recipe {
  id: string;
  code: string;
  name: string;
  description?: string;
  output_component_id: string;
  output_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  output_component?: Component;
  ingredients?: RecipeIngredient[];
  output_component_code?: string;
  output_component_name?: string;
  output_unit_symbol?: string;
  total_cost?: number;
  unit_cost?: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  component_id: string;
  quantity: number;
  created_at: string;
  component?: Component;
  component_code?: string;
  component_name?: string;
  unit_symbol?: string;
  cost_price?: number;
  ingredient_cost?: number;
}

export interface MovementType {
  id: string;
  code: string;
  name: string;
  operation: 'IN' | 'OUT' | 'RESERVE' | 'RELEASE';
}

export interface Movement {
  id: string;
  movement_type_id: string;
  component_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_number?: string;
  notes?: string;
  user_id?: string;
  recipe_id?: string;
  created_at: string;
  movement_type_code?: string;
  movement_type_name?: string;
  operation?: string;
  component_code?: string;
  component_name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface Reservation {
  id: string;
  component_id: string;
  quantity: number;
  reference?: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  reserved_by?: string;
  reserved_at: string;
  expires_at?: string;
  completed_at?: string;
  component_code?: string;
  component_name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface StockInfo {
  id: string;
  code: string;
  name: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock: number;
  max_stock?: number;
  unit_symbol: string;
}