# Sistema de Inventario - Configuración AWS

## Servidor AWS
**IP:** 34.198.163.51  
**URLs:**
- Frontend: http://34.198.163.51
- API: http://34.198.163.51/api
- Health Check: http://34.198.163.51/health

## Usuarios por Defecto
- **Admin:** admin / admin123
- **Usuario:** user / user123

## Configuración Actual

### Variables de Entorno

#### Backend (.env)
```env
DB_TYPE=sqlite
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://34.198.163.51
JWT_SECRET=supersecretkey123456789inventory
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://34.198.163.51/api
PORT=3006
REACT_APP_NAME=Sistema de Inventario
REACT_APP_VERSION=1.0.0
```

## Scripts Disponibles

### Verificación del Servidor
```bash
# Windows
check-server.bat

# Linux/Mac
curl http://34.198.163.51/health
curl http://34.198.163.51/api/categories
```

### Deploy a AWS
```bash
# Windows
deploy-aws.bat

# Manual
npm run build (frontend)
npm run build (backend)
# Subir archivos al servidor
# Ejecutar script de instalación
```

## Estructura en el Servidor AWS

```
/var/www/inventory/
├── backend/
│   ├── dist/           # Backend compilado
│   ├── data/           # Base de datos SQLite
│   ├── node_modules/   # Dependencias
│   ├── package.json
│   └── .env
├── frontend/
│   ├── build/          # Frontend compilado
│   └── static/
└── logs/
```

## Configuración de Nginx

```nginx
server {
    listen 80;
    server_name 34.198.163.51;

    # Frontend
    location / {
        root /var/www/inventory/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:3001/health;
    }
}
```

## Configuración de PM2

```javascript
{
  "apps": [{
    "name": "inventory-backend",
    "script": "dist/index.js",
    "cwd": "/var/www/inventory/backend",
    "env": {
      "NODE_ENV": "production",
      "PORT": "3001"
    }
  }]
}
```

## Comandos de Administración

### PM2 (Backend)
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs inventory-backend

# Reiniciar
pm2 restart inventory-backend

# Parar
pm2 stop inventory-backend

# Iniciar
pm2 start ecosystem.config.js
```

### Nginx
```bash
# Reiniciar
sudo systemctl restart nginx

# Ver status
sudo systemctl status nginx

# Ver logs
sudo tail -f /var/log/nginx/inventory_access.log
sudo tail -f /var/log/nginx/inventory_error.log
```

### Base de Datos
```bash
# Ubicación
/var/www/inventory/backend/data/inventory.db

# Backup
cp inventory.db inventory_backup_$(date +%Y%m%d).db

# Verificar
sqlite3 inventory.db ".tables"
sqlite3 inventory.db "SELECT COUNT(*) FROM users;"
```

## APIs Principales

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/profile` - Perfil usuario

### Componentes
- `GET /api/components` - Listar componentes
- `POST /api/components` - Crear componente
- `PUT /api/components/:id` - Actualizar componente
- `DELETE /api/components/:id` - Eliminar componente

### Movimientos
- `GET /api/movements` - Listar movimientos
- `POST /api/movements` - Crear movimiento
- `GET /api/movements/stats` - Estadísticas

### Catálogos
- `GET /api/categories` - Categorías
- `GET /api/units` - Unidades
- `GET /api/movement-types` - Tipos de movimiento
- `GET /api/users` - Usuarios

## Troubleshooting

### Frontend no carga
```bash
# Verificar archivos
ls -la /var/www/inventory/frontend/
# Verificar nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Backend no responde
```bash
# Verificar PM2
pm2 status
pm2 logs inventory-backend
# Verificar puerto
netstat -tlnp | grep :3001
# Reiniciar
pm2 restart inventory-backend
```

### Error de base de datos
```bash
# Verificar archivo
ls -la /var/www/inventory/backend/data/
# Recrear (CUIDADO: borra datos)
rm inventory.db
pm2 restart inventory-backend
```

### Errores de CORS
- Verificar FRONTEND_URL en .env
- Verificar configuración en index.ts
- Reiniciar backend

## Monitoreo

### URLs de Verificación
- Health: http://34.198.163.51/health
- Frontend: http://34.198.163.51
- API Test: http://34.198.163.51/api/categories

### Logs Importantes
```bash
# PM2 Logs
tail -f /var/log/pm2/inventory-backend.log

# Nginx Logs
tail -f /var/log/nginx/inventory_access.log
tail -f /var/log/nginx/inventory_error.log

# Sistema
journalctl -u nginx
journalctl -f
```

## Backup y Mantenimiento

### Backup Automático
```bash
#!/bin/bash
# backup-inventory.sh
DATE=$(date +%Y%m%d_%H%M)
cp /var/www/inventory/backend/data/inventory.db /backups/inventory_$DATE.db
# Mantener solo últimos 7 días
find /backups -name "inventory_*.db" -mtime +7 -delete
```

### Actualización
1. Hacer backup de la base de datos
2. Compilar nuevo código
3. Parar servicios
4. Actualizar archivos
5. Reiniciar servicios
6. Verificar funcionamiento

## Seguridad

- Cambiar JWT_SECRET en producción
- Configurar firewall (solo puertos 80, 443, 22)
- Actualizar dependencias regularmente
- Monitorear logs por actividad sospechosa
- Implementar HTTPS con Let's Encrypt

## Contacto y Soporte
Para problemas técnicos, revisar logs y usar los comandos de troubleshooting.