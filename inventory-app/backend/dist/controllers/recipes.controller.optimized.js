"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRecipe = exports.deleteRecipe = exports.updateRecipe = exports.createRecipe = exports.getRecipeById = exports.getRecipes = void 0;
const database_config_1 = require("../config/database.config");
const generateId = () => Math.random().toString(36).substr(2, 9);
const getRecipes = async (req, res) => {
    try {
        const { is_active = 'true', search } = req.query;
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
        if (is_active !== undefined) {
            query += ` AND r.is_active = ?`;
            values.push(is_active === 'true' ? 1 : 0);
        }
        if (search) {
            query += ` AND (r.name LIKE ? OR r.code LIKE ?)`;
            values.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY r.name';
        const recipes = await database_config_1.db.query(query, values);
        res.json({ recipes });
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
      WHERE r.id = ?
    `;
        const recipe = await database_config_1.db.get(recipeQuery, [id]);
        if (!recipe) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        const ingredientsQuery = `
      SELECT 
        ri.*,
        c.code as component_code,
        c.name as component_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM recipe_ingredients ri
      JOIN components c ON ri.component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE ri.recipe_id = ?
      ORDER BY c.name
    `;
        const ingredients = await database_config_1.db.query(ingredientsQuery, [id]);
        recipe.ingredients = ingredients;
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
        const { code, name, description, output_component_id, output_quantity, production_time, ingredients = [] } = req.body;
        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'Una receta debe tener al menos un ingrediente' });
        }
        const existingRecipe = await database_config_1.db.get('SELECT id FROM recipes WHERE code = ?', [code]);
        if (existingRecipe) {
            return res.status(400).json({ error: 'El código de receta ya existe' });
        }
        await database_config_1.db.transaction(async () => {
            const recipeId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO recipes (
          id, code, name, description, output_component_id, 
          output_quantity, production_time, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [recipeId, code, name, description, output_component_id, output_quantity, production_time, now, now]);
            for (const ingredient of ingredients) {
                const ingredientId = generateId();
                await database_config_1.db.run(`INSERT INTO recipe_ingredients (
            id, recipe_id, component_id, quantity, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`, [ingredientId, recipeId, ingredient.component_id, ingredient.quantity, ingredient.notes || '', now]);
            }
            const newRecipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ?', [recipeId]);
            res.status(201).json({
                message: 'Receta creada exitosamente',
                recipe: newRecipe
            });
        });
    }
    catch (error) {
        console.error('Error al crear receta:', error);
        res.status(500).json({ error: 'Error al crear receta' });
    }
};
exports.createRecipe = createRecipe;
const updateRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, description, output_component_id, output_quantity, production_time, ingredients = [] } = req.body;
        const existingRecipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ?', [id]);
        if (!existingRecipe) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        if (code !== existingRecipe.code) {
            const codeExists = await database_config_1.db.get('SELECT id FROM recipes WHERE code = ? AND id != ?', [code, id]);
            if (codeExists) {
                return res.status(400).json({ error: 'El código de receta ya existe' });
            }
        }
        await database_config_1.db.transaction(async () => {
            const now = new Date().toISOString();
            await database_config_1.db.run(`UPDATE recipes SET 
          code = ?, name = ?, description = ?, output_component_id = ?,
          output_quantity = ?, production_time = ?, updated_at = ?
        WHERE id = ?`, [code, name, description, output_component_id, output_quantity, production_time, now, id]);
            await database_config_1.db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
            for (const ingredient of ingredients) {
                const ingredientId = generateId();
                await database_config_1.db.run(`INSERT INTO recipe_ingredients (
            id, recipe_id, component_id, quantity, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`, [ingredientId, id, ingredient.component_id, ingredient.quantity, ingredient.notes || '', now]);
            }
            const updatedRecipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ?', [id]);
            res.json({
                message: 'Receta actualizada exitosamente',
                recipe: updatedRecipe
            });
        });
    }
    catch (error) {
        console.error('Error al actualizar receta:', error);
        res.status(500).json({ error: 'Error al actualizar receta' });
    }
};
exports.updateRecipe = updateRecipe;
const deleteRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const existingRecipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ?', [id]);
        if (!existingRecipe) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        await database_config_1.db.run('UPDATE recipes SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
        const updatedRecipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ?', [id]);
        res.json({
            message: 'Receta desactivada exitosamente',
            recipe: updatedRecipe
        });
    }
    catch (error) {
        console.error('Error al desactivar receta:', error);
        res.status(500).json({ error: 'Error al desactivar receta' });
    }
};
exports.deleteRecipe = deleteRecipe;
const executeRecipe = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity = 1, reference_number, notes } = req.body;
        const userId = req.user?.userId;
        const recipe = await database_config_1.db.get('SELECT * FROM recipes WHERE id = ? AND is_active = 1', [id]);
        if (!recipe) {
            return res.status(404).json({ error: 'Receta no encontrada' });
        }
        const ingredients = await database_config_1.db.query('SELECT * FROM recipe_ingredients WHERE recipe_id = ?', [id]);
        await database_config_1.db.transaction(async () => {
            for (const ingredient of ingredients) {
                const component = await database_config_1.db.get('SELECT current_stock FROM components WHERE id = ?', [ingredient.component_id]);
                const requiredQuantity = ingredient.quantity * quantity;
                if (component.current_stock < requiredQuantity) {
                    throw new Error(`Stock insuficiente para el componente ${ingredient.component_id}`);
                }
            }
            const productionMovementTypeId = 'prod001';
            const consumptionMovementTypeId = 'cons001';
            for (const ingredient of ingredients) {
                const requiredQuantity = ingredient.quantity * quantity;
                const movementId = generateId();
                const now = new Date().toISOString();
                await database_config_1.db.run(`INSERT INTO movements (
            id, movement_type_id, component_id, quantity,
            reference_number, notes, user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    movementId, consumptionMovementTypeId, ingredient.component_id,
                    requiredQuantity, reference_number || `RECIPE-${id}`,
                    notes || `Consumo para receta ${recipe.name}`, userId, now
                ]);
                await database_config_1.db.run('UPDATE components SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?', [requiredQuantity, now, ingredient.component_id]);
            }
            const outputQuantity = recipe.output_quantity * quantity;
            const outputMovementId = generateId();
            const now = new Date().toISOString();
            await database_config_1.db.run(`INSERT INTO movements (
          id, movement_type_id, component_id, quantity,
          reference_number, notes, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                outputMovementId, productionMovementTypeId, recipe.output_component_id,
                outputQuantity, reference_number || `RECIPE-${id}`,
                notes || `Producción de receta ${recipe.name}`, userId, now
            ]);
            await database_config_1.db.run('UPDATE components SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?', [outputQuantity, now, recipe.output_component_id]);
            res.json({
                message: 'Receta ejecutada exitosamente',
                produced_quantity: outputQuantity,
                consumed_ingredients: ingredients.map(ing => ({
                    component_id: ing.component_id,
                    quantity: ing.quantity * quantity
                }))
            });
        });
    }
    catch (error) {
        console.error('Error al ejecutar receta:', error);
        res.status(400).json({ error: error.message || 'Error al ejecutar receta' });
    }
};
exports.executeRecipe = executeRecipe;
//# sourceMappingURL=recipes.controller.optimized.js.map