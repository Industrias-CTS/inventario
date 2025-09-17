# 🚀 Guía de Despliegue - Sistema de Inventario

## 📋 Requisitos Previos

Asegúrate de tener instalado en el servidor AWS:
- Node.js 18+
- npm
- PM2
- Nginx
- Git

## 🔧 Configuración del Servidor

### 1. Instalar dependencias necesarias:
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2

# Verificar instalaciones
node --version
npm --version
pm2 --version
```

### 2. Configurar directorios:
```bash
# Crear directorios necesarios
sudo mkdir -p /var/www/inventario
sudo mkdir -p /var/inventario-backend
sudo mkdir -p /var/log/pm2

# Configurar permisos
sudo chown -R $USER:$USER /var/www/inventario
sudo chown -R $USER:$USER /var/inventario-backend
```

## 📥 Despliegue de la Aplicación

### Paso 1: Clonar/Actualizar el repositorio
```bash
# Si es la primera vez
git clone https://github.com/Industrias-CTS/inventario.git
cd inventario

# Si ya existe el repositorio
cd inventario
git pull origin main
```

### Paso 2: Construir la aplicación
```bash
# Dar permisos de ejecución al script
chmod +x build-production.sh

# Ejecutar construcción
./build-production.sh
```

### Paso 3: Desplegar Frontend
```bash
# Copiar archivos construidos a Nginx
sudo cp -r inventory-app/frontend/build/* /var/www/inventario/

# Configurar permisos
sudo chown -R www-data:www-data /var/www/inventario
sudo chmod -R 755 /var/www/inventario

# Configurar Nginx
sudo cp inventory-app/nginx.conf /etc/nginx/sites-available/inventario
sudo ln -sf /etc/nginx/sites-available/inventario /etc/nginx/sites-enabled/

# Remover configuración default (opcional)
sudo rm -f /etc/nginx/sites-enabled/default

# Probar configuración y recargar
sudo nginx -t
sudo systemctl reload nginx
```

### Paso 4: Desplegar Backend
```bash
# Copiar archivos del backend
sudo cp -r inventory-app/backend/dist/* /var/inventario-backend/
sudo cp inventory-app/backend/package.json /var/inventario-backend/
sudo cp inventory-app/backend/.env /var/inventario-backend/

# Instalar dependencias de producción
cd /var/inventario-backend
sudo npm ci --only=production

# Configurar PM2
sudo pm2 delete inventario-backend 2>/dev/null || true
sudo pm2 start index-simple.js --name "inventario-backend" --env production

# Guardar configuración PM2
sudo pm2 save
sudo pm2 startup
```

### Paso 5: Verificar el despliegue
```bash
# Verificar estado de los servicios
sudo systemctl status nginx
sudo pm2 status

# Ver logs si hay problemas
sudo pm2 logs inventario-backend
sudo tail -f /var/log/nginx/inventario_error.log
```

## 🌐 Acceso a la Aplicación

- **Frontend**: http://34.198.163.51
- **API**: http://34.198.163.51/api
- **Health Check**: http://34.198.163.51/api/health

## 🔧 Comandos Útiles

### PM2 (Backend)
```bash
# Ver logs en tiempo real
sudo pm2 logs inventario-backend

# Reiniciar aplicación
sudo pm2 restart inventario-backend

# Ver información detallada
sudo pm2 show inventario-backend

# Monitorear recursos
sudo pm2 monit
```

### Nginx (Frontend)
```bash
# Probar configuración
sudo nginx -t

# Recargar configuración
sudo systemctl reload nginx

# Ver logs
sudo tail -f /var/log/nginx/inventario_access.log
sudo tail -f /var/log/nginx/inventario_error.log

# Estado del servicio
sudo systemctl status nginx
```

### Actualización Rápida
```bash
# Para actualizaciones futuras
cd inventario
git pull origin main
./build-production.sh

# Actualizar frontend
sudo cp -r inventory-app/frontend/build/* /var/www/inventario/
sudo systemctl reload nginx

# Actualizar backend
sudo cp -r inventory-app/backend/dist/* /var/inventario-backend/
sudo pm2 restart inventario-backend
```

## 🛠️ Troubleshooting

### Problemas comunes:

1. **Error 502 Bad Gateway**:
   - Verificar que PM2 esté ejecutando el backend: `sudo pm2 status`
   - Revisar logs: `sudo pm2 logs inventario-backend`

2. **Archivos estáticos no cargan**:
   - Verificar permisos: `sudo chown -R www-data:www-data /var/www/inventario`
   - Probar configuración Nginx: `sudo nginx -t`

3. **Error de conexión a la base de datos**:
   - Verificar que el archivo `.env` esté en `/var/inventario-backend/`
   - Comprobar permisos de la base de datos SQLite

4. **API no responde**:
   - Verificar que el backend esté en el puerto 3001: `sudo netstat -tlnp | grep 3001`
   - Revisar configuración de firewall

## 📱 Contacto

Para problemas técnicos, revisar los logs y contactar al equipo de desarrollo.