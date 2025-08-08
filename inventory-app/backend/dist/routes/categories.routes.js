"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const database_config_1 = require("../config/database.config");
const router = (0, express_1.Router)();
const generateId = () => Math.random().toString(36).substr(2, 9);
// GET /api/categories - Obtener todas las categorías
router.get('/', async (_req, res) => {
    try {
        const categories = await database_config_1.db.query('SELECT * FROM categories ORDER BY name');
        res.json({ categories });
    }
    catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});
// POST /api/categories - Crear categoría
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('admin'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('description').optional().isString()
], validation_1.validateRequest, async (req, res) => {
    try {
        const { name, description } = req.body;
        // Verificar si ya existe
        const existing = await database_config_1.db.get('SELECT id FROM categories WHERE name = ?', [name]);
        if (existing) {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }
        const id = generateId();
        const now = new Date().toISOString();
        await database_config_1.db.run('INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, name, description || '', now, now]);
        const newCategory = await database_config_1.db.get('SELECT * FROM categories WHERE id = ?', [id]);
        res.status(201).json({
            message: 'Categoría creada exitosamente',
            category: newCategory
        });
    }
    catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});
// PUT /api/categories/:id - Actualizar categoría
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('description').optional().isString()
], validation_1.validateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const existing = await database_config_1.db.get('SELECT * FROM categories WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        // Verificar nombre duplicado
        const duplicate = await database_config_1.db.get('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id]);
        if (duplicate) {
            return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
        }
        const now = new Date().toISOString();
        await database_config_1.db.run('UPDATE categories SET name = ?, description = ?, updated_at = ? WHERE id = ?', [name, description || '', now, id]);
        const updatedCategory = await database_config_1.db.get('SELECT * FROM categories WHERE id = ?', [id]);
        res.json({
            message: 'Categoría actualizada exitosamente',
            category: updatedCategory
        });
    }
    catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
});
// DELETE /api/categories/:id - Eliminar categoría
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await database_config_1.db.get('SELECT * FROM categories WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        // Verificar si hay componentes usando esta categoría
        const componentsCount = await database_config_1.db.get('SELECT COUNT(*) as count FROM components WHERE category_id = ?', [id]);
        if (componentsCount.count > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar la categoría porque hay componentes que la usan'
            });
        }
        await database_config_1.db.run('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ message: 'Categoría eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
});
exports.default = router;
//# sourceMappingURL=categories.routes.js.map