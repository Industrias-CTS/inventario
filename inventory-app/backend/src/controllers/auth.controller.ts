import { Request, Response } from 'express';
import { db } from '@/config/database';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateToken } from '@/utils/jwt';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, first_name, last_name, role = 'user' } = req.body;

    const hashedPassword = await hashPassword(password);

    const query = `
      INSERT INTO users (username, email, password, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, first_name, last_name, role, is_active, created_at
    `;

    const values = [username, email, hashedPassword, first_name, last_name, role];
    const result = await db.query(query, values);
    const user = result.rows[0];

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
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const query = `
      SELECT id, username, email, password, first_name, last_name, role, is_active
      FROM users
      WHERE username = $1 OR email = $1
    `;

    const result = await db.query(query, [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

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

    const query = `
      SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};