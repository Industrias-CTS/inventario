"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnits = exports.getCategories = exports.getComponentStock = exports.deleteComponent = exports.updateComponent = exports.createComponent = exports.getComponentById = exports.getComponents = void 0;
const database_config_1 = require("../config/database.config");
const generateId = () => Math.random().toString(36).substr(2, 9);
const getComponents = async (req, res) => {
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
        const values = [];
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
        const result = await database_config_1.db.query(query, values);
        res.json({ components: result });
    }
    catch (error) {
        console.error('Error al obtener componentes:', error);
        res.status(500).json({ error: 'Error al obtener componentes' });
    }
};
exports.getComponents = getComponents;
const getComponentById = async (req, res) => {
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
        const result = await database_config_1.db.get(query, [id]);
        if (!result) {
            return res.status(404).json({ error: 'Componente no encontrado' });
        }
        res.json({ component: result });
    }
    catch (error) {
        console.error('Error al obtener componente:', error);
        res.status(500).json({ error: 'Error al obtener componente' });
    }
};
exports.getComponentById = getComponentById;
const createComponent = async (req, res) => {
    try {
        const { code, name, description, category_id, unit_id, min_stock = 0, max_stock, location, cost_price = 0, sale_price = 0 } = req.body;
        const id = generateId();
        const now = new Date().toISOString();
        const checkExisting = await database_config_1.db.get('SELECT id FROM components WHERE code = ?', [code]);
        if (checkExisting) {
            return res.status(400).json({ error: 'El código del componente ya existe' });
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
        await database_config_1.db.run(query, values);
        const newComponent = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [id]);
        res.status(201).json({
            message: 'Componente creado exitosamente',
            component: newComponent
        });
    }
    catch (error) {
        console.error('Error al crear componente:', error);
        res.status(500).json({ error: 'Error al crear componente' });
    }
};
exports.createComponent = createComponent;
const updateComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const existing = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Componente no encontrado' });
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
        await database_config_1.db.run(query, values);
        const updated = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [id]);
        res.json({
            message: 'Componente actualizado exitosamente',
            component: updated
        });
    }
    catch (error) {
        console.error('Error al actualizar componente:', error);
        res.status(500).json({ error: 'Error al actualizar componente' });
    }
};
exports.updateComponent = updateComponent;
const deleteComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Componente no encontrado' });
        }
        await database_config_1.db.run('UPDATE components SET is_active = 0 WHERE id = ?', [id]);
        const updated = await database_config_1.db.get('SELECT * FROM components WHERE id = ?', [id]);
        res.json({
            message: 'Componente desactivado exitosamente',
            component: updated
        });
    }
    catch (error) {
        console.error('Error al desactivar componente:', error);
        res.status(500).json({ error: 'Error al desactivar componente' });
    }
};
exports.deleteComponent = deleteComponent;
const getComponentStock = async (req, res) => {
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
        const result = await database_config_1.db.get(query, [id]);
        if (!result) {
            return res.status(404).json({ error: 'Componente no encontrado' });
        }
        res.json({ stock: result });
    }
    catch (error) {
        console.error('Error al obtener stock:', error);
        res.status(500).json({ error: 'Error al obtener stock' });
    }
};
exports.getComponentStock = getComponentStock;
const getCategories = async (_req, res) => {
    try {
        const categories = await database_config_1.db.query('SELECT * FROM categories ORDER BY name');
        res.json({ categories });
    }
    catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};
exports.getCategories = getCategories;
const getUnits = async (_req, res) => {
    try {
        const units = await database_config_1.db.query('SELECT * FROM units ORDER BY name');
        res.json({ units });
    }
    catch (error) {
        console.error('Error al obtener unidades:', error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
};
exports.getUnits = getUnits;
//# sourceMappingURL=components.controller.optimized.js.map