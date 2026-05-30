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
  private txQueue: Promise<unknown> = Promise.resolve();
  private txCounter = 0;

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

    const sp = `sp_${++this.txCounter}`;

    const run = async (): Promise<T> => {
      await this.run(`SAVEPOINT ${sp}`);
      try {
        const result = await callback();
        await this.run(`RELEASE SAVEPOINT ${sp}`);
        return result;
      } catch (error) {
        try { await this.run(`ROLLBACK TO SAVEPOINT ${sp}`); } catch (_) {}
        try { await this.run(`RELEASE SAVEPOINT ${sp}`); } catch (_) {}
        throw error;
      }
    };

    const next = this.txQueue.then(run, run);
    this.txQueue = next.catch(() => {});
    return next;
  }
}

export const db = new DatabaseManager();