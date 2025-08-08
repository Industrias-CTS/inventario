# Solución Error 500 - Backend AWS

## El Problema
El frontend en `http://34.198.163.51` intenta hacer login pero recibe error 500 del backend.

## Pasos para Solucionarlo en el Servidor AWS

### 1. Conectarse al servidor
```bash
ssh -i tu-clave.pem ubuntu@34.198.163.51
# o
ssh -i tu-clave.pem ec2-user@34.198.163.51
```

### 2. Verificar el estado del backend
```bash
# Ver si el proceso está corriendo
pm2 list

# Ver logs del backend
pm2 logs backend

# Si no está corriendo, iniciar el backend
cd /path/to/inventory-app/backend
pm2 start dist/index-simple.js --name backend
```

### 3. Verificar/Crear la base de datos
```bash
cd /path/to/inventory-app/backend

# Instalar dependencias si es necesario
npm install

# Inicializar base de datos
node init-database.js

# Verificar que se creó
ls -la data/inventory.db
```

### 4. Verificar variables de entorno
```bash
# Crear/editar archivo .env
nano .env
```

Contenido del `.env`:
```env
# Database
DB_TYPE=sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventory_db
DB_USER=postgres
DB_PASSWORD=postgres

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://34.198.163.51

# JWT
JWT_SECRET=supersecretkey123456789inventory
JWT_EXPIRES_IN=7d

# Bcrypt
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Verificar configuración de Nginx
```bash
sudo nano /etc/nginx/sites-available/default
```

Debe tener algo así:
```nginx
server {
    listen 80;
    server_name 34.198.163.51;

    # Frontend
    location / {
        root /path/to/inventory-app/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
    }
}
```

Reiniciar nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Reiniciar el backend con PM2
```bash
cd /path/to/inventory-app/backend
pm2 delete backend
pm2 start dist/index-simple.js --name backend
pm2 save
pm2 startup  # Si es la primera vez
```

### 7. Verificar permisos
```bash
# Dar permisos a la carpeta data
chmod -R 755 data/
chmod 664 data/inventory.db
```

### 8. Verificar firewall/security groups
En AWS Console, verificar que el Security Group permite:
- Puerto 80 (HTTP) desde cualquier IP
- Puerto 22 (SSH) desde tu IP
- Puerto 3001 (opcional, solo si accedes directamente al backend)

### 9. Probar el backend localmente en el servidor
```bash
# Desde el servidor AWS
curl http://localhost:3001/health
curl http://localhost:3001/api

# Probar login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 10. Ver logs en tiempo real
```bash
# Ver todos los logs
pm2 logs

# Ver solo errores
pm2 logs --err

# Monitoreo en tiempo real
pm2 monit
```

## Comandos Útiles de Debug

```bash
# Ver procesos de node
ps aux | grep node

# Ver puertos en uso
sudo netstat -tlnp | grep :3001

# Ver logs de nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reiniciar todo
pm2 restart all
sudo systemctl restart nginx
```

## Usuario de Prueba
- **Usuario:** admin
- **Contraseña:** admin123

## Si Nada Funciona
1. Clonar el repositorio fresco:
```bash
cd /home/ubuntu
git clone https://github.com/Industrias-CTS/inventario.git
cd inventario/inventory-app/backend
npm install
node init-database.js
npm run build
pm2 start dist/index-simple.js --name backend-new
```

2. Actualizar nginx para apuntar a la nueva ubicación