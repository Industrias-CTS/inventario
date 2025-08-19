#!/bin/bash

echo "🚀 Iniciando despliegue de la aplicación de inventario..."

# Variables
FRONTEND_BUILD_DIR="inventory-app/frontend/build"
NGINX_DIR="/var/www/inventario"
BACKEND_DIR="/var/inventario-backend"
NGINX_CONFIG="/etc/nginx/sites-available/inventario"

echo "📦 1. Construyendo el frontend..."
cd inventory-app/frontend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error al construir el frontend"
    exit 1
fi

echo "📁 2. Copiando archivos del frontend a Nginx..."
sudo rm -rf ${NGINX_DIR}/*
sudo cp -r build/* ${NGINX_DIR}/
sudo chown -R www-data:www-data ${NGINX_DIR}
sudo chmod -R 755 ${NGINX_DIR}

echo "🔧 3. Configurando Nginx..."
sudo cp ../nginx.conf ${NGINX_CONFIG}
sudo ln -sf ${NGINX_CONFIG} /etc/nginx/sites-enabled/
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx configurado correctamente"
else
    echo "❌ Error en la configuración de Nginx"
    exit 1
fi

echo "🔨 4. Construyendo el backend..."
cd ../backend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error al construir el backend"
    exit 1
fi

echo "📂 5. Desplegando backend..."
sudo mkdir -p ${BACKEND_DIR}
sudo cp -r dist/* ${BACKEND_DIR}/
sudo cp package.json ${BACKEND_DIR}/
sudo cp .env ${BACKEND_DIR}/
sudo cp -r node_modules ${BACKEND_DIR}/ 2>/dev/null || echo "⚠️  Instalando dependencias de producción..."

if [ ! -d "${BACKEND_DIR}/node_modules" ]; then
    cd ${BACKEND_DIR}
    sudo npm ci --only=production
fi

echo "🔄 6. Iniciando servicios con PM2..."
sudo pm2 delete inventario-backend 2>/dev/null || true
sudo pm2 start ${BACKEND_DIR}/index-simple.js --name "inventario-backend" --env production
sudo pm2 save
sudo pm2 startup

echo "🔍 7. Verificando estado de los servicios..."
sudo systemctl status nginx --no-pager -l
sudo pm2 status

echo "✅ Despliegue completado!"
echo "🌐 Aplicación disponible en: http://34.198.163.51"
echo "📊 API disponible en: http://34.198.163.51/api"
echo ""
echo "📋 Comandos útiles:"
echo "   - Ver logs del backend: sudo pm2 logs inventario-backend"
echo "   - Reiniciar backend: sudo pm2 restart inventario-backend"
echo "   - Ver logs de Nginx: sudo tail -f /var/log/nginx/inventario_error.log"