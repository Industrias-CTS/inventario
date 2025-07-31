"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares de seguridad
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use((0, compression_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Demasiadas solicitudes desde esta IP',
});
app.use('/api/', limiter);
// Body parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use((err, _req, res, _next) => {
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
//# sourceMappingURL=index-simple.js.map