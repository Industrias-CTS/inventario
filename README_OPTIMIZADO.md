# Sistema de Inventario - Versión Optimizada

## Descripción
Sistema completo de gestión de inventario con funcionalidades de control de stock, movimientos, recetas y reportes.

## Características Principales
- ✅ Gestión de componentes y stock
- ✅ Control de movimientos (entradas/salidas)
- ✅ Sistema de reservas
- ✅ Gestión de recetas
- ✅ Reportes y estadísticas
- ✅ Autenticación y autorización
- ✅ Base de datos SQLite (desarrollo) / PostgreSQL (producción)

## Requisitos Previos
- Node.js v14 o superior
- npm o yarn
- Git

## Instalación Rápida

### Windows
```batch
# Clonar el repositorio
git clone [url-del-repositorio]
cd inventario

# Ejecutar el script de inicio
start-dev.bat
```

### Linux/Mac
```bash
# Clonar el repositorio
git clone [url-del-repositorio]
cd inventario

# Backend
cd inventory-app/backend
npm install
npm run dev

# Frontend (en otra terminal)
cd inventory-app/frontend
npm install
npm start
```

## Configuración

### Backend (.env)
```env
# Tipo de base de datos
DB_TYPE=sqlite

# Puerto del servidor
PORT=3001

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
# API URL
REACT_APP_API_URL=http://localhost:3001/api

# Puerto
PORT=3000
```

## Estructura Optimizada

```
inventario/
├── inventory-app/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database.config.ts    # Configuración unificada DB
│   │   │   │   └── database-sqlite.ts    # SQLite específico
│   │   │   ├── controllers/
│   │   │   │   ├── *.controller.optimized.ts  # Controladores optimizados
│   │   │   ├── routes/
│   │   │   ├── middlewares/
│   │   │   └── index.optimized.ts       # Servidor principal optimizado
│   │   └── data/
│   │       └── inventory.db              # Base de datos SQLite
│   └── frontend/
│       ├── src/
│       │   ├── config/
│       │   │   └── index.ts             # Configuración centralizada
│       │   ├── hooks/
│       │   │   └── useApi.ts            # Hook personalizado para API
│       │   ├── components/
│       │   │   └── DataTable.tsx        # Componente tabla optimizado
│       │   └── services/
│       │       └── api.ts               # Cliente API configurado
│       └── .env
└── start-dev.bat                        # Script inicio Windows

```

## Scripts Disponibles

### Backend
```bash
npm run dev          # Inicia servidor optimizado con SQLite
npm run dev-original # Inicia servidor original
npm run build        # Compila TypeScript
npm start           # Inicia servidor de producción
```

### Frontend
```bash
npm start           # Inicia en modo desarrollo
npm run build       # Compila para producción
npm test           # Ejecuta pruebas
```

## Usuarios por Defecto
- **Admin**: admin / admin123
- **Usuario**: user / user123

## API Endpoints

### Autenticación
- POST `/api/auth/login` - Iniciar sesión
- POST `/api/auth/register` - Registrar usuario
- GET `/api/auth/profile` - Obtener perfil

### Componentes
- GET `/api/components` - Listar componentes
- GET `/api/components/:id` - Obtener componente
- POST `/api/components` - Crear componente
- PUT `/api/components/:id` - Actualizar componente
- DELETE `/api/components/:id` - Eliminar componente
- GET `/api/components/:id/stock` - Ver stock

### Movimientos
- GET `/api/movements` - Listar movimientos
- POST `/api/movements` - Crear movimiento
- GET `/api/movements/:id` - Obtener movimiento
- GET `/api/movements/stats` - Estadísticas

### Otros
- GET `/api/categories` - Listar categorías
- GET `/api/units` - Listar unidades
- GET `/api/movement-types` - Tipos de movimiento
- GET `/api/users` - Listar usuarios
- GET `/health` - Estado del servidor

## Optimizaciones Implementadas

1. **Base de Datos**
   - Configuración unificada SQLite/PostgreSQL
   - Transacciones optimizadas
   - Índices en campos clave

2. **Backend**
   - Middleware de caché
   - Rate limiting
   - Compresión de respuestas
   - Manejo de errores centralizado
   - Validación de datos

3. **Frontend**
   - Hook personalizado para API
   - Componentes reutilizables
   - Lazy loading
   - Configuración centralizada
   - Manejo de estado optimizado

4. **Seguridad**
   - Helmet para headers HTTP
   - CORS configurado
   - JWT con expiración
   - Bcrypt para contraseñas
   - Validación de entrada

## Solución de Problemas

### El servidor no inicia
```bash
# Verificar puerto ocupado
netstat -an | findstr :3001

# Cambiar puerto en .env
PORT=3002
```

### Error de conexión frontend-backend
```bash
# Verificar URL en frontend/.env
REACT_APP_API_URL=http://localhost:3001/api
```

### Base de datos corrupta
```bash
# Eliminar y recrear
cd inventory-app/backend
rm data/inventory.db
npm run dev
```

## Despliegue

### Producción
1. Configurar variables de entorno
2. Compilar frontend: `npm run build`
3. Compilar backend: `npm run build`
4. Configurar nginx/apache
5. Usar PM2 para el backend

### Docker (opcional)
```dockerfile
# Pendiente de implementación
```

## Contribución
1. Fork del proyecto
2. Crear rama feature
3. Commit cambios
4. Push a la rama
5. Crear Pull Request

## Licencia
MIT

## Soporte
Para problemas o preguntas, crear un issue en el repositorio.