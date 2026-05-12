import { initDatabase as initSQLite, sqliteDb } from './database-sqlite';
import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  query: (sql: string, params?: any[]) => Promise<any[]>;
  get: (sql: string, params?: any[]) => Promise<any>;
  run: (sql: string, params?: any[]) => Promise<any>;
  init: () => Promise<void>;
}

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

class DatabaseManager {
  private db: DatabaseConfig | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;

    if (DB_TYPE === 'sqlite') {
      await initSQLite();
      this.db = {
        type: 'sqlite',
        query: sqliteDb.query,
        get: sqliteDb.get,
        run: sqliteDb.run,
        init: async () => { await initSQLite(); }
      };
    } else {
      throw new Error(`Database type ${DB_TYPE} not supported yet`);
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) await this.initialize();
    return this.db!.query(sql, params);
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) await this.initialize();
    return this.db!.get(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) await this.initialize();
    return this.db!.run(sql, params);
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.db) await this.initialize();

    try {
      await this.run('BEGIN TRANSACTION');
    } catch (beginError) {
      // Si ya hay una transacción activa, hacer ROLLBACK primero
      try { await this.run('ROLLBACK'); } catch (_) {}
      await this.run('BEGIN TRANSACTION');
    }

    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      try { await this.run('ROLLBACK'); } catch (rollbackError) {
        console.error('Error en ROLLBACK:', rollbackError);
      }
      throw error;
    }
  }
}

export const db = new DatabaseManager();