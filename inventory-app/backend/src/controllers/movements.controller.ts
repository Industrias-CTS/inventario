import { Request, Response } from 'express';
import { db } from '@/config/database';

export const getMovements = async (req: Request, res: Response) => {
  try {
    const { component_id, movement_type_id, start_date, end_date } = req.query;
    
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
    
    const values: any[] = [];
    let paramCount = 0;

    if (component_id) {
      paramCount++;
      query += ` AND m.component_id = $${paramCount}`;
      values.push(component_id);
    }

    if (movement_type_id) {
      paramCount++;
      query += ` AND m.movement_type_id = $${paramCount}`;
      values.push(movement_type_id);
    }

    if (start_date) {
      paramCount++;
      query += ` AND m.created_at >= $${paramCount}`;
      values.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND m.created_at <= $${paramCount}`;
      values.push(end_date);
    }

    query += ' ORDER BY m.created_at DESC';

    const result = await db.query(query, values);
    res.json({ movements: result.rows });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

export const createMovement = async (req: Request, res: Response) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      movement_type_id,
      component_id,
      quantity,
      unit_cost = 0,
      reference_number,
      notes,
      recipe_id
    } = req.body;
    
    const user_id = req.user!.userId;

    // Obtener tipo de movimiento
    const typeResult = await client.query(
      'SELECT operation FROM movement_types WHERE id = $1',
      [movement_type_id]
    );
    
    if (typeResult.rows.length === 0) {
      throw new Error('Tipo de movimiento no válido');
    }
    
    const operation = typeResult.rows[0].operation;

    // Obtener stock actual
    const stockResult = await client.query(
      'SELECT current_stock, reserved_stock FROM components WHERE id = $1',
      [component_id]
    );
    
    if (stockResult.rows.length === 0) {
      throw new Error('Componente no encontrado');
    }
    
    const { current_stock, reserved_stock } = stockResult.rows[0];
    let newStock = parseFloat(current_stock);
    let newReservedStock = parseFloat(reserved_stock);

    // Actualizar stock según operación
    switch (operation) {
      case 'IN':
        newStock += parseFloat(quantity);
        break;
      case 'OUT':
        if (newStock - newReservedStock < parseFloat(quantity)) {
          throw new Error('Stock insuficiente');
        }
        newStock -= parseFloat(quantity);
        break;
      case 'RESERVE':
        if (newStock - newReservedStock < parseFloat(quantity)) {
          throw new Error('Stock disponible insuficiente para reservar');
        }
        newReservedStock += parseFloat(quantity);
        break;
      case 'RELEASE':
        if (newReservedStock < parseFloat(quantity)) {
          throw new Error('No hay suficiente stock reservado para liberar');
        }
        newReservedStock -= parseFloat(quantity);
        break;
    }

    // Actualizar stock del componente
    await client.query(
      'UPDATE components SET current_stock = $1, reserved_stock = $2 WHERE id = $3',
      [newStock, newReservedStock, component_id]
    );

    // Crear movimiento
    const movementQuery = `
      INSERT INTO movements (
        movement_type_id, component_id, quantity, unit_cost,
        reference_number, notes, user_id, recipe_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const movementValues = [
      movement_type_id,
      component_id,
      quantity,
      unit_cost,
      reference_number,
      notes,
      user_id,
      recipe_id
    ];

    const movementResult = await client.query(movementQuery, movementValues);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Movimiento creado exitosamente',
      movement: movementResult.rows[0],
      newStock,
      newReservedStock
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al crear movimiento:', error);
    res.status(400).json({ error: error.message || 'Error al crear movimiento' });
  } finally {
    client.release();
  }
};

export const createReservation = async (req: Request, res: Response) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      component_id,
      quantity,
      reference,
      notes,
      expires_at
    } = req.body;
    
    const reserved_by = req.user!.userId;

    // Verificar stock disponible
    const stockResult = await client.query(
      'SELECT current_stock, reserved_stock FROM components WHERE id = $1',
      [component_id]
    );
    
    if (stockResult.rows.length === 0) {
      throw new Error('Componente no encontrado');
    }
    
    const { current_stock, reserved_stock } = stockResult.rows[0];
    const availableStock = parseFloat(current_stock) - parseFloat(reserved_stock);
    
    if (availableStock < parseFloat(quantity)) {
      throw new Error('Stock disponible insuficiente');
    }

    // Crear reserva
    const reservationQuery = `
      INSERT INTO reservations (
        component_id, quantity, reference, notes, reserved_by, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const reservationValues = [
      component_id,
      quantity,
      reference,
      notes,
      reserved_by,
      expires_at
    ];

    const reservationResult = await client.query(reservationQuery, reservationValues);

    // Obtener tipo de movimiento para reserva
    const movementTypeResult = await client.query(
      "SELECT id FROM movement_types WHERE code = 'RESERVATION'",
      []
    );
    
    const movement_type_id = movementTypeResult.rows[0].id;

    // Crear movimiento de reserva
    await client.query(
      `INSERT INTO movements (
        movement_type_id, component_id, quantity, reference_number, notes, user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [movement_type_id, component_id, quantity, reference, notes, reserved_by]
    );

    // Actualizar stock reservado
    await client.query(
      'UPDATE components SET reserved_stock = reserved_stock + $1 WHERE id = $2',
      [quantity, component_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Reserva creada exitosamente',
      reservation: reservationResult.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al crear reserva:', error);
    res.status(400).json({ error: error.message || 'Error al crear reserva' });
  } finally {
    client.release();
  }
};

export const getReservations = async (req: Request, res: Response) => {
  try {
    const { component_id, status = 'active' } = req.query;
    
    let query = `
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
      WHERE r.status = $1
    `;
    
    const values: any[] = [status];
    
    if (component_id) {
      query += ' AND r.component_id = $2';
      values.push(component_id);
    }
    
    query += ' ORDER BY r.reserved_at DESC';
    
    const result = await db.query(query, values);
    res.json({ reservations: result.rows });
  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
};