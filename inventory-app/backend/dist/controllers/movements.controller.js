"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBulkMovements = exports.clearAllMovements = exports.createInvoice = exports.cancelMovement = exports.getMovementStats = exports.getMovementById = exports.createMovement = exports.getMovements = void 0;
const database_config_1 = require("../config/database.config");
const crypto_1 = require("crypto");
const generateId = () => (0, crypto_1.randomUUID)();
const TYPE_TO_OPERATION = {
    'entrada': 'IN',
    'salida': 'OUT',
};
const VALID_TYPES = ['entrada', 'salida'];
const getMovements = async (req, res) => {
    try {
        const { component_id, type: typeFilter, start_date, end_date, limit, offset = 0, recipe_id } = req.query;
        let query = `
      SELECT
        m.*,
        m.type as movement_type_code,
        m.type as movement_type_name,
        m.reference as reference_number,
        CASE
          WHEN m.type = 'entrada' THEN 'IN'
          WHEN m.type = 'salida' THEN 'OUT'
          ELSE 'IN'
        END as operation,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM movements m
      JOIN components c ON m.component_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;
        const values = [];
        if (component_id) {
            query += ` AND m.component_id = ?`;
            values.push(component_id);
        }
        if (typeFilter) {
            query += ` AND m.type = ?`;
            values.push(typeFilter);
        }
        if (recipe_id) {
            query += ` AND m.recipe_id = ?`;
            values.push(recipe_id);
        }
        if (start_date) {
            query += ` AND m.created_at >= ?`;
            values.push(start_date);
        }
        if (end_date) {
            query += ` AND m.created_at <= ?`;
            values.push(end_date);
        }
        query += ` ORDER BY m.created_at DESC`;
        if (limit) {
            query += ` LIMIT ? OFFSET ?`;
            values.push(Number(limit), Number(offset));
        }
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
        const { type: requestType, component_id, quantity, unit_cost = 0, reference_number, notes, recipe_id, recipe_name, } = req.body;
        const userId = req.user?.userId;
        const movementType = requestType;
        if (!movementType || !VALID_TYPES.includes(movementType)) {
            return res.status(400).json({ error: `Tipo de movimiento no válido. Valores permitidos: ${VALID_TYPES.join(', ')}` });
        }
        const operation = TYPE_TO_OPERATION[movementType];
        await database_config_1.db.transaction(async () => {
            const component = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [component_id]);
            if (!component) {
                throw new Error('Componente no encontrado');
            }
            let newStock = component.current_stock;
            let newCostPrice = component.cost_price || 0;
            let finalUnitCost = Number(unit_cost) || 0;
            if (operation === 'OUT' && finalUnitCost === 0) {
                finalUnitCost = component.cost_price || 0;
            }
            switch (operation) {
                case 'IN':
                    newStock += Number(quantity);
                    if (finalUnitCost > newCostPrice) {
                        newCostPrice = finalUnitCost;
                    }
                    break;
                case 'OUT':
                    if (component.current_stock < Number(quantity)) {
                        throw new Error(`Stock insuficiente. Disponible: ${component.current_stock}, solicitado: ${quantity}`);
                    }
                    newStock -= Number(quantity);
                    break;
            }
            await database_config_1.db.run('UPDATE components SET current_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?', [newStock, newCostPrice, new Date().toISOString(), component_id]);
            const movementId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO movements (id, type, component_id, quantity, unit_cost, total_cost, reference, notes, user_id, recipe_id, recipe_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [movementId, movementType, component_id, Number(quantity), finalUnitCost, Number(quantity) * finalUnitCost, reference_number || null, notes || null, userId, recipe_id || null, recipe_name || null, now]);
            const newMovement = await database_config_1.db.get(`SELECT m.*, m.type as movement_type_name, m.reference as reference_number,
          CASE WHEN m.type = 'entrada' THEN 'IN' WHEN m.type = 'salida' THEN 'OUT' ELSE 'IN' END as operation,
          c.name as component_name
         FROM movements m JOIN components c ON m.component_id = c.id WHERE m.id = ?`, [movementId]);
            res.status(201).json({ message: 'Movimiento registrado exitosamente', movement: newMovement, newStock });
        });
    }
    catch (error) {
        console.error('Error al crear movimiento:', error);
        if (!res.headersSent) {
            res.status(400).json({ error: error.message || 'Error al crear movimiento' });
        }
    }
};
exports.createMovement = createMovement;
const getMovementById = async (req, res) => {
    try {
        const { id } = req.params;
        const movement = await database_config_1.db.get(`SELECT 
        m.*,
        m.type as movement_type_code,
        m.type as movement_type_name,
        m.reference as reference_number,
        CASE
          WHEN m.type = 'entrada' THEN 'IN'
          WHEN m.type = 'salida' THEN 'OUT'
          ELSE 'IN'
        END as operation,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM movements m
      JOIN components c ON m.component_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.id = ?`, [id]);
        if (!movement) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        res.json({
            movement: {
                ...movement,
                operation: TYPE_TO_OPERATION[movement.type] || 'IN'
            }
        });
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
        let baseQuery = 'FROM movements m WHERE 1=1';
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
        SUM(CASE WHEN m.type = 'entrada' THEN m.quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN m.type = 'salida' THEN m.quantity ELSE 0 END) as total_out,
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
        const movement = await database_config_1.db.get('SELECT * FROM movements WHERE id = ?', [id]);
        if (!movement) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        const component = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [movement.component_id]);
        const operation = TYPE_TO_OPERATION[movement.type] || 'IN';
        await database_config_1.db.transaction(async () => {
            let newStock = component.current_stock;
            switch (operation) {
                case 'IN':
                    newStock -= movement.quantity;
                    break;
                case 'OUT':
                    newStock += movement.quantity;
                    break;
            }
            await database_config_1.db.run('UPDATE components SET current_stock = ?, updated_at = ? WHERE id = ?', [newStock, new Date().toISOString(), movement.component_id]);
            const cancelMovementId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO movements (
          id, type, component_id, quantity,
          unit_cost, total_cost, reference, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                cancelMovementId,
                movement.type,
                movement.component_id,
                -movement.quantity,
                movement.unit_cost,
                -movement.total_cost,
                `CANCEL-${movement.id}`,
                `Cancelación de movimiento ${movement.id}: ${reason}`,
                req.user?.userId,
                now
            ]);
            res.json({
                message: 'Movimiento cancelado exitosamente',
                cancelMovementId,
                newStock
            });
        });
    }
    catch (error) {
        console.error('Error al cancelar movimiento:', error);
        res.status(400).json({ error: error.message || 'Error al cancelar movimiento' });
    }
};
exports.cancelMovement = cancelMovement;
const createInvoice = async (req, res) => {
    try {
        const { type: requestType, reference_number, items, shipping_cost = 0, shipping_tax = 0, notes } = req.body;
        const userId = req.user?.userId;
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La factura debe tener al menos un item' });
        }
        const movementType = requestType || 'entrada';
        const operation = TYPE_TO_OPERATION[movementType] || 'IN';
        await database_config_1.db.transaction(async () => {
            const invoiceId = generateId();
            const now = new Date().toISOString();
            const movements = [];
            let totalInvoiceAmount = 0;
            // ======= LÓGICA DE DISTRIBUCIÓN DE COSTOS =======
            // PASO 1: Identificar los componentes y cantidades (ya hecho en el frontend)
            // PASO 2: Sumar el total de unidades compradas
            const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);
            // PASO 3: Sumar los costos adicionales (envío + impuestos + otros cargos)
            const additionalCost = Number(shipping_cost) + Number(shipping_tax);
            // PASO 4: Calcular el costo adicional por unidad
            // Se divide el costo adicional total entre la cantidad total de unidades
            const costPerUnit = totalQuantity > 0 ? additionalCost / totalQuantity : 0;
            for (const item of items) {
                const component = await database_config_1.db.get('SELECT * FROM components WHERE code = ?', [item.component_code]);
                if (!component) {
                    throw new Error(`Componente con código ${item.component_code} no encontrado`);
                }
                // Update component stock based on movement type
                let newStock = component.current_stock;
                let newCostPrice = component.cost_price || 0;
                const quantity = Number(item.quantity);
                // PASO 5: Sumar ese valor al precio unitario base de cada producto
                // Esto ajusta cada precio para que incluya una parte proporcional del costo del envío
                // Precio unitario base del item (sin costos adicionales)
                const baseUnitCost = Number(item.total_cost) / quantity;
                // Precio final = precio base + costo adicional por unidad
                const itemUnitCost = baseUnitCost + costPerUnit;
                switch (operation) {
                    case 'IN':
                        newStock += quantity;
                        // NUEVA FUNCIONALIDAD: Actualizar el precio del componente si el nuevo precio es mayor
                        if (itemUnitCost > newCostPrice) {
                            newCostPrice = itemUnitCost;
                        }
                        break;
                    case 'OUT':
                        if (component.current_stock < quantity) {
                            throw new Error(`Stock insuficiente para el componente ${item.component_code}. Stock disponible: ${component.current_stock}, solicitado: ${quantity}`);
                        }
                        newStock -= quantity;
                        break;
                }
                // Update stock and price if it's IN or OUT operation
                if (operation === 'IN' || operation === 'OUT') {
                    await database_config_1.db.run('UPDATE components SET current_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?', [newStock, newCostPrice, now, component.id]);
                }
                const movementId = generateId();
                await database_config_1.db.run(`INSERT INTO movements (
            id, type, component_id, quantity,
            unit_cost, total_cost, reference, notes, user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    movementId,
                    movementType,
                    component.id,
                    item.quantity,
                    itemUnitCost, // Usar el unit_cost que incluye costos adicionales
                    item.quantity * itemUnitCost, // SIEMPRE calcular con el unit_cost que incluye costos adicionales
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
                    base_unit_cost: baseUnitCost, // Precio unitario base del producto
                    additional_cost_per_unit: costPerUnit, // Costo adicional distribuido por unidad
                    final_unit_cost: itemUnitCost, // Precio final por unidad (base + adicional)
                    total_additional_cost: costPerUnit * quantity, // Costo adicional total para este item
                    total_cost: item.quantity * itemUnitCost, // Costo total final del item
                    new_stock: newStock,
                    // Información para debug
                    calculation_details: {
                        original_total_cost: item.total_cost,
                        quantity: quantity,
                        base_unit_cost: baseUnitCost,
                        shipping_distribution: costPerUnit,
                        final_unit_cost: itemUnitCost
                    }
                });
                totalInvoiceAmount += (item.quantity * itemUnitCost); // Sumar el total_cost que incluye costos adicionales
            }
            const finalAmount = totalInvoiceAmount; // Ya incluye los costos de envío distribuidos
            res.status(201).json({
                message: 'Factura creada exitosamente',
                invoice_id: invoiceId,
                reference_number,
                movements,
                // Información de costos
                subtotal: totalInvoiceAmount,
                shipping_cost: Number(shipping_cost),
                shipping_tax: Number(shipping_tax),
                total_amount: finalAmount,
                // Información de distribución de costos
                cost_distribution: {
                    total_items: items.length,
                    total_quantity: totalQuantity,
                    additional_costs: additionalCost,
                    cost_per_unit: costPerUnit,
                    explanation: `Se distribuyeron $${additionalCost.toFixed(4)} entre ${totalQuantity} unidades = $${costPerUnit.toFixed(4)} por unidad`
                }
            });
        });
    }
    catch (error) {
        console.error('Error al crear factura:', error);
        res.status(400).json({ error: error.message || 'Error al crear factura' });
    }
};
exports.createInvoice = createInvoice;
const clearAllMovements = async (req, res) => {
    try {
        // Verificar que el usuario sea admin
        const userRole = req.user?.role;
        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Solo los administradores pueden limpiar los movimientos' });
        }
        // Obtener el conteo actual de movimientos
        const countBefore = await database_config_1.db.get('SELECT COUNT(*) as count FROM movements');
        if (countBefore.count === 0) {
            return res.json({
                message: 'No hay movimientos para eliminar',
                deleted: 0
            });
        }
        // Eliminar todos los movimientos
        await database_config_1.db.run('DELETE FROM movements');
        // Verificar que se eliminaron
        const countAfter = await database_config_1.db.get('SELECT COUNT(*) as count FROM movements');
        res.json({
            message: `Se eliminaron ${countBefore.count} movimientos exitosamente`,
            deleted: countBefore.count,
            remaining: countAfter.count
        });
    }
    catch (error) {
        console.error('Error al limpiar movimientos:', error);
        res.status(500).json({ error: error.message || 'Error al limpiar movimientos' });
    }
};
exports.clearAllMovements = clearAllMovements;
const createBulkMovements = async (req, res) => {
    try {
        const { type: requestType, reference_number, notes: globalNotes, items, recipe_id, recipe_name } = req.body;
        const userId = req.user?.userId;
        if (!requestType || !VALID_TYPES.includes(requestType)) {
            return res.status(400).json({ error: `Tipo de movimiento no válido. Valores permitidos: ${VALID_TYPES.join(', ')}` });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un item' });
        }
        const operation = TYPE_TO_OPERATION[requestType];
        // Pass 1: validate all items before touching any data — all-or-nothing semantics
        const preErrors = [];
        const componentCache = {};
        for (const item of items) {
            const { component_code, quantity } = item;
            if (!component_code || !quantity || Number(quantity) <= 0) {
                preErrors.push({ component_code, error: 'Código o cantidad inválidos' });
                continue;
            }
            const code = String(component_code).trim();
            const component = await database_config_1.db.get('SELECT * FROM components WHERE code = ? AND is_active = 1', [code]);
            if (!component) {
                preErrors.push({ component_code, error: `Componente con código "${component_code}" no encontrado` });
                continue;
            }
            if (operation === 'OUT' && component.current_stock < Number(quantity)) {
                preErrors.push({
                    component_code,
                    component_name: component.name,
                    available_stock: component.current_stock,
                    requested_quantity: Number(quantity),
                    error: `Stock insuficiente. Disponible: ${component.current_stock}, solicitado: ${quantity}`
                });
                continue;
            }
            componentCache[code] = component;
        }
        if (preErrors.length > 0) {
            return res.status(400).json({
                error: `No se pueden crear los movimientos: ${preErrors.length} componente(s) con error`,
                processed: 0,
                failed: preErrors.length,
                results: [],
                errors: preErrors,
            });
        }
        // Pass 2: execute all inside a single transaction — guaranteed atomic
        const results = [];
        await database_config_1.db.transaction(async () => {
            for (const item of items) {
                const { component_code, quantity, unit_cost = 0, notes } = item;
                const code = String(component_code).trim();
                const component = componentCache[code];
                let newStock = component.current_stock;
                let newCostPrice = component.cost_price || 0;
                let finalUnitCost = Number(unit_cost) || 0;
                if (operation === 'OUT') {
                    if (finalUnitCost === 0)
                        finalUnitCost = component.cost_price || 0;
                    newStock -= Number(quantity);
                }
                else {
                    newStock += Number(quantity);
                    if (finalUnitCost > newCostPrice)
                        newCostPrice = finalUnitCost;
                }
                await database_config_1.db.run('UPDATE components SET current_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?', [newStock, newCostPrice, new Date().toISOString(), component.id]);
                const movementId = generateId();
                const now = new Date().toISOString();
                const totalCost = Number(quantity) * finalUnitCost;
                await database_config_1.db.run(`INSERT INTO movements (id, type, component_id, quantity, unit_cost, total_cost, reference, notes, user_id, recipe_id, recipe_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [movementId, requestType, component.id, Number(quantity), finalUnitCost, totalCost,
                    reference_number || null, notes || globalNotes || null, userId, recipe_id || null, recipe_name || null, now]);
                results.push({
                    component_code,
                    component_name: component.name,
                    quantity: Number(quantity),
                    unit_cost: finalUnitCost,
                    total_cost: totalCost,
                    new_stock: newStock,
                });
            }
        });
        res.status(201).json({
            message: `Carga masiva completada: ${results.length} movimientos creados`,
            processed: results.length,
            failed: 0,
            results,
            errors: [],
        });
    }
    catch (error) {
        console.error('Error en carga masiva:', error);
        res.status(400).json({ error: error.message || 'Error en carga masiva' });
    }
};
exports.createBulkMovements = createBulkMovements;
//# sourceMappingURL=movements.controller.js.map