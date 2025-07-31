import { Request, Response } from 'express';
import { db } from '@/config/database';

export const getComponents = async (req: Request, res: Response) => {
  try {
    const { category_id, is_active = true, search } = req.query;
    
    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE 1=1
    `;
    
    const values: any[] = [];
    let paramCount = 0;

    if (category_id) {
      paramCount++;
      query += ` AND c.category_id = $${paramCount}`;
      values.push(category_id);
    }

    if (is_active !== undefined) {
      paramCount++;
      query += ` AND c.is_active = $${paramCount}`;
      values.push(is_active);
    }

    if (search) {
      paramCount++;
      query += ` AND (c.name ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    query += ' ORDER BY c.name';

    const result = await db.query(query, values);
    res.json({ components: result.rows });
  } catch (error) {
    console.error('Error al obtener componentes:', error);
    res.status(500).json({ error: 'Error al obtener componentes' });
  }
};

export const getComponentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    
    res.json({ component: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener componente:', error);
    res.status(500).json({ error: 'Error al obtener componente' });
  }
};

export const createComponent = async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      description,
      category_id,
      unit_id,
      min_stock = 0,
      max_stock,
      location,
      cost_price = 0,
    } = req.body;

    const query = `
      INSERT INTO components (
        code, name, description, category_id, unit_id,
        min_stock, max_stock, location, cost_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      code,
      name,
      description,
      category_id,
      unit_id,
      min_stock,
      max_stock,
      location,
      cost_price,
    ];

    const result = await db.query(query, values);
    res.status(201).json({ 
      message: 'Componente creado exitosamente',
      component: result.rows[0] 
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código del componente ya existe' });
    }
    console.error('Error al crear componente:', error);
    res.status(500).json({ error: 'Error al crear componente' });
  }
};

export const updateComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE components
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    res.json({ 
      message: 'Componente actualizado exitosamente',
      component: result.rows[0] 
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código del componente ya existe' });
    }
    console.error('Error al actualizar componente:', error);
    res.status(500).json({ error: 'Error al actualizar componente' });
  }
};

export const deleteComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE components
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    res.json({ 
      message: 'Componente desactivado exitosamente',
      component: result.rows[0] 
    });
  } catch (error) {
    console.error('Error al desactivar componente:', error);
    res.status(500).json({ error: 'Error al desactivar componente' });
  }
};

export const getComponentStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.current_stock,
        c.reserved_stock,
        (c.current_stock - c.reserved_stock) as available_stock,
        c.min_stock,
        c.max_stock,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    res.json({ stock: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener stock:', error);
    res.status(500).json({ error: 'Error al obtener stock' });
  }
};