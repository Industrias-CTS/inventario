-- Crear base de datos
CREATE DATABASE IF NOT EXISTS inventory_db;

-- Usar la base de datos
\c inventory_db;

-- Crear extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de unidades de medida
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de componentes/productos
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    min_stock DECIMAL(10,2) DEFAULT 0,
    max_stock DECIMAL(10,2),
    current_stock DECIMAL(10,2) DEFAULT 0,
    reserved_stock DECIMAL(10,2) DEFAULT 0,
    location VARCHAR(100),
    cost_price DECIMAL(10,2) DEFAULT 0,
    sale_price DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de recetas (BOM - Bill of Materials)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    output_component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    output_quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ingredientes de recetas
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, component_id)
);

-- Tabla de tipos de movimiento
CREATE TABLE IF NOT EXISTS movement_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) CHECK (operation IN ('IN', 'OUT', 'RESERVE', 'RELEASE')) NOT NULL
);

-- Insertar tipos de movimiento predeterminados
INSERT INTO movement_types (code, name, operation) VALUES
    ('PURCHASE', 'Compra', 'IN'),
    ('PRODUCTION', 'Producción', 'IN'),
    ('SALE', 'Venta', 'OUT'),
    ('CONSUMPTION', 'Consumo', 'OUT'),
    ('ADJUSTMENT_IN', 'Ajuste de entrada', 'IN'),
    ('ADJUSTMENT_OUT', 'Ajuste de salida', 'OUT'),
    ('RESERVATION', 'Apartado', 'RESERVE'),
    ('RELEASE', 'Liberación', 'RELEASE'),
    ('TRANSFER_IN', 'Transferencia entrada', 'IN'),
    ('TRANSFER_OUT', 'Transferencia salida', 'OUT')
ON CONFLICT (code) DO NOTHING;

-- Tabla de movimientos
CREATE TABLE IF NOT EXISTS movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type_id UUID REFERENCES movement_types(id) ON DELETE RESTRICT,
    component_id UUID REFERENCES components(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    reference_number VARCHAR(100),
    notes TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de reservas/apartados
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    reserved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reserved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_movements_component_id ON movements(component_id);
CREATE INDEX idx_movements_created_at ON movements(created_at);
CREATE INDEX idx_movements_movement_type_id ON movements(movement_type_id);
CREATE INDEX idx_components_code ON components(code);
CREATE INDEX idx_components_category_id ON components(category_id);
CREATE INDEX idx_reservations_component_id ON reservations(component_id);
CREATE INDEX idx_reservations_status ON reservations(status);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();