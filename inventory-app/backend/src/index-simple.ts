import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Demasiadas solicitudes desde esta IP',
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de prueba
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.post('/api/auth/login', (_req, res) => {
  res.json({
    message: 'Inicio de sesión exitoso',
    user: {
      id: '1',
      username: 'admin',
      email: 'admin@test.com',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    },
    token: 'test-token'
  });
});

app.get('/api/components', (_req, res) => {
  res.json({
    components: [
      {
        id: '1',
        code: 'COMP001',
        name: 'Componente de prueba',
        current_stock: 10,
        reserved_stock: 2,
        min_stock: 5,
        max_stock: 50,
        unit_symbol: 'pcs'
      }
    ]
  });
});

app.get('/api/movements', (_req, res) => {
  res.json({
    movements: [
      {
        id: '1',
        movement_type_name: 'Entrada',
        component_name: 'Componente de prueba',
        quantity: 10,
        operation: 'IN',
        created_at: new Date().toISOString()
      }
    ]
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});