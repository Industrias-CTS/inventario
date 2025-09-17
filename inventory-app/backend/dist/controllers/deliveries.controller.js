"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveriesController = void 0;
const database_config_1 = require("../config/database.config");
const pdfkit_1 = __importDefault(require("pdfkit"));
exports.deliveriesController = {
    async getDeliveries(req, res) {
        try {
            const { page = 1, limit = 10, status, search } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            let query = `
        SELECT 
          d.*,
          u.username as created_by_username,
          COUNT(di.id) as items_count,
          COALESCE(SUM(di.total_price), 0) as total_amount
        FROM deliveries d
        LEFT JOIN users u ON d.created_by = u.id
        LEFT JOIN delivery_items di ON d.id = di.delivery_id
        WHERE 1=1
      `;
            const params = [];
            if (status) {
                query += ` AND d.status = ?`;
                params.push(status);
            }
            if (search) {
                query += ` AND (d.delivery_number LIKE ? OR d.recipient_name LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }
            query += `
        GROUP BY d.id, u.username
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `;
            params.push(Number(limit), offset);
            const deliveries = await database_config_1.db.query(query, params);
            // Obtener el total de registros para paginación
            let countQuery = `
        SELECT COUNT(DISTINCT d.id) as total
        FROM deliveries d
        WHERE 1=1
      `;
            const countParams = [];
            if (status) {
                countQuery += ` AND d.status = ?`;
                countParams.push(status);
            }
            if (search) {
                countQuery += ` AND (d.delivery_number LIKE ? OR d.recipient_name LIKE ?)`;
                countParams.push(`%${search}%`, `%${search}%`);
            }
            const countResult = await database_config_1.db.query(countQuery, countParams);
            const total = countResult[0]?.total || 0;
            res.json({
                deliveries: deliveries,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            });
        }
        catch (error) {
            console.error('Error al obtener remisiones:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },
    async getDeliveryById(req, res) {
        try {
            const { id } = req.params;
            const delivery = await database_config_1.db.query(`
        SELECT 
          d.*,
          u.username as created_by_username
        FROM deliveries d
        LEFT JOIN users u ON d.created_by = u.id
        WHERE d.id = ?
      `, [id]);
            if (delivery.length === 0) {
                return res.status(404).json({ error: 'Remisión no encontrada' });
            }
            const items = await database_config_1.db.query(`
        SELECT 
          di.*,
          c.code as component_code,
          c.name as component_name,
          c.description as component_description,
          u.name as unit_name,
          u.symbol as unit_symbol
        FROM delivery_items di
        JOIN components c ON di.component_id = c.id
        LEFT JOIN units u ON c.unit_id = u.id
        WHERE di.delivery_id = ?
        ORDER BY di.created_at
      `, [id]);
            res.json({
                delivery: delivery[0],
                items
            });
        }
        catch (error) {
            console.error('Error al obtener remisión:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },
    async createDelivery(req, res) {
        try {
            const { recipient_name, recipient_company, recipient_id, delivery_date, notes, delivery_address, phone, email, items } = req.body;
            const userId = req.user?.userId || req.user?.id;
            if (!userId) {
                console.error('Error: user_id is null or undefined. req.user:', req.user);
                return res.status(401).json({
                    error: 'Usuario no autenticado correctamente'
                });
            }
            if (!recipient_name || !items || items.length === 0) {
                return res.status(400).json({
                    error: 'Nombre del destinatario e items son requeridos'
                });
            }
            const result = await database_config_1.db.transaction(async () => {
                // Generar número de remisión (SQLite no tiene función, generamos manualmente)
                const year = new Date().getFullYear();
                const existingNumbers = await database_config_1.db.query(`SELECT delivery_number FROM deliveries 
           WHERE delivery_number LIKE 'REM-${year}-%' 
           ORDER BY delivery_number DESC LIMIT 1`);
                let sequence = 1;
                if (existingNumbers.length > 0) {
                    const lastNumber = existingNumbers[0].delivery_number;
                    const lastSequence = parseInt(lastNumber.split('-')[2]);
                    sequence = lastSequence + 1;
                }
                const deliveryNumber = `REM-${year}-${sequence.toString().padStart(4, '0')}`;
                // Crear la remisión
                await database_config_1.db.run(`
          INSERT INTO deliveries (
            delivery_number, recipient_name, recipient_company, recipient_id, 
            delivery_date, notes, delivery_address, phone, email, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    deliveryNumber, recipient_name, recipient_company, recipient_id,
                    delivery_date, notes, delivery_address, phone, email, userId
                ]);
                // Obtener la remisión creada por número de remisión (más confiable)
                const delivery = await database_config_1.db.get(`
          SELECT * FROM deliveries WHERE delivery_number = ?
        `, [deliveryNumber]);
                if (!delivery) {
                    throw new Error('Error: No se pudo crear la remisión');
                }
                // Crear los items de remisión
                for (const item of items) {
                    const totalPrice = item.quantity * item.unit_price;
                    await database_config_1.db.run(`
            INSERT INTO delivery_items (
              delivery_id, component_id, quantity, serial_numbers, 
              unit_price, total_price, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
                        delivery.id, item.component_id, item.quantity,
                        item.serial_numbers, item.unit_price, totalPrice, item.notes
                    ]);
                    // Registrar movimiento de salida (usando estructura de BD de producción)
                    await database_config_1.db.run(`
            INSERT INTO movements (
              type, component_id, quantity, 
              reference, notes, user_id
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
                        'salida', item.component_id, -Math.abs(item.quantity),
                        `Remisión ${deliveryNumber}`,
                        `Entrega a ${recipient_name}`,
                        userId
                    ]);
                }
                return delivery;
            });
            res.status(201).json({
                message: 'Remisión creada exitosamente',
                delivery: result
            });
        }
        catch (error) {
            console.error('Error al crear remisión:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },
    async updateDelivery(req, res) {
        try {
            const { id } = req.params;
            const { recipient_name, recipient_company, recipient_id, delivery_date, notes, signature_data, delivery_address, phone, email, status } = req.body;
            await database_config_1.db.run(`
        UPDATE deliveries 
        SET recipient_name = ?, recipient_company = ?, recipient_id = ?,
            delivery_date = ?, notes = ?, signature_data = ?,
            delivery_address = ?, phone = ?, email = ?, status = ?
        WHERE id = ?
      `, [
                recipient_name, recipient_company, recipient_id,
                delivery_date, notes, signature_data, delivery_address,
                phone, email, status, id
            ]);
            const updatedDelivery = await database_config_1.db.get('SELECT * FROM deliveries WHERE id = ?', [id]);
            if (!updatedDelivery) {
                return res.status(404).json({ error: 'Remisión no encontrada' });
            }
            res.json({
                message: 'Remisión actualizada exitosamente',
                delivery: updatedDelivery
            });
        }
        catch (error) {
            console.error('Error al actualizar remisión:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },
    async deleteDelivery(req, res) {
        try {
            const { id } = req.params;
            const existing = await database_config_1.db.get('SELECT id FROM deliveries WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ error: 'Remisión no encontrada' });
            }
            await database_config_1.db.run('DELETE FROM deliveries WHERE id = ?', [id]);
            res.json({ message: 'Remisión eliminada exitosamente' });
        }
        catch (error) {
            console.error('Error al eliminar remisión:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },
    async generateDeliveryPDF(req, res) {
        try {
            const { id } = req.params;
            // Obtener datos de la remisión
            const deliveryResult = await database_config_1.db.query(`
        SELECT 
          d.*,
          u.username as created_by_username,
          u.first_name,
          u.last_name
        FROM deliveries d
        LEFT JOIN users u ON d.created_by = u.id
        WHERE d.id = ?
      `, [id]);
            if (deliveryResult.length === 0) {
                return res.status(404).json({ error: 'Remisión no encontrada' });
            }
            const delivery = deliveryResult[0];
            // Obtener items de la remisión
            const items = await database_config_1.db.query(`
        SELECT 
          di.*,
          c.code as component_code,
          c.name as component_name,
          c.description as component_description,
          u.name as unit_name,
          u.symbol as unit_symbol
        FROM delivery_items di
        JOIN components c ON di.component_id = c.id
        LEFT JOIN units u ON c.unit_id = u.id
        WHERE di.delivery_id = ?
        ORDER BY di.created_at
      `, [id]);
            // Crear el PDF
            const doc = new pdfkit_1.default({ margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=remision-${delivery.delivery_number}.pdf`);
            doc.pipe(res);
            // Encabezado
            doc.fontSize(20).text('REMISIÓN DE ENTREGA', 50, 50, { align: 'center' });
            doc.fontSize(14).text(`No. ${delivery.delivery_number}`, 50, 80, { align: 'right' });
            // Información de la empresa
            doc.fontSize(12)
                .text('SISTEMA DE INVENTARIO', 50, 120)
                .text(`Fecha: ${new Date(delivery.delivery_date).toLocaleDateString()}`, 50, 140)
                .text(`Creado por: ${delivery.first_name} ${delivery.last_name}`, 50, 160);
            // Información del destinatario
            doc.fontSize(14).text('ENTREGAR A:', 50, 200);
            doc.fontSize(12)
                .text(`Nombre: ${delivery.recipient_name}`, 50, 220)
                .text(`Empresa: ${delivery.recipient_company || 'N/A'}`, 50, 240)
                .text(`Documento: ${delivery.recipient_id || 'N/A'}`, 50, 260)
                .text(`Teléfono: ${delivery.phone || 'N/A'}`, 50, 280)
                .text(`Email: ${delivery.email || 'N/A'}`, 50, 300);
            if (delivery.delivery_address) {
                doc.text(`Dirección: ${delivery.delivery_address}`, 50, 320);
            }
            // Tabla de items
            const tableTop = 360;
            doc.fontSize(12).text('ITEMS ENTREGADOS:', 50, tableTop - 20);
            // Headers
            doc.fontSize(10)
                .text('Código', 50, tableTop)
                .text('Descripción', 120, tableTop)
                .text('Cantidad', 350, tableTop)
                .text('Unidad', 410, tableTop)
                .text('Precio Unit.', 460, tableTop)
                .text('Total', 520, tableTop);
            doc.moveTo(50, tableTop + 15).lineTo(570, tableTop + 15).stroke();
            let currentY = tableTop + 25;
            let total = 0;
            items.forEach((item) => {
                const itemTotal = item.total_price || 0;
                total += itemTotal;
                doc.fontSize(9)
                    .text(item.component_code, 50, currentY)
                    .text(item.component_name, 120, currentY, { width: 220 })
                    .text(item.quantity.toString(), 350, currentY)
                    .text(item.unit_symbol || 'UN', 410, currentY)
                    .text(`$${item.unit_price?.toFixed(2) || '0.00'}`, 460, currentY)
                    .text(`$${itemTotal.toFixed(2)}`, 520, currentY);
                if (item.serial_numbers) {
                    currentY += 12;
                    doc.fontSize(8).text(`Seriales: ${item.serial_numbers}`, 120, currentY, { width: 220 });
                }
                currentY += 20;
            });
            // Total
            doc.moveTo(350, currentY).lineTo(570, currentY).stroke();
            currentY += 10;
            doc.fontSize(12).text(`TOTAL: $${total.toFixed(2)}`, 460, currentY);
            // Notas
            if (delivery.notes) {
                currentY += 40;
                doc.fontSize(12).text('NOTAS:', 50, currentY);
                doc.fontSize(10).text(delivery.notes, 50, currentY + 20, { width: 500 });
                currentY += 60;
            }
            // Firmas
            currentY += 40;
            doc.fontSize(12)
                .text('_________________________', 50, currentY)
                .text('_________________________', 350, currentY)
                .text('ENTREGADO POR', 50, currentY + 20)
                .text('RECIBIDO POR', 350, currentY + 20);
            if (delivery.signature_data) {
                doc.fontSize(10).text('Firmado digitalmente', 350, currentY + 40);
            }
            doc.end();
        }
        catch (error) {
            console.error('Error al generar PDF:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
};
//# sourceMappingURL=deliveries.controller.js.map