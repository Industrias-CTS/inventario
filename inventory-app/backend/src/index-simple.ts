import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { db } from './config/database.config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await db.initialize();
    console.log('Base de datos inicializada correctamente');

    app.set('trust proxy', 1);

    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    app.use(cors({
      origin: function(origin, callback) {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:3006',
          'http://34.198.163.51',
          process.env.FRONTEND_URL
        ].filter(Boolean);
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    app.use(compression());

    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: 'Demasiadas solicitudes desde esta IP',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        return req.ip === '127.0.0.1' || req.ip === '::1';
      }
    });

    app.use('/api/', limiter);

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    const authRoutes = require('./routes/auth.routes').default;
    const componentsRoutes = require('./routes/components.routes').default;
    const movementsRoutes = require('./routes/movements.routes').default;
    const recipesRoutes = require('./routes/recipes.routes').default;
    const categoriesRoutes = require('./routes/categories.routes').default;
    const unitsRoutes = require('./routes/units.routes').default;
    const usersRoutes = require('./routes/users.routes').default;
    const projectionsRoutes = require('./routes/projections.routes').default;

    app.use('/api/auth', authRoutes);
    app.use('/api/components', componentsRoutes);
    app.use('/api/movements', movementsRoutes);
    app.use('/api/recipes', recipesRoutes);
    app.use('/api/categories', categoriesRoutes);
    app.use('/api/units', unitsRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/projections', projectionsRoutes);


    app.get('/api/movement-types', async (_req, res) => {
      try {
        const types = await db.query('SELECT * FROM movement_types ORDER BY name');
        res.json({ movementTypes: types });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tipos de movimiento' });
      }
    });


    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        database: 'connected',
        version: '1.0.0'
      });
    });

    app.get('/', (_req, res) => {
      res.json({ 
        message: 'API de Inventario',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          components: '/api/components',
          movements: '/api/movements',
          recipes: '/api/recipes',
          categories: '/api/categories',
          units: '/api/units',
          movementTypes: '/api/movement-types',
          users: '/api/users',
          projections: '/api/projections',
          health: '/health'
        }
      });
    });

    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });

    app.use((_req, res) => {
      res.status(404).json({ error: 'Ruta no encontrada' });
    });

    app.listen(PORT, () => {
      console.log(`
========================================
    Servidor de Inventario v1.0.0
========================================
    Puerto: ${PORT}
    Entorno: ${process.env.NODE_ENV || 'development'}
    Base de datos: SQLite
    URL Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
========================================
    API disponible en: http://localhost:${PORT}
    Health check: http://localhost:${PORT}/health
========================================
      `);
    });

  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});