import { Request, Response } from 'express';
import { db } from '../config/database.config';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const getComponents = async (req: Request, res: Response) => {
  try {
    const { category_id, is_active = 'true', search } = req.query;
    
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

    if (category_id) {
      query += ` AND c.category_id = ?`;
      values.push(category_id);
    }

    if (is_active !== undefined) {
      query += ` AND c.is_active = ?`;
      values.push(is_active === 'true' ? 1 : 0);
    }

    if (search) {
      query += ` AND (c.name LIKE ? OR c.code LIKE ?)`;
      values.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY c.name';

    const result = await db.query(query, values);
    res.json({ components: result });
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
      WHERE c.id = ?
    `;
    
    const result = await db.get(query, [id]);
    
    if (!result) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    
    res.json({ component: result });
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
      sale_price = 0
    } = req.body;

    const id = generateId();
    const now = new Date().toISOString();

    // Normalizar el código
    const normalizedCode = code.trim().toLowerCase();
    
    // Verificar con diferentes variaciones
    const checkExisting = await db.get(
      'SELECT id, code, name FROM components WHERE LOWER(TRIM(code)) = LOWER(TRIM(?))',
      [normalizedCode]
    );
    
    if (checkExisting) {
      console.log('Código duplicado en creación:', {
        intentedCode: code,
        existingComponent: checkExisting
      });
      return res.status(400).json({ 
        error: `El código '${code}' ya existe en el componente: ${checkExisting.name} (${checkExisting.code})`,
        existingComponent: {
          id: checkExisting.id,
          code: checkExisting.code,
          name: checkExisting.name
        }
      });
    }

    const query = `
      INSERT INTO components (
        id, code, name, description, category_id, unit_id,
        min_stock, max_stock, location, cost_price, sale_price,
        current_stock, reserved_stock, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)
    `;

    const values = [
      id, code, name, description, category_id, unit_id,
      min_stock, max_stock, location, cost_price, sale_price,
      now, now
    ];

    await db.run(query, values);
    
    const newComponent = await db.get('SELECT * FROM components WHERE id = ?', [id]);
    
    res.status(201).json({ 
      message: 'Componente creado exitosamente',
      component: newComponent 
    });
  } catch (error: any) {
    console.error('Error al crear componente:', error);
    res.status(500).json({ error: 'Error al crear componente' });
  }
};

export const updateComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = await db.get('SELECT * FROM components WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    // Si se está actualizando el código, verificar que no exista en otro componente
    if (updates.code && updates.code !== existing.code) {
      // Normalizar el código (trim y lowercase)
      const normalizedCode = updates.code.trim().toLowerCase();
      
      // Verificar con diferentes variaciones
      const codeExists = await db.get(
        `SELECT id, code, name FROM components 
         WHERE (LOWER(TRIM(code)) = LOWER(TRIM(?)) OR code = ?) 
         AND id != ?`, 
        [normalizedCode, updates.code, id]
      );
      
      if (codeExists) {
        console.log('Código duplicado encontrado:', {
          intentedCode: updates.code,
          existingComponent: codeExists
        });
        return res.status(400).json({ 
          error: `El código '${updates.code}' ya existe en otro componente: ${codeExists.name} (${codeExists.code})`,
          existingComponent: {
            id: codeExists.id,
            code: codeExists.code,
            name: codeExists.name
          }
        });
      }
    }

    delete updates.id;
    delete updates.created_at;
    
    updates.updated_at = new Date().toISOString();

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    const query = `UPDATE components SET ${setClause} WHERE id = ?`;
    values.push(id);

    await db.run(query, values);
    
    const updated = await db.get('SELECT * FROM components WHERE id = ?', [id]);

    res.json({ 
      message: 'Componente actualizado exitosamente',
      component: updated 
    });
  } catch (error: any) {
    console.error('Error al actualizar componente:', error);
    res.status(500).json({ error: 'Error al actualizar componente' });
  }
};

export const deleteComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM components WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    await db.run('UPDATE components SET is_active = 0 WHERE id = ?', [id]);
    
    const updated = await db.get('SELECT * FROM components WHERE id = ?', [id]);

    res.json({ 
      message: 'Componente desactivado exitosamente',
      component: updated 
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
      WHERE c.id = ?
    `;

    const result = await db.get(query, [id]);

    if (!result) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    res.json({ stock: result });
  } catch (error) {
    console.error('Error al obtener stock:', error);
    res.status(500).json({ error: 'Error al obtener stock' });
  }
};

export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const getUnits = async (_req: Request, res: Response) => {
  try {
    const units = await db.query('SELECT * FROM units ORDER BY name');
    res.json({ units });
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error al obtener unidades' });
  }
};

export const checkDuplicateCodes = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    // Buscar todos los componentes con el código especificado
    const query = code 
      ? 'SELECT id, code, name FROM components WHERE code = ?' 
      : 'SELECT code, COUNT(*) as count FROM components GROUP BY code HAVING count > 1';
    
    const result = code 
      ? await db.query(query, [code])
      : await db.query(query);
    
    // También verificar si hay códigos con espacios o caracteres especiales
    const problematicCodes = await db.query(`
      SELECT id, code, name, 
        CASE 
          WHEN code != TRIM(code) THEN 'has_spaces'
          WHEN code != LOWER(code) THEN 'has_uppercase'
          ELSE 'ok'
        END as issue
      FROM components 
      WHERE code != TRIM(code) OR code != LOWER(code)
    `);
    
    res.json({ 
      duplicates: result,
      problematicCodes,
      message: code 
        ? `Componentes con código '${code}'` 
        : 'Análisis de códigos duplicados'
    });
  } catch (error) {
    console.error('Error al verificar códigos duplicados:', error);
    res.status(500).json({ error: 'Error al verificar códigos duplicados' });
  }
};