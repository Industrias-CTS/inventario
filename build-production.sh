#!/bin/bash

echo "🔧 Construyendo aplicación para producción..."

# Ir al directorio del frontend
cd inventory-app/frontend

echo "📦 1. Instalando dependencias del frontend..."
npm install

echo "🏗️  2. Construyendo frontend para producción..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend construido exitosamente"
    echo "📁 Los archivos están en: inventory-app/frontend/build/"
    echo ""
    echo "📋 Para desplegar en el servidor AWS:"
    echo "   sudo cp -r inventory-app/frontend/build/* /var/www/inventario/"
    echo "   sudo chown -R www-data:www-data /var/www/inventario/"
    echo "   sudo systemctl reload nginx"
else
    echo "❌ Error al construir el frontend"
    exit 1
fi

echo ""
echo "🚀 Construyendo backend..."
cd ../backend

echo "📦 3. Instalando dependencias del backend..."
npm install

echo "🏗️  4. Construyendo backend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Backend construido exitosamente"
    echo "📁 Los archivos están en: inventory-app/backend/dist/"
    echo ""
    echo "📋 Para desplegar backend en el servidor AWS:"
    echo "   sudo mkdir -p /var/inventario-backend"
    echo "   sudo cp -r inventory-app/backend/dist/* /var/inventario-backend/"
    echo "   sudo cp inventory-app/backend/package.json /var/inventario-backend/"
    echo "   sudo cp inventory-app/backend/.env /var/inventario-backend/"
    echo "   cd /var/inventario-backend && sudo npm ci --only=production"
    echo "   sudo pm2 delete inventario-backend"
    echo "   sudo pm2 start /var/inventario-backend/index-simple.js --name inventario-backend"
    echo "   sudo pm2 save"
else
    echo "❌ Error al construir el backend"
    exit 1
fi

echo ""
echo "🎉 ¡Construcción completada!"