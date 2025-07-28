export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  created_at: Date;
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
  sale_price: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  category?: Category;
  unit?: Unit;
}

export interface Recipe {
  id: string;
  code: string;
  name: string;
  description?: string;
  output_component_id: string;
  output_quantity: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  output_component?: Component;
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  component_id: string;
  quantity: number;
  created_at: Date;
  component?: Component;
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
  created_at: Date;
  movement_type?: MovementType;
  component?: Component;
  user?: User;
  recipe?: Recipe;
}

export interface Reservation {
  id: string;
  component_id: string;
  quantity: number;
  reference?: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  reserved_by?: string;
  reserved_at: Date;
  expires_at?: Date;
  completed_at?: Date;
  component?: Component;
  user?: User;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}