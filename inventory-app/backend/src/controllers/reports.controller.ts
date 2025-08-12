import { Request, Response } from 'express';
import { db } from '../config/database.config';

export const getMovementsReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, movementType, componentId } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.created_at,
        m.type as movement_type,
        CASE 
          WHEN m.type IN ('entrada', 'ajuste') THEN 'IN'
          WHEN m.type IN ('salida') THEN 'OUT'
          WHEN m.type IN ('reserva') THEN 'RESERVE'
          WHEN m.type IN ('liberacion') THEN 'RELEASE'
          ELSE 'IN'
        END as operation,
        m.quantity,
        m.unit_cost,
        m.total_cost,
        m.reference as reference_number,
        m.notes,
        c.code as component_code,
        c.name as component_name,
        c.description as component_description,
        cat.name as category_name,
        u.symbol as unit_symbol,
        usr.username,
        usr.first_name,
        usr.last_name,
        usr.email
      FROM movements m
      JOIN components c ON m.component_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      LEFT JOIN users usr ON m.user_id = usr.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (startDate) {
      query += ' AND DATE(m.created_at) >= DATE(?)';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(m.created_at) <= DATE(?)';
      params.push(endDate);
    }
    
    if (movementType && movementType !== 'all') {
      query += ' AND m.type = ?';
      params.push(movementType);
    }
    
    if (componentId) {
      query += ' AND m.component_id = ?';
      params.push(componentId);
    }
    
    query += ' ORDER BY m.created_at DESC';
    
    const movements = await db.query(query, params);
    
    // Calcular estadísticas
    const stats = {
      totalMovements: movements.length,
      totalIn: 0,
      totalOut: 0,
      totalReserved: 0,
      totalReleased: 0,
      totalCost: 0,
      totalValue: 0
    };
    
    movements.forEach((m: any) => {
      if (m.operation === 'IN') {
        stats.totalIn += m.quantity;
        stats.totalCost += m.total_cost || 0;
      } else if (m.operation === 'OUT') {
        stats.totalOut += m.quantity;
        stats.totalValue += m.total_cost || 0;
      } else if (m.operation === 'RESERVE') {
        stats.totalReserved += m.quantity;
      } else if (m.operation === 'RELEASE') {
        stats.totalReleased += m.quantity;
      }
    });
    
    res.json({
      success: true,
      data: {
        movements,
        stats,
        filters: {
          startDate,
          endDate,
          movementType,
          componentId
        }
      }
    });
  } catch (error) {
    console.error('Error al generar reporte de movimientos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar reporte de movimientos' 
    });
  }
};

export const getInventoryReport = async (_req: Request, res: Response) => {
  try {
    const inventory = await db.query(`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.description,
        c.current_stock,
        c.reserved_stock,
        (c.current_stock - c.reserved_stock) as available_stock,
        c.min_stock,
        c.max_stock,
        c.cost_price,
        c.sale_price,
        (c.current_stock * c.cost_price) as total_value,
        cat.name as category_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      ORDER BY c.name
    `);
    
    // Calcular estadísticas
    const stats = {
      totalComponents: inventory.length,
      totalValue: 0,
      lowStockCount: 0,
      overStockCount: 0,
      optimalStockCount: 0
    };
    
    inventory.forEach((item: any) => {
      stats.totalValue += item.total_value || 0;
      
      if (item.current_stock <= item.min_stock) {
        stats.lowStockCount++;
      } else if (item.current_stock >= item.max_stock) {
        stats.overStockCount++;
      } else {
        stats.optimalStockCount++;
      }
    });
    
    res.json({
      success: true,
      data: {
        inventory,
        stats
      }
    });
  } catch (error) {
    console.error('Error al generar reporte de inventario:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar reporte de inventario' 
    });
  }
};

export const getComponentReport = async (req: Request, res: Response) => {
  try {
    const { componentId, startDate, endDate } = req.query;
    
    if (!componentId) {
      return res.status(400).json({ 
        success: false,
        error: 'ID del componente es requerido' 
      });
    }
    
    // Obtener información del componente
    const component = await db.get(`
      SELECT 
        c.*,
        cat.name as category_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.id = ?
    `, [componentId]);
    
    if (!component) {
      return res.status(404).json({ 
        success: false,
        error: 'Componente no encontrado' 
      });
    }
    
    // Obtener movimientos del componente
    let movementsQuery = `
      SELECT 
        m.*,
        CASE 
          WHEN m.type IN ('entrada', 'ajuste') THEN 'IN'
          WHEN m.type IN ('salida') THEN 'OUT'
          WHEN m.type IN ('reserva') THEN 'RESERVE'
          WHEN m.type IN ('liberacion') THEN 'RELEASE'
          ELSE 'IN'
        END as operation,
        usr.username,
        usr.first_name,
        usr.last_name
      FROM movements m
      LEFT JOIN users usr ON m.user_id = usr.id
      WHERE m.component_id = ?
    `;
    
    const params: any[] = [componentId];
    
    if (startDate) {
      movementsQuery += ' AND DATE(m.created_at) >= DATE(?)';
      params.push(startDate);
    }
    
    if (endDate) {
      movementsQuery += ' AND DATE(m.created_at) <= DATE(?)';
      params.push(endDate);
    }
    
    movementsQuery += ' ORDER BY m.created_at DESC';
    
    const movements = await db.query(movementsQuery, params);
    
    // Calcular estadísticas del componente
    const stats = {
      totalMovements: movements.length,
      totalIn: 0,
      totalOut: 0,
      totalReserved: 0,
      totalReleased: 0,
      netChange: 0,
      averageCost: 0,
      totalCostIn: 0,
      totalValueOut: 0
    };
    
    let totalCostSum = 0;
    let totalInQuantity = 0;
    
    movements.forEach((m: any) => {
      if (m.operation === 'IN') {
        stats.totalIn += m.quantity;
        stats.totalCostIn += m.total_cost || 0;
        totalCostSum += m.total_cost || 0;
        totalInQuantity += m.quantity;
      } else if (m.operation === 'OUT') {
        stats.totalOut += m.quantity;
        stats.totalValueOut += m.total_cost || 0;
      } else if (m.operation === 'RESERVE') {
        stats.totalReserved += m.quantity;
      } else if (m.operation === 'RELEASE') {
        stats.totalReleased += m.quantity;
      }
    });
    
    stats.netChange = stats.totalIn - stats.totalOut;
    stats.averageCost = totalInQuantity > 0 ? totalCostSum / totalInQuantity : 0;
    
    res.json({
      success: true,
      data: {
        component,
        movements,
        stats
      }
    });
  } catch (error) {
    console.error('Error al generar reporte del componente:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al generar reporte del componente' 
    });
  }
};