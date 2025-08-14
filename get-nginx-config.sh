#!/bin/bash

# Script para extraer toda la configuracion de Nginx del servidor
echo "=== Extrayendo configuracion de Nginx ==="

# Crear directorio para guardar configs
mkdir -p nginx-server-config

# Configuracion principal
echo ">>> Copiando nginx.conf"
sudo cat /etc/nginx/nginx.conf > nginx-server-config/nginx.conf

# Sites available
echo ">>> Copiando sites-available"
mkdir -p nginx-server-config/sites-available
sudo cp -r /etc/nginx/sites-available/* nginx-server-config/sites-available/ 2>/dev/null

# Sites enabled
echo ">>> Copiando sites-enabled"
mkdir -p nginx-server-config/sites-enabled
ls -la /etc/nginx/sites-enabled/ > nginx-server-config/sites-enabled/links.txt

# Configuraciones adicionales
echo ">>> Copiando conf.d"
mkdir -p nginx-server-config/conf.d
sudo cp -r /etc/nginx/conf.d/* nginx-server-config/conf.d/ 2>/dev/null

# Logs recientes
echo ">>> Extrayendo ultimas lineas de logs"
sudo tail -n 500 /var/log/nginx/error.log > nginx-server-config/error.log 2>/dev/null
sudo tail -n 500 /var/log/nginx/access.log > nginx-server-config/access.log 2>/dev/null
sudo tail -n 500 /var/log/nginx/inventory_error.log > nginx-server-config/inventory_error.log 2>/dev/null
sudo tail -n 500 /var/log/nginx/inventory_access.log > nginx-server-config/inventory_access.log 2>/dev/null

# Estado actual
echo ">>> Capturando estado de Nginx"
sudo nginx -T > nginx-server-config/nginx-full-config.txt 2>&1
sudo systemctl status nginx > nginx-server-config/nginx-status.txt 2>&1

# Crear archivo tar
tar -czf nginx-config-$(date +%Y%m%d-%H%M%S).tar.gz nginx-server-config/

echo "✅ Configuracion extraida en nginx-config-*.tar.gz"
echo ""
echo "Para descargar a tu PC local ejecuta desde tu PC:"
echo "scp ubuntu@34.198.163.51:~/nginx-config-*.tar.gz ."