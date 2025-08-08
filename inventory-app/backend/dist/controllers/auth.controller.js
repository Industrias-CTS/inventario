"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfile = exports.getProfile = exports.login = exports.register = void 0;
const database_config_1 = require("../config/database.config");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const generateId = () => Math.random().toString(36).substr(2, 9);
const register = async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'user' } = req.body;
        const existingUser = await database_config_1.db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const userId = generateId();
        const now = new Date().toISOString();
        const query = `
      INSERT INTO users (
        id, username, email, password, first_name, last_name, 
        role, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `;
        await database_config_1.db.run(query, [
            userId, username, email, hashedPassword,
            first_name, last_name, role, now, now
        ]);
        const user = await database_config_1.db.get('SELECT id, username, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?', [userId]);
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
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await database_config_1.db.get(`SELECT id, username, email, password, first_name, last_name, role, is_active
       FROM users
       WHERE username = ? OR email = ?`, [username, username]);
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
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
        const user = await database_config_1.db.get(`SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
       FROM users
       WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { first_name, last_name, email } = req.body;
        const existingEmail = await database_config_1.db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (existingEmail) {
            return res.status(400).json({ error: 'El email ya está en uso' });
        }
        const now = new Date().toISOString();
        await database_config_1.db.run(`UPDATE users 
       SET first_name = ?, last_name = ?, email = ?, updated_at = ?
       WHERE id = ?`, [first_name, last_name, email, now, userId]);
        const user = await database_config_1.db.get('SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = ?', [userId]);
        res.json({
            message: 'Perfil actualizado exitosamente',
            user
        });
    }
    catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        const user = await database_config_1.db.get('SELECT password FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const isValidPassword = await (0, password_1.comparePassword)(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }
        const hashedPassword = await (0, password_1.hashPassword)(newPassword);
        const now = new Date().toISOString();
        await database_config_1.db.run('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, now, userId]);
        res.json({ message: 'Contraseña actualizada exitosamente' });
    }
    catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
};
exports.changePassword = changePassword;
//# sourceMappingURL=auth.controller.js.map