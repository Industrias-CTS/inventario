import { Request, Response } from 'express';
import { db } from '@/config/database';

export const getRecipes = async (req: Request, res: Response) => {
  try {
    const { is_active = true, search } = req.query;
    
    let query = `
      SELECT 
        r.*,
        c.code as output_component_code,
        c.name as output_component_name,
        u.symbol as output_unit_symbol
      FROM recipes r
      LEFT JOIN components c ON r.output_component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE 1=1
    `;
    
    const values: any[] = [];
    let paramCount = 0;

    if (is_active !== undefined) {
      paramCount++;
      query += ` AND r.is_active = $${paramCount}`;
      values.push(is_active);
    }

    if (search) {
      paramCount++;
      query += ` AND (r.name ILIKE $${paramCount} OR r.code ILIKE $${paramCount})`;
      values.push(`%${search}%`);
    }

    query += ' ORDER BY r.name';

    const result = await db.query(query, values);
    res.json({ recipes: result.rows });
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
};

export const getRecipeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const recipeQuery = `
      SELECT 
        r.*,
        c.code as output_component_code,
        c.name as output_component_name,
        u.symbol as output_unit_symbol
      FROM recipes r
      LEFT JOIN components c ON r.output_component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE r.id = $1
    `;
    
    const ingredientsQuery = `
      SELECT 
        ri.*,
        c.code as component_code,
        c.name as component_name,
        u.symbol as unit_symbol
      FROM recipe_ingredients ri
      LEFT JOIN components c ON ri.component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE ri.recipe_id = $1
      ORDER BY c.name
    `;
    
    const [recipeResult, ingredientsResult] = await Promise.all([
      db.query(recipeQuery, [id]),
      db.query(ingredientsQuery, [id])
    ]);
    
    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const recipe = recipeResult.rows[0];
    recipe.ingredients = ingredientsResult.rows;
    
    res.json({ recipe });
  } catch (error) {
    console.error('Error al obtener receta:', error);
    res.status(500).json({ error: 'Error al obtener receta' });
  }
};

export const createRecipe = async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      description,
      output_component_id,
      output_quantity = 1,
      ingredients = []
    } = req.body;

    // Iniciar transacción
    await db.query('BEGIN');

    try {
      // Crear la receta
      const recipeQuery = `
        INSERT INTO recipes (
          code, name, description, output_component_id, output_quantity
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const recipeValues = [
        code,
        name,
        description,
        output_component_id,
        output_quantity
      ];

      const recipeResult = await db.query(recipeQuery, recipeValues);
      const recipe = recipeResult.rows[0];

      // Crear los ingredientes
      if (ingredients.length > 0) {
        const ingredientPromises = ingredients.map((ingredient: any) => {
          const ingredientQuery = `
            INSERT INTO recipe_ingredients (recipe_id, component_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
          return db.query(ingredientQuery, [
            recipe.id,
            ingredient.component_id,
            ingredient.quantity
          ]);
        });

        await Promise.all(ingredientPromises);
      }

      await db.query('COMMIT');

      res.status(201).json({ 
        message: 'Receta creada exitosamente',
        recipe 
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código de la receta ya existe' });
    }
    console.error('Error al crear receta:', error);
    res.status(500).json({ error: 'Error al crear receta' });
  }
};

export const updateRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      output_component_id,
      output_quantity,
      ingredients = []
    } = req.body;

    // Iniciar transacción
    await db.query('BEGIN');

    try {
      // Actualizar la receta
      const recipeQuery = `
        UPDATE recipes
        SET code = $2, name = $3, description = $4, 
            output_component_id = $5, output_quantity = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const recipeResult = await db.query(recipeQuery, [
        id, code, name, description, output_component_id, output_quantity
      ]);

      if (recipeResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Receta no encontrada' });
      }

      // Eliminar ingredientes existentes
      await db.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);

      // Crear los nuevos ingredientes
      if (ingredients.length > 0) {
        const ingredientPromises = ingredients.map((ingredient: any) => {
          const ingredientQuery = `
            INSERT INTO recipe_ingredients (recipe_id, component_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
          return db.query(ingredientQuery, [
            id,
            ingredient.component_id,
            ingredient.quantity
          ]);
        });

        await Promise.all(ingredientPromises);
      }

      await db.query('COMMIT');

      res.json({ 
        message: 'Receta actualizada exitosamente',
        recipe: recipeResult.rows[0] 
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código de la receta ya existe' });
    }
    console.error('Error al actualizar receta:', error);
    res.status(500).json({ error: 'Error al actualizar receta' });
  }
};

export const deleteRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE recipes
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    res.json({ 
      message: 'Receta desactivada exitosamente',
      recipe: result.rows[0] 
    });
  } catch (error) {
    console.error('Error al desactivar receta:', error);
    res.status(500).json({ error: 'Error al desactivar receta' });
  }
};