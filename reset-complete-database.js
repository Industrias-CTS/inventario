const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Ruta a la base de datos
const dbPath = path.join(__dirname, 'inventory-app/backend/data/inventory.db');
const db = new sqlite3.Database(dbPath);

async function resetDatabase() {
  console.log('🗑️ Eliminando todas las tablas...');
  
  // Lista de todas las tablas para eliminar
  const tables = [
    'movements',
    'recipe_components', 
    'recipes',
    'components',
    'categories',
    'units',
    'projection_requirements',
    'projection_recipes', 
    'projections'
  ];

  // Eliminar todas las tablas
  for (const table of tables) {
    try {
      await new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
          if (err) reject(err);
          else {
            console.log(`✅ Tabla ${table} eliminada`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error eliminando tabla ${table}:`, error.message);
    }
  }

  console.log('🔧 Recreando estructura de base de datos...');

  // Recrear todas las tablas
  const createTableQueries = [
    // Tabla de unidades
    `CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      symbol TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de categorías
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de componentes
    `CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES categories(id),
      unit_id TEXT NOT NULL REFERENCES units(id),
      current_stock REAL DEFAULT 0,
      reserved_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      max_stock REAL,
      location TEXT,
      cost_price REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de recetas
    `CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      output_component_id TEXT NOT NULL REFERENCES components(id),
      output_quantity REAL NOT NULL DEFAULT 1,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de componentes de recetas
    `CREATE TABLE IF NOT EXISTS recipe_components (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      component_id TEXT NOT NULL REFERENCES components(id),
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de movimientos
    `CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste', 'transferencia', 'reserva', 'liberacion')),
      component_id TEXT NOT NULL REFERENCES components(id),
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      reference TEXT,
      notes TEXT,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de proyecciones
    `CREATE TABLE IF NOT EXISTS projections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      total_recipes INTEGER NOT NULL,
      total_items INTEGER NOT NULL,
      is_feasible BOOLEAN DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de recetas de proyecciones
    `CREATE TABLE IF NOT EXISTS projection_recipes (
      id TEXT PRIMARY KEY,
      projection_id TEXT NOT NULL REFERENCES projections(id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL REFERENCES recipes(id),
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla de requerimientos de proyecciones
    `CREATE TABLE IF NOT EXISTS projection_requirements (
      id TEXT PRIMARY KEY,
      projection_id TEXT NOT NULL REFERENCES projections(id) ON DELETE CASCADE,
      component_id TEXT NOT NULL REFERENCES components(id),
      required_quantity REAL NOT NULL,
      available_quantity REAL NOT NULL,
      shortage REAL NOT NULL DEFAULT 0,
      is_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Ejecutar queries de creación
  for (const query of createTableQueries) {
    try {
      await new Promise((resolve, reject) => {
        db.run(query, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      console.error('❌ Error creando tabla:', error.message);
    }
  }

  console.log('✅ Estructura de base de datos recreada');

  // Solo mantener el usuario administrador
  console.log('👤 Manteniendo solo el usuario administrador...');
  
  // Verificar si existe el usuario admin
  const adminExists = await new Promise((resolve) => {
    db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
      resolve(!!row);
    });
  });

  if (!adminExists) {
    // Crear usuario admin si no existe
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const adminId = Math.random().toString(36).substr(2, 9);
    
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [adminId, 'admin', 'admin@empresa.com', hashedPassword, 'Administrador', 'Sistema', 'admin', 1], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Usuario administrador creado');
  } else {
    console.log('✅ Usuario administrador ya existe');
  }

  console.log('🎉 Base de datos completamente limpia!');
  console.log('📋 Solo queda el usuario administrador:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  
  db.close();
}

resetDatabase().catch(console.error);