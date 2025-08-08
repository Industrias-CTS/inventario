import { Request, Response } from 'express';
import { db } from '../config/database.config';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, first_name, last_name, role = 'user' } = req.body;

    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const hashedPassword = await hashPassword(password);
    const userId = generateId();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO users (
        id, username, email, password, first_name, last_name, 
        role, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `;

    await db.run(query, [
      userId, username, email, hashedPassword, 
      first_name, last_name, role, now, now
    ]);

    const user = await db.get(
      'SELECT id, username, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken({
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
  } catch (error: any) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await db.get(
      `SELECT id, username, email, password, first_name, last_name, role, is_active
       FROM users
       WHERE username = ? OR email = ?`,
      [username, username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken({
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
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await db.get(
      `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { first_name, last_name, email } = req.body;

    const existingEmail = await db.get(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );

    if (existingEmail) {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    const now = new Date().toISOString();

    await db.run(
      `UPDATE users 
       SET first_name = ?, last_name = ?, email = ?, updated_at = ?
       WHERE id = ?`,
      [first_name, last_name, email, now, userId]
    );

    const user = await db.get(
      'SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Perfil actualizado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await db.get(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await hashPassword(newPassword);
    const now = new Date().toISOString();

    await db.run(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, now, userId]
    );

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};