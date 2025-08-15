import { Request, Response } from 'express';
import { db } from '../config/database.config';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const getProjections = async (_req: Request, res: Response) => {
  try {
    const projections = await db.query(
      `SELECT p.*, 
              u.username, 
              u.first_name, 
              u.last_name,
              u.email
       FROM projections p
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC`
    );
    
    res.json({ projections });
  } catch (error) {
    console.error('Error al obtener proyecciones:', error);
    res.status(500).json({ error: 'Error al obtener proyecciones' });
  }
};

export const getProjectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const projection = await db.get(
      `SELECT p.*, 
              u.username, 
              u.first_name, 
              u.last_name,
              u.email
       FROM projections p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (!projection) {
      return res.status(404).json({ error: 'Proyección no encontrada' });
    }
    
    // Obtener recetas asociadas
    const recipes = await db.query(
      `SELECT pr.*, r.name as recipe_name, r.code as recipe_code 
       FROM projection_recipes pr
       JOIN recipes r ON pr.recipe_id = r.id
       WHERE pr.projection_id = ?`,
      [id]
    );
    
    // Obtener requerimientos
    const requirements = await db.query(
      `SELECT preq.*, c.name as component_name, c.code as component_code, u.symbol as unit_symbol
       FROM projection_requirements preq
       JOIN components c ON preq.component_id = c.id
       LEFT JOIN units u ON c.unit_id = u.id
       WHERE preq.projection_id = ?`,
      [id]
    );
    
    res.json({
      projection: {
        ...projection,
        recipes,
        requirements
      }
    });
  } catch (error) {
    console.error('Error al obtener proyección:', error);
    res.status(500).json({ error: 'Error al obtener proyección' });
  }
};

export const createProjection = async (req: Request, res: Response) => {
  try {
    const { name, description, recipes, requirements } = req.body;
    const userId = req.user?.userId;
    
    if (!name || !recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return res.status(400).json({ error: 'Nombre y recetas son requeridos' });
    }
    
    await db.transaction(async () => {
      const projectionId = generateId();
      const now = new Date().toISOString();
      
      // Crear la proyección
      await db.run(
        `INSERT INTO projections (
          id, name, description, user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [projectionId, name, description || '', userId, now, now]
      );
      
      // Insertar recetas
      for (const recipe of recipes) {
        await db.run(
          `INSERT INTO projection_recipes (
            projection_id, recipe_id, quantity
          ) VALUES (?, ?, ?)`,
          [projectionId, recipe.recipe_id, recipe.quantity]
        );
      }
      
      // Insertar requerimientos si existen
      if (requirements && Array.isArray(requirements)) {
        for (const req of requirements) {
          // Calcular shortage correctamente
          const requiredQty = req.required_quantity || 0;
          const availableQty = req.available_quantity || 0;
          const shortage = Math.max(0, requiredQty - availableQty);
          
          await db.run(
            `INSERT INTO projection_requirements (
              projection_id, component_id, required_quantity, 
              available_quantity, shortage
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              projectionId, 
              req.component_id, 
              requiredQty,
              availableQty,
              shortage
            ]
          );
        }
      }
      
      // Obtener la proyección creada con todas sus relaciones
      const newProjection = await db.get(
        'SELECT * FROM projections WHERE id = ?',
        [projectionId]
      );
      
      const projectionRecipes = await db.query(
        `SELECT pr.*, r.name as recipe_name, r.code as recipe_code 
         FROM projection_recipes pr
         JOIN recipes r ON pr.recipe_id = r.id
         WHERE pr.projection_id = ?`,
        [projectionId]
      );
      
      const projectionRequirements = await db.query(
        `SELECT preq.*, c.name as component_name, c.code as component_code, u.symbol as unit_symbol
         FROM projection_requirements preq
         JOIN components c ON preq.component_id = c.id
         LEFT JOIN units u ON c.unit_id = u.id
         WHERE preq.projection_id = ?`,
        [projectionId]
      );
      
      res.status(201).json({
        message: 'Proyección creada exitosamente',
        projection: {
          ...newProjection,
          recipes: projectionRecipes,
          requirements: projectionRequirements
        }
      });
    });
  } catch (error) {
    console.error('Error al crear proyección:', error);
    res.status(500).json({ error: 'Error al crear proyección' });
  }
};

export const updateProjection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, recipes, requirements } = req.body;
    
    // Verificar que la proyección existe
    const existingProjection = await db.get(
      'SELECT * FROM projections WHERE id = ?',
      [id]
    );
    
    if (!existingProjection) {
      return res.status(404).json({ error: 'Proyección no encontrada' });
    }
    
    await db.transaction(async () => {
      const now = new Date().toISOString();
      
      // Actualizar proyección
      await db.run(
        `UPDATE projections 
         SET name = ?, description = ?, updated_at = ?
         WHERE id = ?`,
        [name, description || '', now, id]
      );
      
      // Eliminar recetas existentes y agregar nuevas
      if (recipes && Array.isArray(recipes)) {
        await db.run('DELETE FROM projection_recipes WHERE projection_id = ?', [id]);
        
        for (const recipe of recipes) {
          await db.run(
            `INSERT INTO projection_recipes (
              projection_id, recipe_id, quantity
            ) VALUES (?, ?, ?)`,
            [id, recipe.recipe_id, recipe.quantity]
          );
        }
      }
      
      // Eliminar requerimientos existentes y agregar nuevos
      if (requirements && Array.isArray(requirements)) {
        await db.run('DELETE FROM projection_requirements WHERE projection_id = ?', [id]);
        
        for (const req of requirements) {
          // Calcular shortage correctamente
          const requiredQty = req.required_quantity || 0;
          const availableQty = req.available_quantity || 0;
          const shortage = Math.max(0, requiredQty - availableQty);
          
          await db.run(
            `INSERT INTO projection_requirements (
              projection_id, component_id, required_quantity, 
              available_quantity, shortage
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              id, 
              req.component_id, 
              requiredQty,
              availableQty,
              shortage
            ]
          );
        }
      }
      
      res.json({ message: 'Proyección actualizada exitosamente' });
    });
  } catch (error) {
    console.error('Error al actualizar proyección:', error);
    res.status(500).json({ error: 'Error al actualizar proyección' });
  }
};

export const deleteProjection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verificar que la proyección existe
    const existingProjection = await db.get(
      'SELECT * FROM projections WHERE id = ?',
      [id]
    );
    
    if (!existingProjection) {
      return res.status(404).json({ error: 'Proyección no encontrada' });
    }
    
    await db.transaction(async () => {
      // Eliminar relaciones primero
      await db.run('DELETE FROM projection_requirements WHERE projection_id = ?', [id]);
      await db.run('DELETE FROM projection_recipes WHERE projection_id = ?', [id]);
      
      // Eliminar la proyección
      await db.run('DELETE FROM projections WHERE id = ?', [id]);
      
      res.json({ message: 'Proyección eliminada exitosamente' });
    });
  } catch (error) {
    console.error('Error al eliminar proyección:', error);
    res.status(500).json({ error: 'Error al eliminar proyección' });
  }
};