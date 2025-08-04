"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRecipe = exports.updateRecipe = exports.createRecipe = exports.getRecipeById = exports.getRecipes = void 0;
const database_1 = require("../config/database");
const getRecipes = async (req, res) => {
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
        const values = [];
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
        const result = await database_1.db.query(query, values);
        res.json({ recipes: result.rows });
    }
    catch (error) {
        console.error('Error al obtener recetas:', error);
        res.status(500).json({ error: 'Error al obtener recetas' });
    }
};
exports.getRecipes = getRecipes;
const getRecipeById = async (req, res) => {
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
            database_1.db.query(recipeQuery, [id]),
            database_1.db.query(ingredientsQuery, [id])
        ]);
        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        const recipe = recipeResult.rows[0];
        recipe.ingredients = ingredientsResult.rows;
        res.json({ recipe });
    }
    catch (error) {
        console.error('Error al obtener receta:', error);
        res.status(500).json({ error: 'Error al obtener receta' });
    }
};
exports.getRecipeById = getRecipeById;
const createRecipe = async (req, res) => {
    try {
        const { code, name, description, output_component_id, output_quantity = 1, ingredients = [] } = req.body;
        // Iniciar transacción
        await database_1.db.query('BEGIN');
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
            const recipeResult = await database_1.db.query(recipeQuery, recipeValues);
            const recipe = recipeResult.rows[0];
            // Crear los ingredientes
            if (ingredients.length > 0) {
                const ingredientPromises = ingredients.map((ingredient) => {
                    const ingredientQuery = `
            INSERT INTO recipe_ingredients (recipe_id, component_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
                    return database_1.db.query(ingredientQuery, [
                        recipe.id,
                        ingredient.component_id,
                        ingredient.quantity
                    ]);
                });
                await Promise.all(ingredientPromises);
            }
            await database_1.db.query('COMMIT');
            res.status(201).json({
                message: 'Receta creada exitosamente',
                recipe
            });
        }
        catch (error) {
            await database_1.db.query('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El código de la receta ya existe' });
        }
        console.error('Error al crear receta:', error);
        res.status(500).json({ error: 'Error al crear receta' });
    }
};
exports.createRecipe = createRecipe;
const updateRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, description, output_component_id, output_quantity, ingredients = [] } = req.body;
        // Iniciar transacción
        await database_1.db.query('BEGIN');
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
            const recipeResult = await database_1.db.query(recipeQuery, [
                id, code, name, description, output_component_id, output_quantity
            ]);
            if (recipeResult.rows.length === 0) {
                await database_1.db.query('ROLLBACK');
                return res.status(404).json({ error: 'Receta no encontrada' });
            }
            // Eliminar ingredientes existentes
            await database_1.db.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
            // Crear los nuevos ingredientes
            if (ingredients.length > 0) {
                const ingredientPromises = ingredients.map((ingredient) => {
                    const ingredientQuery = `
            INSERT INTO recipe_ingredients (recipe_id, component_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
                    return database_1.db.query(ingredientQuery, [
                        id,
                        ingredient.component_id,
                        ingredient.quantity
                    ]);
                });
                await Promise.all(ingredientPromises);
            }
            await database_1.db.query('COMMIT');
            res.json({
                message: 'Receta actualizada exitosamente',
                recipe: recipeResult.rows[0]
            });
        }
        catch (error) {
            await database_1.db.query('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El código de la receta ya existe' });
        }
        console.error('Error al actualizar receta:', error);
        res.status(500).json({ error: 'Error al actualizar receta' });
    }
};
exports.updateRecipe = updateRecipe;
const deleteRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      UPDATE recipes
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.db.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        res.json({
            message: 'Receta desactivada exitosamente',
            recipe: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error al desactivar receta:', error);
        res.status(500).json({ error: 'Error al desactivar receta' });
    }
};
exports.deleteRecipe = deleteRecipe;
//# sourceMappingURL=recipes.controller.js.map