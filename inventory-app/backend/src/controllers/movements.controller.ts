import { Request, Response } from 'express';
import { db } from '../config/database.config';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Mapeo de tipos a operaciones para compatibilidad
const TYPE_TO_OPERATION: { [key: string]: string } = {
  'entrada': 'IN',
  'salida': 'OUT', 
  'reserva': 'RESERVE',
  'liberacion': 'RELEASE',
  'ajuste': 'IN', // Por defecto ajuste como entrada
  'transferencia': 'IN' // Por defecto transferencia como entrada
};

export const getMovements = async (req: Request, res: Response) => {
  try {
    const { component_id, movement_type_id, start_date, end_date, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        m.*,
        m.type as movement_type_code,
        m.type as movement_type_name,
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
    
    const values: any[] = [];

    if (component_id) {
      query += ` AND m.component_id = ?`;
      values.push(component_id);
    }

    if (movement_type_id) {
      // Convertir movement_type_id a type para compatibilidad con frontend
      let typeValue = movement_type_id;
      if (typeof movement_type_id === 'string') {
        if (movement_type_id.includes('entrada') || movement_type_id === 'entrada001') typeValue = 'entrada';
        else if (movement_type_id.includes('salida') || movement_type_id === 'salida001') typeValue = 'salida';
        else if (movement_type_id.includes('reserva') || movement_type_id === 'reserva001') typeValue = 'reserva';
        else if (movement_type_id.includes('liberacion') || movement_type_id === 'libera001') typeValue = 'liberacion';
      }
      query += ` AND m.type = ?`;
      values.push(typeValue);
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

    const movements = await db.query(query, values);
    res.json({ movements });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

export const createMovement = async (req: Request, res: Response) => {
  try {
    const {
      movement_type_id,
      type: requestType,
      component_id,
      quantity,
      unit_cost = 0,
      reference_number,
      notes
    } = req.body;

    const userId = req.user?.userId;

    // Determinar el tipo basado en movement_type_id o type
    let movementType = requestType;
    if (movement_type_id && !requestType) {
      if (movement_type_id.includes('entrada') || movement_type_id === 'entrada001') movementType = 'entrada';
      else if (movement_type_id.includes('salida') || movement_type_id === 'salida001') movementType = 'salida';
      else if (movement_type_id.includes('reserva') || movement_type_id === 'reserva001') movementType = 'reserva';
      else if (movement_type_id.includes('liberacion') || movement_type_id === 'libera001') movementType = 'liberacion';
      else movementType = 'entrada'; // Default
    }

    if (!movementType || !['entrada', 'salida', 'reserva', 'liberacion', 'ajuste', 'transferencia'].includes(movementType)) {
      return res.status(400).json({ error: 'Tipo de movimiento no válido' });
    }

    const component = await db.get(
      'SELECT * FROM components WHERE id = ?',
      [component_id]
    );

    if (!component) {
      return res.status(400).json({ error: 'Componente no encontrado' });
    }

    const operation = TYPE_TO_OPERATION[movementType] || 'IN';

    await db.transaction(async () => {
      let newStock = component.current_stock;
      let newReservedStock = component.reserved_stock || 0;
      let newCostPrice = component.cost_price || 0;

      switch (operation) {
        case 'IN':
          newStock += Number(quantity);
          // NUEVA FUNCIONALIDAD: Actualizar el precio del componente si el nuevo precio es mayor
          if (unit_cost > newCostPrice) {
            newCostPrice = unit_cost;
          }
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

      await db.run(
        'UPDATE components SET current_stock = ?, reserved_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
        [newStock, newReservedStock, newCostPrice, new Date().toISOString(), component_id]
      );

      const movementId = generateId();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO movements (
          id, type, component_id, quantity, 
          unit_cost, total_cost, reference, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId, movementType, component_id, quantity,
          unit_cost, quantity * unit_cost, reference_number, notes, userId, now
        ]
      );

      const newMovement = await db.get(
        `SELECT 
          m.*,
          m.type as movement_type_name,
          c.name as component_name
        FROM movements m
        JOIN components c ON m.component_id = c.id
        WHERE m.id = ?`,
        [movementId]
      );

      res.status(201).json({
        message: 'Movimiento registrado exitosamente',
        movement: {
          ...newMovement,
          operation // Agregar operation para compatibilidad
        },
        newStock,
        newReservedStock
      });
    });
  } catch (error: any) {
    console.error('Error al crear movimiento:', error);
    res.status(400).json({ error: error.message || 'Error al crear movimiento' });
  }
};

export const getMovementById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const movement = await db.get(
      `SELECT 
        m.*,
        m.type as movement_type_code,
        m.type as movement_type_name,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM movements m
      JOIN components c ON m.component_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.id = ?`,
      [id]
    );

    if (!movement) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json({ 
      movement: {
        ...movement,
        operation: TYPE_TO_OPERATION[movement.type] || 'IN'
      }
    });
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    res.status(500).json({ error: 'Error al obtener movimiento' });
  }
};

export const getMovementStats = async (req: Request, res: Response) => {
  try {
    const { component_id, start_date, end_date } = req.query;

    let baseQuery = 'FROM movements m WHERE 1=1';
    const values: any[] = [];

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

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_movements,
        SUM(CASE WHEN m.type IN ('entrada', 'ajuste', 'transferencia') THEN m.quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN m.type = 'salida' THEN m.quantity ELSE 0 END) as total_out,
        SUM(CASE WHEN m.type = 'reserva' THEN m.quantity ELSE 0 END) as total_reserved,
        SUM(CASE WHEN m.type = 'liberacion' THEN m.quantity ELSE 0 END) as total_released,
        SUM(m.quantity * m.unit_cost) as total_cost
      ${baseQuery}
    `, values);

    res.json({ stats });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

export const cancelMovement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const movement = await db.get(
      'SELECT * FROM movements WHERE id = ?',
      [id]
    );

    if (!movement) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    const component = await db.get(
      'SELECT * FROM components WHERE id = ?',
      [movement.component_id]
    );

    const operation = TYPE_TO_OPERATION[movement.type] || 'IN';

    await db.transaction(async () => {
      let newStock = component.current_stock;
      let newReservedStock = component.reserved_stock || 0;

      switch (operation) {
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

      await db.run(
        'UPDATE components SET current_stock = ?, reserved_stock = ?, updated_at = ? WHERE id = ?',
        [newStock, newReservedStock, new Date().toISOString(), movement.component_id]
      );

      const cancelMovementId = generateId();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO movements (
          id, type, component_id, quantity, 
          unit_cost, total_cost, reference, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );

      res.json({
        message: 'Movimiento cancelado exitosamente',
        cancelMovementId,
        newStock,
        newReservedStock
      });
    });
  } catch (error: any) {
    console.error('Error al cancelar movimiento:', error);
    res.status(400).json({ error: error.message || 'Error al cancelar movimiento' });
  }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const { component_id, quantity, notes } = req.body;
    const userId = req.user?.userId;

    const component = await db.get(
      'SELECT * FROM components WHERE id = ?',
      [component_id]
    );

    if (!component) {
      return res.status(400).json({ error: 'Componente no encontrado' });
    }

    const availableStock = component.current_stock - (component.reserved_stock || 0);
    if (availableStock < quantity) {
      return res.status(400).json({ error: 'Stock disponible insuficiente para reservar' });
    }

    await db.transaction(async () => {
      const newReservedStock = (component.reserved_stock || 0) + Number(quantity);
      
      await db.run(
        'UPDATE components SET reserved_stock = ?, updated_at = ? WHERE id = ?',
        [newReservedStock, new Date().toISOString(), component_id]
      );

      const reservationId = generateId();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO movements (
          id, type, component_id, quantity,
          unit_cost, total_cost, reference, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reservationId, 'reserva', component_id, quantity,
          0, 0, `RESERVE-${reservationId}`, notes || 'Reserva de stock', userId, now
        ]
      );

      res.status(201).json({
        message: 'Reserva creada exitosamente',
        reservation_id: reservationId,
        new_reserved_stock: newReservedStock
      });
    });
  } catch (error: any) {
    console.error('Error al crear reserva:', error);
    res.status(400).json({ error: error.message || 'Error al crear reserva' });
  }
};

export const getReservations = async (req: Request, res: Response) => {
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

    const values: any[] = [];

    if (component_id) {
      query += ' AND c.id = ?';
      values.push(component_id);
    }

    query += ' ORDER BY c.name';

    const reservations = await db.query(query, values);
    res.json({ reservations });
  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { movement_type_id, type: requestType, reference_number, items, shipping_cost = 0, shipping_tax = 0, notes } = req.body;
    const userId = req.user?.userId;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'La factura debe tener al menos un item' });
    }

    // Determinar el tipo basado en movement_type_id o type
    let movementType = requestType;
    if (movement_type_id && !requestType) {
      if (movement_type_id.includes('entrada') || movement_type_id === 'entrada001') movementType = 'entrada';
      else if (movement_type_id.includes('salida') || movement_type_id === 'salida001') movementType = 'salida';
      else movementType = 'entrada'; // Default
    }

    if (!movementType) {
      movementType = 'entrada'; // Default
    }

    const operation = TYPE_TO_OPERATION[movementType] || 'IN';

    await db.transaction(async () => {
      const invoiceId = generateId();
      const now = new Date().toISOString();
      const movements = [];

      let totalInvoiceAmount = 0;
      
      // Calcular costo adicional por item (envío + impuestos distribuido entre todos los items)
      const additionalCost = Number(shipping_cost) + Number(shipping_tax);
      const costPerItem = items.length > 0 ? additionalCost / items.length : 0;

      for (const item of items) {
        const component = await db.get(
          'SELECT * FROM components WHERE code = ?',
          [item.component_code]
        );

        if (!component) {
          throw new Error(`Componente con código ${item.component_code} no encontrado`);
        }

        // Update component stock based on movement type
        let newStock = component.current_stock;
        let newCostPrice = component.cost_price || 0;
        const quantity = Number(item.quantity);
        const baseUnitCost = Number(item.unit_cost || 0);
        // NUEVA FUNCIONALIDAD: Agregar costo de envío e impuestos al unit_cost
        const itemUnitCost = baseUnitCost + costPerItem;

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
          case 'RESERVE':
            if ((component.current_stock - (component.reserved_stock || 0)) < quantity) {
              throw new Error(`Stock disponible insuficiente para reservar ${item.component_code}`);
            }
            await db.run(
              'UPDATE components SET reserved_stock = ?, updated_at = ? WHERE id = ?',
              [(component.reserved_stock || 0) + quantity, now, component.id]
            );
            break;
        }

        // Update stock and price if it's IN or OUT operation
        if (operation === 'IN' || operation === 'OUT') {
          await db.run(
            'UPDATE components SET current_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
            [newStock, newCostPrice, now, component.id]
          );
        }

        const movementId = generateId();

        await db.run(
          `INSERT INTO movements (
            id, type, component_id, quantity,
            unit_cost, total_cost, reference, notes, user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movementId, 
            movementType,
            component.id, 
            item.quantity,
            itemUnitCost, // Usar el unit_cost que incluye costos adicionales
            item.total_cost || (item.quantity * itemUnitCost),
            reference_number, 
            notes || `Factura ${reference_number}`, 
            userId, 
            now
          ]
        );

        movements.push({
          id: movementId,
          component_code: item.component_code,
          component_name: item.component_name,
          quantity: item.quantity,
          unit_cost: itemUnitCost, // Mostrar el unit_cost que incluye costos adicionales
          base_unit_cost: baseUnitCost, // Mostrar también el costo base original
          additional_cost_per_item: costPerItem, // Mostrar cuánto se agregó por costos de envío/impuestos
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
  } catch (error: any) {
    console.error('Error al crear factura:', error);
    res.status(400).json({ error: error.message || 'Error al crear factura' });
  }
};