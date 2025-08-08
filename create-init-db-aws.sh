#!/bin/bash

# Script para crear init-database.js en el servidor AWS

cat > init-database.js << 'EOF'
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Crear directorio de datos si no existe
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Directorio data creado');
}

// Inicializar base de datos
const dbPath = path.join(dataDir, 'inventory.db');
console.log('📁 Ruta de base de datos:', dbPath);

const db = new Database(dbPath);
console.log('✅ Base de datos abierta');

// Crear tablas
const schema = `
-- Categorías
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unidades
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Componentes
CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  unit_id TEXT,
  min_stock REAL DEFAULT 0,
  max_stock REAL,
  current_stock REAL DEFAULT 0,
  reserved_stock REAL DEFAULT 0,
  location TEXT,
  cost_price REAL DEFAULT 0,
  sale_price REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'user',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de movimiento
CREATE TABLE IF NOT EXISTS movement_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('IN', 'OUT', 'RESERVE', 'RELEASE')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Movimientos
CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  movement_type_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  reference_number TEXT,
  notes TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (movement_type_id) REFERENCES movement_types(id),
  FOREIGN KEY (component_id) REFERENCES components(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recetas
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  output_component_id TEXT,
  output_quantity REAL DEFAULT 1,
  production_time INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (output_component_id) REFERENCES components(id)
);

-- Ingredientes de recetas
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (component_id) REFERENCES components(id)
);
`;

// Ejecutar schema
const statements = schema.split(';').filter(s => s.trim());
statements.forEach(statement => {
  if (statement.trim()) {
    try {
      db.exec(statement);
    } catch (err) {
      console.error('Error ejecutando:', statement.substring(0, 50), '...', err.message);
    }
  }
});
console.log('✅ Tablas creadas/verificadas');

// Insertar datos iniciales
async function initData() {
  // Verificar si ya hay datos
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('ℹ️ La base de datos ya tiene datos');
    return;
  }

  console.log('🔧 Insertando datos iniciales...');

  // Crear usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  db.prepare(`
    INSERT INTO users (id, username, email, password, first_name, last_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr001',
    'admin',
    'admin@inventory.com',
    hashedPassword,
    'Admin',
    'Sistema',
    'admin',
    1
  );
  console.log('✅ Usuario admin creado (usuario: admin, contraseña: admin123)');

  // Insertar categorías
  const categories = [
    ['cat001', 'Electrónicos', 'Componentes electrónicos'],
    ['cat002', 'Mecánicos', 'Partes mecánicas'],
    ['cat003', 'Materias Primas', 'Materiales base'],
    ['cat004', 'Productos Terminados', 'Productos listos para venta']
  ];
  
  const catStmt = db.prepare('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)');
  categories.forEach(cat => catStmt.run(...cat));
  console.log('✅ Categorías creadas');

  // Insertar unidades
  const units = [
    ['unit001', 'Unidad', 'UN'],
    ['unit002', 'Kilogramo', 'KG'],
    ['unit003', 'Gramo', 'G'],
    ['unit004', 'Litro', 'L'],
    ['unit005', 'Metro', 'M'],
    ['unit006', 'Pieza', 'PZ']
  ];
  
  const unitStmt = db.prepare('INSERT INTO units (id, name, symbol) VALUES (?, ?, ?)');
  units.forEach(unit => unitStmt.run(...unit));
  console.log('✅ Unidades creadas');

  // Insertar tipos de movimiento
  const movementTypes = [
    ['mt001', 'COMPRA', 'Compra de componentes', 'IN'],
    ['mt002', 'VENTA', 'Venta de componentes', 'OUT'],
    ['mt003', 'AJUSTE_ENTRADA', 'Ajuste de inventario entrada', 'IN'],
    ['mt004', 'AJUSTE_SALIDA', 'Ajuste de inventario salida', 'OUT'],
    ['mt005', 'PRODUCCION', 'Producción', 'IN'],
    ['mt006', 'CONSUMO', 'Consumo en producción', 'OUT'],
    ['rsrv001', 'RESERVA', 'Reserva de stock', 'RESERVE'],
    ['rlse001', 'LIBERACION', 'Liberación de reserva', 'RELEASE']
  ];
  
  const mtStmt = db.prepare('INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)');
  movementTypes.forEach(mt => mtStmt.run(...mt));
  console.log('✅ Tipos de movimiento creados');

  // Insertar componentes de ejemplo
  const components = [
    ['comp001', 'COMP-001', 'Resistencia 10K', 'Resistencia de 10K ohms', 'cat001', 'unit001', 100, 1000, 500, 0, 'A1-B2', 0.10, 0.25],
    ['comp002', 'COMP-002', 'Capacitor 100uF', 'Capacitor electrolítico', 'cat001', 'unit001', 50, 500, 250, 0, 'A1-B3', 0.50, 1.00],
    ['comp003', 'COMP-003', 'Tornillo M3x10', 'Tornillo métrico', 'cat002', 'unit001', 200, 2000, 1000, 0, 'B1-A1', 0.05, 0.15]
  ];
  
  const compStmt = db.prepare(`
    INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, max_stock, current_stock, reserved_stock, location, cost_price, sale_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  components.forEach(comp => compStmt.run(...comp));
  console.log('✅ Componentes de ejemplo creados');
}

// Ejecutar inicialización
initData().then(() => {
  console.log('\n✅ Base de datos inicializada correctamente');
  console.log('📍 Ubicación:', dbPath);
  db.close();
}).catch(err => {
  console.error('❌ Error:', err);
  db.close();
  process.exit(1);
});
EOF

echo "✅ Archivo init-database.js creado"
echo "Ahora ejecuta: node init-database.js"