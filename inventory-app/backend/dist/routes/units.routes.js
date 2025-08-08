"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const database_config_1 = require("../config/database.config");
const router = (0, express_1.Router)();
const generateId = () => Math.random().toString(36).substr(2, 9);
// GET /api/units - Obtener todas las unidades
router.get('/', async (_req, res) => {
    try {
        const units = await database_config_1.db.query('SELECT * FROM units ORDER BY name');
        res.json({ units });
    }
    catch (error) {
        console.error('Error al obtener unidades:', error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
});
// POST /api/units - Crear unidad
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('admin'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('symbol').notEmpty().withMessage('El símbolo es requerido')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { name, symbol } = req.body;
        // Verificar si ya existe
        const existingName = await database_config_1.db.get('SELECT id FROM units WHERE name = ?', [name]);
        if (existingName) {
            return res.status(400).json({ error: 'Ya existe una unidad con ese nombre' });
        }
        const existingSymbol = await database_config_1.db.get('SELECT id FROM units WHERE symbol = ?', [symbol]);
        if (existingSymbol) {
            return res.status(400).json({ error: 'Ya existe una unidad con ese símbolo' });
        }
        const id = generateId();
        const now = new Date().toISOString();
        await database_config_1.db.run('INSERT INTO units (id, name, symbol, created_at) VALUES (?, ?, ?, ?)', [id, name, symbol, now]);
        const newUnit = await database_config_1.db.get('SELECT * FROM units WHERE id = ?', [id]);
        res.status(201).json({
            message: 'Unidad creada exitosamente',
            unit: newUnit
        });
    }
    catch (error) {
        console.error('Error al crear unidad:', error);
        res.status(500).json({ error: 'Error al crear unidad' });
    }
});
// PUT /api/units/:id - Actualizar unidad
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('symbol').notEmpty().withMessage('El símbolo es requerido')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, symbol } = req.body;
        const existing = await database_config_1.db.get('SELECT * FROM units WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Unidad no encontrada' });
        }
        // Verificar nombres/símbolos duplicados
        const duplicateName = await database_config_1.db.get('SELECT id FROM units WHERE name = ? AND id != ?', [name, id]);
        if (duplicateName) {
            return res.status(400).json({ error: 'Ya existe una unidad con ese nombre' });
        }
        const duplicateSymbol = await database_config_1.db.get('SELECT id FROM units WHERE symbol = ? AND id != ?', [symbol, id]);
        if (duplicateSymbol) {
            return res.status(400).json({ error: 'Ya existe una unidad con ese símbolo' });
        }
        await database_config_1.db.run('UPDATE units SET name = ?, symbol = ? WHERE id = ?', [name, symbol, id]);
        const updatedUnit = await database_config_1.db.get('SELECT * FROM units WHERE id = ?', [id]);
        res.json({
            message: 'Unidad actualizada exitosamente',
            unit: updatedUnit
        });
    }
    catch (error) {
        console.error('Error al actualizar unidad:', error);
        res.status(500).json({ error: 'Error al actualizar unidad' });
    }
});
// DELETE /api/units/:id - Eliminar unidad
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await database_config_1.db.get('SELECT * FROM units WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Unidad no encontrada' });
        }
        // Verificar si hay componentes usando esta unidad
        const componentsCount = await database_config_1.db.get('SELECT COUNT(*) as count FROM components WHERE unit_id = ?', [id]);
        if (componentsCount.count > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar la unidad porque hay componentes que la usan'
            });
        }
        await database_config_1.db.run('DELETE FROM units WHERE id = ?', [id]);
        res.json({ message: 'Unidad eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar unidad:', error);
        res.status(500).json({ error: 'Error al eliminar unidad' });
    }
});
exports.default = router;
//# sourceMappingURL=units.routes.js.map