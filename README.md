# Sistema de Gestión de Inventario

Aplicación web completa para gestión de inventario con componentes, movimientos, reservas y recetas.

## Características

- **Autenticación y autorización** con JWT
- **Gestión de componentes** de inventario
- **Control de movimientos** (entradas, salidas, reservas)
- **Sistema de recetas** (en desarrollo)
- **Dashboard** con métricas en tiempo real
- **Reportes** de inventario

## Tecnologías

### Backend
- Node.js con TypeScript
- Express.js
- PostgreSQL
- JWT para autenticación
- Bcrypt para encriptación

### Frontend
- React con TypeScript
- Material-UI (MUI)
- React Query para gestión de estado
- React Router para navegación
- React Hook Form para formularios

## Instalación

### Requisitos previos
- Node.js 16+
- PostgreSQL 13+

### Base de datos

1. Crear la base de datos:
```bash
createdb inventory_db
```

2. Ejecutar el script de esquema:
```bash
psql -d inventory_db -f inventory-app/backend/src/database/schema.sql
```

### Backend

```bash
cd inventory-app/backend
npm install
cp .env.example .env
# Editar .env con tus credenciales de base de datos
npm run dev
```

### Frontend

```bash
cd inventory-app/frontend
npm install
npm start
```

## Estructura del proyecto

```
inventory-app/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuración de base de datos
│   │   ├── controllers/    # Controladores de API
│   │   ├── middlewares/    # Middlewares de Express
│   │   ├── routes/         # Rutas de API
│   │   ├── services/       # Lógica de negocio
│   │   ├── types/          # Tipos de TypeScript
│   │   └── utils/          # Utilidades
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/     # Componentes reutilizables
    │   ├── contexts/       # Contextos de React
    │   ├── layouts/        # Layouts de la aplicación
    │   ├── pages/          # Páginas principales
    │   ├── services/       # Servicios de API
    │   └── types/          # Tipos de TypeScript
    └── package.json
```

## API Endpoints

- `POST /api/auth/register` - Registro de usuarios
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/profile` - Perfil del usuario

- `GET /api/components` - Listar componentes
- `POST /api/components` - Crear componente
- `PUT /api/components/:id` - Actualizar componente
- `DELETE /api/components/:id` - Eliminar componente

- `GET /api/movements` - Listar movimientos
- `POST /api/movements` - Crear movimiento
- `GET /api/movements/reservations` - Listar reservas
- `POST /api/movements/reservations` - Crear reserva

## Uso

1. Accede a `http://localhost:3000`
2. Regístrate o inicia sesión
3. Navega por el dashboard para ver métricas
4. Gestiona componentes en la sección de inventario
5. Registra movimientos de entrada/salida
6. Crea reservas para apartar stock