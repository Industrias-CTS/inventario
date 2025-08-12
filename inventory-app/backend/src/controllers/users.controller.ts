import { Request, Response } from 'express';
import { db } from '../config/database.config';
import { hashPassword } from '../utils/password';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await db.query(
      `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    
    res.json({ users });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await db.get(
      `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE id = ?`,
      [id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, first_name, last_name, role = 'user' } = req.body;
    
    // Validar campos requeridos
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email y password son requeridos' });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await hashPassword(password);
    
    // Crear el usuario
    const userId = generateId();
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO users (
        id, username, email, password, first_name, last_name, role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, username, email, hashedPassword, 
        first_name || null, last_name || null, 
        role, 1, now, now
      ]
    );
    
    // Obtener el usuario creado (sin el password)
    const newUser = await db.get(
      `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE id = ?`,
      [userId]
    );
    
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: newUser
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role, is_active, password } = req.body;
    
    // Verificar si el usuario existe
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Si se cambia username o email, verificar que no existan
    if (username || email) {
      const duplicate = await db.get(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username || '', email || '', id]
      );
      
      if (duplicate) {
        return res.status(400).json({ error: 'El username o email ya está en uso' });
      }
    }
    
    // Construir la consulta de actualización dinámicamente
    const updates: string[] = [];
    const values: any[] = [];
    
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(last_name);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (password) {
      const hashedPassword = await hashPassword(password);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Obtener el usuario actualizado
    const updatedUser = await db.get(
      `SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE id = ?`,
      [id]
    );
    
    res.json({
      message: 'Usuario actualizado exitosamente',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verificar si el usuario existe
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No permitir eliminar el último admin
    const adminCount = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE role = ? AND id != ?',
      ['admin', id]
    );
    
    if (adminCount.count === 0) {
      const userToDelete = await db.get('SELECT role FROM users WHERE id = ?', [id]);
      if (userToDelete.role === 'admin') {
        return res.status(400).json({ error: 'No se puede eliminar el último usuario administrador' });
      }
    }
    
    // Eliminar el usuario
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};