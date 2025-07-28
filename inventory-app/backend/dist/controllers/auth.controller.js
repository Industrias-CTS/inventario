"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.login = exports.register = void 0;
const database_1 = require("@/config/database");
const password_1 = require("@/utils/password");
const jwt_1 = require("@/utils/jwt");
const register = async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'user' } = req.body;
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const query = `
      INSERT INTO users (username, email, password, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, first_name, last_name, role, is_active, created_at
    `;
        const values = [username, email, hashedPassword, first_name, last_name, role];
        const result = await database_1.db.query(query, values);
        const user = result.rows[0];
        const token = (0, jwt_1.generateToken)({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user,
            token,
        });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const query = `
      SELECT id, username, email, password, first_name, last_name, role, is_active
      FROM users
      WHERE username = $1 OR email = $1
    `;
        const result = await database_1.db.query(query, [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(401).json({ error: 'Usuario inactivo' });
        }
        const isValidPassword = await (0, password_1.comparePassword)(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = (0, jwt_1.generateToken)({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });
        delete user.password;
        res.json({
            message: 'Inicio de sesión exitoso',
            user,
            token,
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const query = `
      SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
        const result = await database_1.db.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ user: result.rows[0] });
    }
    catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
};
exports.getProfile = getProfile;
//# sourceMappingURL=auth.controller.js.map