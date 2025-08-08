"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = exports.getReservations = exports.createReservation = exports.cancelMovement = exports.getMovementStats = exports.getMovementById = exports.createMovement = exports.getMovements = void 0;
const database_config_1 = require("../config/database.config");
const generateId = () => Math.random().toString(36).substr(2, 9);
const getMovements = async (req, res) => {
    try {
        const { component_id, movement_type_id, start_date, end_date, limit = 100 } = req.query;
        let query = `
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
      WHERE 1=1
    `;
        const values = [];
        if (component_id) {
            query += ` AND m.component_id = ?`;
            values.push(component_id);
        }
        if (movement_type_id) {
            query += ` AND m.movement_type_id = ?`;
            values.push(movement_type_id);
        }
        if (start_date) {
            query += ` AND m.created_at >= ?`;
            values.push(start_date);
        }
        if (end_date) {
            query += ` AND m.created_at <= ?`;
            values.push(end_date);
        }
        query += ` ORDER BY m.created_at DESC LIMIT ?`;
        values.push(Number(limit));
        const movements = await database_config_1.db.query(query, values);
        res.json({ movements });
    }
    catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
};
exports.getMovements = getMovements;
const createMovement = async (req, res) => {
    try {
        const { movement_type_id, component_id, quantity, unit_cost = 0, reference_number, notes } = req.body;
        const userId = req.user?.userId;
        const movementType = await database_config_1.db.get('SELECT * FROM movement_types WHERE id = ?', [movement_type_id]);
        if (!movementType) {
            return res.status(400).json({ error: 'Tipo de movimiento no válido' });
        }
        const component = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [component_id]);
        if (!component) {
            return res.status(400).json({ error: 'Componente no encontrado' });
        }
        await database_config_1.db.transaction(async () => {
            let newStock = component.current_stock;
            let newReservedStock = component.reserved_stock || 0;
            switch (movementType.operation) {
                case 'IN':
                    newStock += Number(quantity);
                    break;
                case 'OUT':
                    if (component.current_stock < quantity) {
                        throw new Error('Stock insuficiente');
                    }
                    newStock -= Number(quantity);
                    break;
                case 'RESERVE':
                    if ((component.current_stock - component.reserved_stock) < quantity) {
                        throw new Error('Stock disponible insuficiente para reservar');
                    }
                    newReservedStock += Number(quantity);
                    break;
                case 'RELEASE':
                    if (component.reserved_stock < quantity) {
                        throw new Error('No hay suficiente stock reservado para liberar');
                    }
                    newReservedStock -= Number(quantity);
                    break;
            }
            await database_config_1.db.run('UPDATE components SET current_stock = ?, reserved_stock = ?, updated_at = ? WHERE id = ?', [newStock, newReservedStock, new Date().toISOString(), component_id]);
            const movementId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO movements (
          id, movement_type_id, component_id, quantity, 
          unit_cost, reference_number, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                movementId, movement_type_id, component_id, quantity,
                unit_cost, reference_number, notes, userId, now
            ]);
            const newMovement = await database_config_1.db.get(`SELECT 
          m.*,
          mt.name as movement_type_name,
          mt.operation,
          c.name as component_name
        FROM movements m
        JOIN movement_types mt ON m.movement_type_id = mt.id
        JOIN components c ON m.component_id = c.id
        WHERE m.id = ?`, [movementId]);
            res.status(201).json({
                message: 'Movimiento registrado exitosamente',
                movement: newMovement,
                newStock,
                newReservedStock
            });
        });
    }
    catch (error) {
        console.error('Error al crear movimiento:', error);
        res.status(400).json({ error: error.message || 'Error al crear movimiento' });
    }
};
exports.createMovement = createMovement;
const getMovementById = async (req, res) => {
    try {
        const { id } = req.params;
        const movement = await database_config_1.db.get(`SELECT 
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
      WHERE m.id = ?`, [id]);
        if (!movement) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        res.json({ movement });
    }
    catch (error) {
        console.error('Error al obtener movimiento:', error);
        res.status(500).json({ error: 'Error al obtener movimiento' });
    }
};
exports.getMovementById = getMovementById;
const getMovementStats = async (req, res) => {
    try {
        const { component_id, start_date, end_date } = req.query;
        let baseQuery = 'FROM movements m JOIN movement_types mt ON m.movement_type_id = mt.id WHERE 1=1';
        const values = [];
        if (component_id) {
            baseQuery += ' AND m.component_id = ?';
            values.push(component_id);
        }
        if (start_date) {
            baseQuery += ' AND m.created_at >= ?';
            values.push(start_date);
        }
        if (end_date) {
            baseQuery += ' AND m.created_at <= ?';
            values.push(end_date);
        }
        const stats = await database_config_1.db.get(`
      SELECT 
        COUNT(*) as total_movements,
        SUM(CASE WHEN mt.operation = 'IN' THEN m.quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN mt.operation = 'OUT' THEN m.quantity ELSE 0 END) as total_out,
        SUM(CASE WHEN mt.operation = 'RESERVE' THEN m.quantity ELSE 0 END) as total_reserved,
        SUM(CASE WHEN mt.operation = 'RELEASE' THEN m.quantity ELSE 0 END) as total_released,
        SUM(m.quantity * m.unit_cost) as total_cost
      ${baseQuery}
    `, values);
        res.json({ stats });
    }
    catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
exports.getMovementStats = getMovementStats;
const cancelMovement = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const movement = await database_config_1.db.get(`SELECT m.*, mt.operation 
       FROM movements m 
       JOIN movement_types mt ON m.movement_type_id = mt.id 
       WHERE m.id = ?`, [id]);
        if (!movement) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        const component = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [movement.component_id]);
        await database_config_1.db.transaction(async () => {
            let newStock = component.current_stock;
            let newReservedStock = component.reserved_stock || 0;
            switch (movement.operation) {
                case 'IN':
                    newStock -= movement.quantity;
                    break;
                case 'OUT':
                    newStock += movement.quantity;
                    break;
                case 'RESERVE':
                    newReservedStock -= movement.quantity;
                    break;
                case 'RELEASE':
                    newReservedStock += movement.quantity;
                    break;
            }
            await database_config_1.db.run('UPDATE components SET current_stock = ?, reserved_stock = ?, updated_at = ? WHERE id = ?', [newStock, newReservedStock, new Date().toISOString(), movement.component_id]);
            const cancelMovementId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO movements (
          id, movement_type_id, component_id, quantity, 
          unit_cost, reference_number, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                cancelMovementId,
                movement.movement_type_id,
                movement.component_id,
                -movement.quantity,
                movement.unit_cost,
                `CANCEL-${movement.id}`,
                `Cancelación de movimiento ${movement.id}: ${reason}`,
                req.user?.userId,
                now
            ]);
            res.json({
                message: 'Movimiento cancelado exitosamente',
                cancelMovementId,
                newStock,
                newReservedStock
            });
        });
    }
    catch (error) {
        console.error('Error al cancelar movimiento:', error);
        res.status(400).json({ error: error.message || 'Error al cancelar movimiento' });
    }
};
exports.cancelMovement = cancelMovement;
const createReservation = async (req, res) => {
    try {
        const { component_id, quantity, notes } = req.body;
        const userId = req.user?.userId;
        const component = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [component_id]);
        if (!component) {
            return res.status(400).json({ error: 'Componente no encontrado' });
        }
        const availableStock = component.current_stock - (component.reserved_stock || 0);
        if (availableStock < quantity) {
            return res.status(400).json({ error: 'Stock disponible insuficiente para reservar' });
        }
        await database_config_1.db.transaction(async () => {
            const newReservedStock = (component.reserved_stock || 0) + Number(quantity);
            await database_config_1.db.run('UPDATE components SET reserved_stock = ?, updated_at = ? WHERE id = ?', [newReservedStock, new Date().toISOString(), component_id]);
            const reservationId = generateId();
            const now = new Date().toISOString();
            // Usar un tipo de movimiento de reserva
            const reserveMovementTypeId = 'rsrv001';
            await database_config_1.db.run(`INSERT INTO movements (
          id, movement_type_id, component_id, quantity,
          reference_number, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                reservationId, reserveMovementTypeId, component_id, quantity,
                `RESERVE-${reservationId}`, notes || 'Reserva de stock', userId, now
            ]);
            res.status(201).json({
                message: 'Reserva creada exitosamente',
                reservation_id: reservationId,
                new_reserved_stock: newReservedStock
            });
        });
    }
    catch (error) {
        console.error('Error al crear reserva:', error);
        res.status(400).json({ error: error.message || 'Error al crear reserva' });
    }
};
exports.createReservation = createReservation;
const getReservations = async (req, res) => {
    try {
        const { component_id } = req.query;
        let query = `
      SELECT 
        c.id as component_id,
        c.code as component_code,
        c.name as component_name,
        c.current_stock,
        c.reserved_stock,
        (c.current_stock - c.reserved_stock) as available_stock,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.reserved_stock > 0
    `;
        const values = [];
        if (component_id) {
            query += ' AND c.id = ?';
            values.push(component_id);
        }
        query += ' ORDER BY c.name';
        const reservations = await database_config_1.db.query(query, values);
        res.json({ reservations });
    }
    catch (error) {
        console.error('Error al obtener reservas:', error);
        res.status(500).json({ error: 'Error al obtener reservas' });
    }
};
exports.getReservations = getReservations;
const createInvoice = async (req, res) => {
    try {
        const { movement_type_id, reference_number, items, shipping_cost = 0, shipping_tax = 0, notes } = req.body;
        const userId = req.user?.userId;
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La factura debe tener al menos un item' });
        }
        await database_config_1.db.transaction(async () => {
            const invoiceId = generateId();
            const now = new Date().toISOString();
            const movements = [];
            let totalInvoiceAmount = 0;
            for (const item of items) {
                const component = await database_config_1.db.get('SELECT * FROM components WHERE code = ?', [item.component_code]);
                if (!component) {
                    throw new Error(`Componente con código ${item.component_code} no encontrado`);
                }
                // Get movement type to determine if we need to update stock
                const movementType = await database_config_1.db.get('SELECT * FROM movement_types WHERE id = ?', [movement_type_id]);
                if (!movementType) {
                    throw new Error('Tipo de movimiento no válido');
                }
                // Update component stock based on movement type
                let newStock = component.current_stock;
                const quantity = Number(item.quantity);
                switch (movementType.operation) {
                    case 'IN':
                        newStock += quantity;
                        break;
                    case 'OUT':
                        if (component.current_stock < quantity) {
                            throw new Error(`Stock insuficiente para el componente ${item.component_code}. Stock disponible: ${component.current_stock}, solicitado: ${quantity}`);
                        }
                        newStock -= quantity;
                        break;
                    case 'RESERVE':
                        if ((component.current_stock - (component.reserved_stock || 0)) < quantity) {
                            throw new Error(`Stock disponible insuficiente para reservar ${item.component_code}`);
                        }
                        await database_config_1.db.run('UPDATE components SET reserved_stock = ?, updated_at = ? WHERE id = ?', [(component.reserved_stock || 0) + quantity, now, component.id]);
                        break;
                }
                // Update stock if it's IN or OUT operation
                if (movementType.operation === 'IN' || movementType.operation === 'OUT') {
                    await database_config_1.db.run('UPDATE components SET current_stock = ?, updated_at = ? WHERE id = ?', [newStock, now, component.id]);
                }
                const movementId = generateId();
                // Map movement type to valid table type values
                let tableType = 'salida'; // Default to 'salida' (out)
                switch (movementType.operation) {
                    case 'IN':
                        tableType = 'entrada';
                        break;
                    case 'OUT':
                        tableType = 'salida';
                        break;
                    case 'RESERVE':
                        tableType = 'reserva';
                        break;
                    case 'RELEASE':
                        tableType = 'liberacion';
                        break;
                    default:
                        tableType = 'ajuste';
                        break;
                }
                // Insert movement using the correct table structure
                await database_config_1.db.run(`INSERT INTO movements (
            id, type, component_id, quantity,
            unit_cost, total_cost, reference, notes, user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    movementId,
                    tableType, // Use mapped type value
                    component.id,
                    item.quantity,
                    item.unit_cost || 0,
                    item.total_cost || (item.quantity * (item.unit_cost || 0)),
                    reference_number,
                    notes || `Factura ${reference_number}`,
                    userId,
                    now
                ]);
                movements.push({
                    id: movementId,
                    component_code: item.component_code,
                    component_name: item.component_name,
                    quantity: item.quantity,
                    unit_cost: item.unit_cost || 0,
                    total_cost: item.total_cost,
                    new_stock: newStock
                });
                totalInvoiceAmount += Number(item.total_cost);
            }
            const finalAmount = totalInvoiceAmount + Number(shipping_cost) + Number(shipping_tax);
            res.status(201).json({
                message: 'Factura creada exitosamente',
                invoice_id: invoiceId,
                reference_number,
                movements,
                subtotal: totalInvoiceAmount,
                shipping_cost: Number(shipping_cost),
                shipping_tax: Number(shipping_tax),
                total_amount: finalAmount
            });
        });
    }
    catch (error) {
        console.error('Error al crear factura:', error);
        res.status(400).json({ error: error.message || 'Error al crear factura' });
    }
};
exports.createInvoice = createInvoice;
//# sourceMappingURL=movements.controller.js.map