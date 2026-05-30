"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const database_sqlite_1 = require("./database-sqlite");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DB_TYPE = process.env.DB_TYPE || 'sqlite';
class DatabaseManager {
    constructor() {
        this.db = null;
        this.txQueue = Promise.resolve();
        this.txCounter = 0;
    }
    async initialize() {
        if (this.db)
            return;
        if (DB_TYPE === 'sqlite') {
            await (0, database_sqlite_1.initDatabase)();
            this.db = {
                type: 'sqlite',
                query: database_sqlite_1.sqliteDb.query,
                get: database_sqlite_1.sqliteDb.get,
                run: database_sqlite_1.sqliteDb.run,
                init: async () => { await (0, database_sqlite_1.initDatabase)(); }
            };
        }
        else {
            throw new Error(`Database type ${DB_TYPE} not supported yet`);
        }
    }
    async query(sql, params = []) {
        if (!this.db)
            await this.initialize();
        return this.db.query(sql, params);
    }
    async get(sql, params = []) {
        if (!this.db)
            await this.initialize();
        return this.db.get(sql, params);
    }
    async run(sql, params = []) {
        if (!this.db)
            await this.initialize();
        return this.db.run(sql, params);
    }
    async transaction(callback) {
        if (!this.db)
            await this.initialize();
        const sp = `sp_${++this.txCounter}`;
        const run = async () => {
            await this.run(`SAVEPOINT ${sp}`);
            try {
                const result = await callback();
                await this.run(`RELEASE SAVEPOINT ${sp}`);
                return result;
            }
            catch (error) {
                try {
                    await this.run(`ROLLBACK TO SAVEPOINT ${sp}`);
                }
                catch (_) { }
                try {
                    await this.run(`RELEASE SAVEPOINT ${sp}`);
                }
                catch (_) { }
                throw error;
            }
        };
        const next = this.txQueue.then(run, run);
        this.txQueue = next.catch(() => { });
        return next;
    }
}
exports.db = new DatabaseManager();
//# sourceMappingURL=database.config.js.map