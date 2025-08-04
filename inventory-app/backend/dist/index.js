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
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const components_routes_1 = __importDefault(require("./routes/components.routes"));
const movements_routes_1 = __importDefault(require("./routes/movements.routes"));
const recipes_routes_1 = __importDefault(require("./routes/recipes.routes"));
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
// Rutas
app.use('/api/auth', auth_routes_1.default);
app.use('/api/components', components_routes_1.default);
app.use('/api/movements', movements_routes_1.default);
app.use('/api/recipes', recipes_routes_1.default);
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
//# sourceMappingURL=index.js.map