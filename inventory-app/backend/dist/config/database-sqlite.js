"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqliteDb = void 0;
exports.initDatabase = initDatabase;
exports.getDb = getDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
let db = null;
async function initDatabase() {
    if (db)
        return db;
    const dbPath = path_1.default.join(__dirname, '../../data/inventory.db');
    db = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    // Crear tablas si no existen
    await createTables();
    await seedInitialData();
    // Ejecutar migraciones
    await runMigrations();
    return db;
}
async function createTables() {
    if (!db)
        throw new Error('Database not initialized');
    await db.exec(`
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de categorías
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de unidades
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      symbol TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de componentes
    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES categories(id),
      unit_id TEXT REFERENCES units(id),
      min_stock REAL DEFAULT 0,
      max_stock REAL,
      current_stock REAL DEFAULT 0,
      reserved_stock REAL DEFAULT 0,
      location TEXT,
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de movimientos
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      reference TEXT,
      notes TEXT,
      user_id TEXT REFERENCES users(id),
      recipe_id TEXT,
      recipe_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de recetas
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      output_component_id TEXT REFERENCES components(id),
      output_quantity REAL DEFAULT 1,
      production_time REAL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de ingredientes de recetas
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de proyecciones
    CREATE TABLE IF NOT EXISTS projections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de recetas en proyecciones
    CREATE TABLE IF NOT EXISTS projection_recipes (
      id TEXT PRIMARY KEY,
      projection_id TEXT REFERENCES projections(id) ON DELETE CASCADE,
      recipe_id TEXT REFERENCES recipes(id),
      quantity REAL NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
async function runMigrations() {
    if (!db)
        throw new Error('Database not initialized');
    try {
        // Migración: agregar columna sale_price
        const componentsInfo = await db.all(`PRAGMA table_info(components)`);
        const hasSalePrice = componentsInfo.some((col) => col.name === 'sale_price');
        if (!hasSalePrice) {
            console.log('Migración: agregando columna sale_price...');
            await db.run(`ALTER TABLE components ADD COLUMN sale_price REAL DEFAULT 0`);
            await db.run(`UPDATE components SET sale_price = cost_price * 2 WHERE sale_price = 0 OR sale_price IS NULL`);
            console.log('Migración sale_price completada');
        }
        // Migración: agregar columna recipe_id a movements
        const movementsInfo = await db.all(`PRAGMA table_info(movements)`);
        const hasRecipeId = movementsInfo.some((col) => col.name === 'recipe_id');
        if (!hasRecipeId) {
            console.log('Migración: agregando columna recipe_id a movements...');
            await db.run(`ALTER TABLE movements ADD COLUMN recipe_id TEXT`);
            console.log('Migración recipe_id completada');
        }
        // Migración: agregar columna recipe_name a movements (para evitar JOINs costosos)
        const hasRecipeName = movementsInfo.some((col) => col.name === 'recipe_name');
        if (!hasRecipeName) {
            await db.run(`ALTER TABLE movements ADD COLUMN recipe_name TEXT`);
        }
    }
    catch (error) {
        console.error('Error al ejecutar migraciones:', error);
    }
}
async function seedInitialData() {
    if (!db)
        throw new Error('Database not initialized');
    // Verificar si ya hay datos
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount.count > 0)
        return;
    // Generar UUIDs simples
    const generateId = () => Math.random().toString(36).substr(2, 9);
    // Hash para contraseñas (admin: admin123, user: user123)
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);
    // Insertar datos iniciales
    const unitId = generateId();
    const categoryId = generateId();
    const componentId = generateId();
    await db.exec(`
    -- Usuarios por defecto
    INSERT INTO users (id, username, email, password, first_name, last_name, role) VALUES
    ('${generateId()}', 'admin', 'admin@inventory.com', '${adminPassword}', 'Administrador', 'Sistema', 'admin'),
    ('${generateId()}', 'user', 'user@inventory.com', '${userPassword}', 'Usuario', 'Estándar', 'user');

    -- Unidades
    INSERT INTO units (id, name, symbol) VALUES
    ('${unitId}', 'Unidades', 'pcs'),
    ('${generateId()}', 'Kilogramos', 'kg'),
    ('${generateId()}', 'Metros', 'm');

    -- Categorías
    INSERT INTO categories (id, name, description) VALUES
    ('${categoryId}', 'Componentes Electrónicos', 'Resistencias, capacitores, etc.'),
    ('${generateId()}', 'Herramientas', 'Herramientas de trabajo'),
    ('${generateId()}', 'Materiales', 'Materiales diversos');

    -- Componentes de ejemplo
    INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, current_stock, cost_price, sale_price) VALUES
    ('${componentId}', 'RES001', 'Resistencia 1K Ohm', 'Resistencia de carbón 1/4W', '${categoryId}', '${unitId}', 10, 50, 0.50, 1.00),
    ('${generateId()}', 'CAP001', 'Capacitor 100uF', 'Capacitor electrolítico', '${categoryId}', '${unitId}', 5, 25, 2.00, 4.00),
    ('${generateId()}', 'LED001', 'LED Rojo 5mm', 'LED de alta luminosidad', '${categoryId}', '${unitId}', 20, 100, 0.25, 0.75);

    -- Movimientos de ejemplo
    INSERT INTO movements (id, type, component_id, quantity, unit_cost, total_cost, notes, created_at) VALUES
    ('${generateId()}', 'entrada', '${componentId}', 50, 0.50, 25.00, 'Compra inicial', datetime('now', '-5 days')),
    ('${generateId()}', 'salida', '${componentId}', 10, 1.00, 10.00, 'Venta al cliente A', datetime('now', '-2 days'));
  `);
}
async function getDb() {
    if (!db) {
        await initDatabase();
    }
    return db;
}
exports.sqliteDb = {
    query: async (sql, params = []) => {
        const db = await getDb();
        return db.all(sql, params);
    },
    get: async (sql, params = []) => {
        const db = await getDb();
        return db.get(sql, params);
    },
    run: async (sql, params = []) => {
        const db = await getDb();
        return db.run(sql, params);
    }
};
//# sourceMappingURL=database-sqlite.js.map