#!/bin/bash

# Script para desplegar fix de Nginx al servidor AWS
# Ejecutar desde local: bash deploy-nginx-fix.sh

SERVER_IP="34.198.163.51"
SERVER_USER="ubuntu"

echo "=== Desplegando fix de Nginx al servidor AWS ==="
echo "Servidor: $SERVER_USER@$SERVER_IP"
echo ""

# Verificar que el archivo existe
if [ ! -f "nginx-inventory.conf" ]; then
    echo "❌ Error: No se encuentra el archivo nginx-inventory.conf"
    echo "Ejecuta este script desde el directorio del proyecto"
    exit 1
fi

# 1. Subir archivo de configuracion actualizada
echo "📤 Subiendo configuracion de Nginx..."
scp nginx-inventory.conf $SERVER_USER@$SERVER_IP:~/nginx-inventory-fixed.conf

# 2. Conectar al servidor y aplicar cambios
echo "🔧 Aplicando cambios en el servidor..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
# Crear backup de la configuracion actual
sudo cp /etc/nginx/sites-available/inventory /etc/nginx/sites-available/inventory.backup.$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "No hay configuracion previa"

# Aplicar nueva configuracion
sudo cp ~/nginx-inventory-fixed.conf /etc/nginx/sites-available/inventory

# Crear enlace simbolico si no existe
sudo ln -sf /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/inventory

# Remover configuracion default si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis de Nginx
echo ""
echo "🔍 Verificando sintaxis de Nginx..."
if sudo nginx -t; then
    echo ""
    echo "✅ Configuracion valida"
    echo "🔄 Recargando Nginx..."
    sudo systemctl reload nginx
    
    echo ""
    echo "📊 Estado de Nginx:"
    sudo systemctl status nginx --no-pager -l
    
    echo ""
    echo "✅ Fix aplicado exitosamente!"
    echo ""
    echo "Configuracion aplicada:"
    echo "- Rate limiting: 10 req/s para login con burst=20"
    echo "- Rate limiting: 30 req/s para APIs con burst=50"
    echo "- Headers CORS agregados"
    echo ""
    echo "Prueba el login en: http://34.198.163.51"
else
    echo ""
    echo "❌ Error en la configuracion de Nginx"
    echo "Restaurando backup..."
    sudo cp /etc/nginx/sites-available/inventory.backup.* /etc/nginx/sites-available/inventory 2>/dev/null
    sudo systemctl reload nginx
    echo "Configuracion anterior restaurada"
fi
EOF

echo ""
echo "🏁 Proceso completado"
echo ""
echo "Para verificar logs en tiempo real:"
echo "ssh $SERVER_USER@$SERVER_IP 'sudo tail -f /var/log/nginx/inventory_error.log'"