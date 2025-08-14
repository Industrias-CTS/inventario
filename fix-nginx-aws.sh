#!/bin/bash

# Script para aplicar fix de rate limiting en servidor AWS
# Ejecutar con: bash fix-nginx-aws.sh

echo "=== Aplicando fix de rate limiting en Nginx ==="

# Backup de configuracion actual
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d)

# Crear nueva configuracion
sudo tee /etc/nginx/sites-available/inventory > /dev/null << 'EOF'
# Configuracion de rate limiting mas permisiva
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=10r/s;

server {
    listen 80;
    server_name 34.198.163.51;

    access_log /var/log/nginx/inventory_access.log;
    error_log /var/log/nginx/inventory_error.log;

    # Frontend
    location / {
        root /var/www/inventory/frontend;
        try_files $uri $uri/ /index.html;
    }

    # Login endpoint - con burst para evitar 429
    location /api/auth/login {
        limit_req zone=login_limit burst=20 nodelay;
        
        proxy_pass http://localhost:3001/api/auth/login;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Resto de API
    location /api {
        limit_req zone=api_limit burst=50 nodelay;
        
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    client_max_body_size 10M;
}
EOF

# Habilitar el sitio
sudo ln -sf /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/

# Desabilitar default si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuracion
echo "=== Verificando configuracion ==="
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "=== Recargando Nginx ==="
    sudo systemctl reload nginx
    echo "✅ Configuracion aplicada exitosamente"
    echo ""
    echo "=== Verificando status ==="
    sudo systemctl status nginx --no-pager
else
    echo "❌ Error en la configuracion, revirtiendo..."
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d) /etc/nginx/sites-available/default
    sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
    sudo systemctl reload nginx
fi