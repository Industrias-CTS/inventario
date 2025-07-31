"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_sqlite_1 = require("./config/database-sqlite");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares de seguridad
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: true, // Permite cualquier origen temporalmente
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((0, compression_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Demasiadas solicitudes desde esta IP',
});
app.use('/api/', limiter);
// Body parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Middleware de autenticación
const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};
// Función para generar ID
const generateId = () => Math.random().toString(36).substr(2, 9);
// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await database_sqlite_1.sqliteDb.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        delete user.password;
        res.json({
            message: 'Inicio de sesión exitoso',
            user,
            token,
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'user' } = req.body;
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userId = generateId();
        await database_sqlite_1.sqliteDb.run(`INSERT INTO users (id, username, email, password, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, username, email, hashedPassword, first_name, last_name, role]);
        const user = await database_sqlite_1.sqliteDb.get('SELECT * FROM users WHERE id = ?', [userId]);
        delete user.password;
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user,
            token,
        });
    }
    catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        console.error('Error en registro:', error);
        return res.status(500).json({ error: 'Error al registrar usuario' });
    }
});
// Rutas de componentes
app.get('/api/components', authenticate, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.is_active = 1
    `;
        const params = [];
        if (search) {
            query += ' AND (c.name LIKE ? OR c.code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY c.name';
        const components = await database_sqlite_1.sqliteDb.query(query, params);
        res.json({ components });
    }
    catch (error) {
        console.error('Error al obtener componentes:', error);
        return res.status(500).json({ error: 'Error al obtener componentes' });
    }
});
app.post('/api/components', authenticate, async (req, res) => {
    try {
        const { code, name, description, category_id, unit_id, min_stock = 0, max_stock, location, cost_price = 0, sale_price = 0, } = req.body;
        const componentId = generateId();
        await database_sqlite_1.sqliteDb.run(`INSERT INTO components (
        id, code, name, description, category_id, unit_id,
        min_stock, max_stock, location, cost_price, sale_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [componentId, code, name, description, category_id, unit_id, min_stock, max_stock, location, cost_price, sale_price]);
        const component = await database_sqlite_1.sqliteDb.get('SELECT * FROM components WHERE id = ?', [componentId]);
        res.status(201).json({
            message: 'Componente creado exitosamente',
            component
        });
    }
    catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El código del componente ya existe' });
        }
        console.error('Error al crear componente:', error);
        return res.status(500).json({ error: 'Error al crear componente' });
    }
});
// Rutas de movimientos
app.get('/api/movements', authenticate, async (_req, res) => {
    try {
        const movements = await database_sqlite_1.sqliteDb.query(`
      SELECT 
        m.*,
        mt.code as movement_type_code,
        mt.name as movement_type_name,
        mt.operation,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM movements m
      JOIN movement_types mt ON m.movement_type_id = mt.id
      JOIN components c ON m.component_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);
        res.json({ movements });
    }
    catch (error) {
        console.error('Error al obtener movimientos:', error);
        return res.status(500).json({ error: 'Error al obtener movimientos' });
    }
});
app.post('/api/movements', authenticate, async (_req, res) => {
    try {
        const { movement_type_id, component_id, quantity, unit_cost = 0, reference_number, notes, } = _req.body;
        const user_id = _req.user.userId;
        const movementId = generateId();
        // Obtener tipo de movimiento
        const movementType = await database_sqlite_1.sqliteDb.get('SELECT operation FROM movement_types WHERE id = ?', [movement_type_id]);
        if (!movementType) {
            return res.status(400).json({ error: 'Tipo de movimiento no válido' });
        }
        // Obtener componente actual
        const component = await database_sqlite_1.sqliteDb.get('SELECT current_stock, reserved_stock FROM components WHERE id = ?', [component_id]);
        if (!component) {
            return res.status(400).json({ error: 'Componente no encontrado' });
        }
        let newStock = component.current_stock;
        let newReservedStock = component.reserved_stock;
        // Actualizar stock según operación
        switch (movementType.operation) {
            case 'IN':
                newStock += quantity;
                break;
            case 'OUT':
                if (newStock - newReservedStock < quantity) {
                    return res.status(400).json({ error: 'Stock insuficiente' });
                }
                newStock -= quantity;
                break;
            case 'RESERVE':
                if (newStock - newReservedStock < quantity) {
                    return res.status(400).json({ error: 'Stock disponible insuficiente para reservar' });
                }
                newReservedStock += quantity;
                break;
        }
        // Actualizar stock del componente
        await database_sqlite_1.sqliteDb.run('UPDATE components SET current_stock = ?, reserved_stock = ? WHERE id = ?', [newStock, newReservedStock, component_id]);
        // Crear movimiento
        await database_sqlite_1.sqliteDb.run(`INSERT INTO movements (
        id, movement_type_id, component_id, quantity, unit_cost,
        reference_number, notes, user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [movementId, movement_type_id, component_id, quantity, unit_cost, reference_number, notes, user_id]);
        const movement = await database_sqlite_1.sqliteDb.get('SELECT * FROM movements WHERE id = ?', [movementId]);
        res.status(201).json({
            message: 'Movimiento creado exitosamente',
            movement,
            newStock,
            newReservedStock
        });
    }
    catch (error) {
        console.error('Error al crear movimiento:', error);
        return res.status(500).json({ error: 'Error al crear movimiento' });
    }
});
// Ruta para procesar facturas
app.post('/api/movements/invoice', authenticate, async (_req, res) => {
    try {
        const { movement_type_id, reference_number, notes, shipping_cost = 0, shipping_tax = 0, items } = _req.body;
        const user_id = _req.user.userId;
        // Obtener tipo de movimiento
        const movementType = await database_sqlite_1.sqliteDb.get('SELECT operation FROM movement_types WHERE id = ?', [movement_type_id]);
        if (!movementType) {
            return res.status(400).json({ error: 'Tipo de movimiento no válido' });
        }
        const operation = movementType.operation;
        // Calcular el costo adicional por unidad (envío + impuestos)
        const totalItems = items.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
        const additionalCostPerUnit = (parseFloat(shipping_cost) + parseFloat(shipping_tax)) / totalItems;
        const createdMovements = [];
        for (const item of items) {
            const { component_code, component_name, quantity, total_cost, unit } = item;
            // Calcular costo unitario base
            const unitCostBase = parseFloat(total_cost) / parseFloat(quantity);
            // Costo unitario final incluyendo costos adicionales
            const unitCostFinal = unitCostBase + additionalCostPerUnit;
            // Buscar si el componente existe
            let component = await database_sqlite_1.sqliteDb.get('SELECT * FROM components WHERE code = ?', [component_code]);
            let component_id;
            if (!component) {
                // Si no existe, crear el componente
                component_id = generateId();
                await database_sqlite_1.sqliteDb.run(`INSERT INTO components (
            id, code, name, unit, current_stock, min_stock, max_stock, reserved_stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [component_id, component_code, component_name, unit || 'unit', 0, 0, 0, 0]);
            }
            else {
                component_id = component.id;
            }
            // Obtener stock actual
            const stockData = await database_sqlite_1.sqliteDb.get('SELECT current_stock, reserved_stock FROM components WHERE id = ?', [component_id]);
            const { current_stock, reserved_stock } = stockData;
            let newStock = parseFloat(current_stock);
            let newReservedStock = parseFloat(reserved_stock);
            // Actualizar stock según operación
            switch (operation) {
                case 'IN':
                    newStock += parseFloat(quantity);
                    break;
                case 'OUT':
                    if (newStock - newReservedStock < parseFloat(quantity)) {
                        return res.status(400).json({ error: `Stock insuficiente para ${component_name}` });
                    }
                    newStock -= parseFloat(quantity);
                    break;
            }
            // Actualizar stock del componente
            await database_sqlite_1.sqliteDb.run('UPDATE components SET current_stock = ?, reserved_stock = ? WHERE id = ?', [newStock, newReservedStock, component_id]);
            // Crear movimiento
            const movementId = generateId();
            await database_sqlite_1.sqliteDb.run(`INSERT INTO movements (
          id, movement_type_id, component_id, quantity, unit_cost,
          reference_number, notes, user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                movementId,
                movement_type_id,
                component_id,
                quantity,
                unitCostFinal,
                reference_number,
                `${notes || ''} | Item: ${component_name} | Costo base: ${unitCostBase.toFixed(2)} | Costo adicional: ${additionalCostPerUnit.toFixed(2)}`,
                user_id
            ]);
            const movement = await database_sqlite_1.sqliteDb.get('SELECT * FROM movements WHERE id = ?', [movementId]);
            createdMovements.push({
                ...movement,
                component_code,
                component_name,
                unit_cost_base: unitCostBase,
                additional_cost: additionalCostPerUnit,
                newStock,
                newReservedStock
            });
        }
        res.status(201).json({
            message: 'Factura procesada exitosamente',
            invoice: {
                reference_number,
                movement_type_id,
                items_count: items.length,
                total_items: totalItems,
                shipping_cost: parseFloat(shipping_cost),
                shipping_tax: parseFloat(shipping_tax),
                additional_cost_per_unit: additionalCostPerUnit
            },
            movements: createdMovements
        });
    }
    catch (error) {
        console.error('Error al procesar factura:', error);
        return res.status(400).json({ error: error.message || 'Error al procesar factura' });
    }
});
// Rutas de tipos de movimiento
app.get('/api/movement-types', authenticate, async (_req, res) => {
    try {
        const movementTypes = await database_sqlite_1.sqliteDb.query('SELECT * FROM movement_types ORDER BY name');
        res.json({ movementTypes });
    }
    catch (error) {
        console.error('Error al obtener tipos de movimiento:', error);
        return res.status(500).json({ error: 'Error al obtener tipos de movimiento' });
    }
});
// Rutas adicionales
app.get('/api/movements/reservations', authenticate, async (_req, res) => {
    try {
        const reservations = await database_sqlite_1.sqliteDb.query(`
      SELECT 
        r.*,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM reservations r
      JOIN components c ON r.component_id = c.id
      LEFT JOIN users u ON r.reserved_by = u.id
      WHERE r.status = 'active'
      ORDER BY r.reserved_at DESC
    `);
        res.json({ reservations });
    }
    catch (error) {
        console.error('Error al obtener reservas:', error);
        return res.status(500).json({ error: 'Error al obtener reservas' });
    }
});
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});
// Inicializar base de datos y servidor
async function startServer() {
    try {
        await (0, database_sqlite_1.initDatabase)();
        console.log('Base de datos SQLite inicializada');
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT} con base de datos SQLite`);
        });
    }
    catch (error) {
        console.error('Error al inicializar:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index-db.js.map