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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de tipos de movimiento
    CREATE TABLE IF NOT EXISTS movement_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      operation TEXT CHECK (operation IN ('IN', 'OUT', 'RESERVE', 'RELEASE')) NOT NULL
    );

    -- Tabla de movimientos
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      movement_type_id TEXT REFERENCES movement_types(id),
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      reference_number TEXT,
      notes TEXT,
      user_id TEXT REFERENCES users(id),
      recipe_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabla de reservas
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      reference TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
      reserved_by TEXT REFERENCES users(id),
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      completed_at DATETIME
    );
  `);
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
    const movementTypeIds = {
        purchase: generateId(),
        sale: generateId(),
        adjustment: generateId(),
        reservation: generateId()
    };
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

    -- Tipos de movimiento
    INSERT INTO movement_types (id, code, name, operation) VALUES
    ('${movementTypeIds.purchase}', 'PURCHASE', 'Compra', 'IN'),
    ('${movementTypeIds.sale}', 'SALE', 'Venta', 'OUT'),
    ('${movementTypeIds.adjustment}', 'ADJUSTMENT_IN', 'Ajuste de entrada', 'IN'),
    ('${movementTypeIds.reservation}', 'RESERVATION', 'Apartado', 'RESERVE');

    -- Componentes de ejemplo
    INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, current_stock, cost_price, sale_price) VALUES
    ('${componentId}', 'RES001', 'Resistencia 1K Ohm', 'Resistencia de carbón 1/4W', '${categoryId}', '${unitId}', 10, 50, 0.50, 1.00),
    ('${generateId()}', 'CAP001', 'Capacitor 100uF', 'Capacitor electrolítico', '${categoryId}', '${unitId}', 5, 25, 2.00, 4.00),
    ('${generateId()}', 'LED001', 'LED Rojo 5mm', 'LED de alta luminosidad', '${categoryId}', '${unitId}', 20, 100, 0.25, 0.75);

    -- Movimientos de ejemplo
    INSERT INTO movements (id, movement_type_id, component_id, quantity, unit_cost, notes, created_at) VALUES
    ('${generateId()}', '${movementTypeIds.purchase}', '${componentId}', 50, 0.50, 'Compra inicial', datetime('now', '-5 days')),
    ('${generateId()}', '${movementTypeIds.sale}', '${componentId}', 10, 1.00, 'Venta al cliente A', datetime('now', '-2 days'));
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