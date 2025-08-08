@echo off
echo ========================================
echo    Deploy a AWS - Sistema de Inventario
echo ========================================
echo.

echo [1/5] Compilando Frontend...
cd inventory-app\frontend
call npm run build
if errorlevel 1 (
    echo Error al compilar frontend
    pause
    exit /b 1
)

echo.
echo [2/5] Compilando Backend...
cd ..\backend
call npm run build
if errorlevel 1 (
    echo Error al compilar backend
    pause
    exit /b 1
)

echo.
echo [3/5] Creando archivo de configuracion para PM2...
echo {^
  "apps": [^
    {^
      "name": "inventory-backend",^
      "script": "dist/index.js",^
      "cwd": "/var/www/inventory/backend",^
      "env": {^
        "NODE_ENV": "production",^
        "PORT": "3001"^
      },^
      "instances": 1,^
      "exec_mode": "cluster",^
      "error_file": "/var/log/pm2/inventory-backend.err",^
      "out_file": "/var/log/pm2/inventory-backend.out",^
      "log_file": "/var/log/pm2/inventory-backend.log"^
    }^
  ]^
} > ecosystem.config.json

echo.
echo [4/5] Creando script de instalacion para el servidor...
echo #!/bin/bash > install-server.sh
echo # Script de instalacion para servidor AWS >> install-server.sh
echo. >> install-server.sh
echo # Detener servicios existentes >> install-server.sh
echo sudo pm2 stop inventory-backend 2^>^&1 ^|^| true >> install-server.sh
echo sudo systemctl stop nginx 2^>^&1 ^|^| true >> install-server.sh
echo. >> install-server.sh
echo # Crear directorios >> install-server.sh
echo sudo mkdir -p /var/www/inventory >> install-server.sh
echo sudo mkdir -p /var/www/inventory/backend >> install-server.sh
echo sudo mkdir -p /var/www/inventory/frontend >> install-server.sh
echo. >> install-server.sh
echo # Copiar archivos backend >> install-server.sh
echo sudo cp -r backend/dist/* /var/www/inventory/backend/ >> install-server.sh
echo sudo cp -r backend/node_modules /var/www/inventory/backend/ >> install-server.sh
echo sudo cp backend/package.json /var/www/inventory/backend/ >> install-server.sh
echo sudo cp backend/.env /var/www/inventory/backend/ >> install-server.sh
echo sudo cp backend/data /var/www/inventory/backend/ -r 2^>^&1 ^|^| true >> install-server.sh
echo. >> install-server.sh
echo # Copiar archivos frontend >> install-server.sh
echo sudo cp -r frontend/build/* /var/www/inventory/frontend/ >> install-server.sh
echo. >> install-server.sh
echo # Configurar permisos >> install-server.sh
echo sudo chown -R ubuntu:ubuntu /var/www/inventory >> install-server.sh
echo sudo chmod -R 755 /var/www/inventory >> install-server.sh
echo. >> install-server.sh
echo # Crear base de datos si no existe >> install-server.sh
echo cd /var/www/inventory/backend >> install-server.sh
echo mkdir -p data >> install-server.sh
echo. >> install-server.sh
echo # Iniciar backend con PM2 >> install-server.sh
echo sudo pm2 start ecosystem.config.json >> install-server.sh
echo sudo pm2 save >> install-server.sh
echo sudo pm2 startup >> install-server.sh
echo. >> install-server.sh
echo # Configurar Nginx >> install-server.sh
echo sudo tee /etc/nginx/sites-available/inventory ^<^<EOF >> install-server.sh
echo server { >> install-server.sh
echo     listen 80; >> install-server.sh
echo     server_name 34.198.163.51; >> install-server.sh
echo. >> install-server.sh
echo     # Frontend >> install-server.sh
echo     location / { >> install-server.sh
echo         root /var/www/inventory/frontend; >> install-server.sh
echo         try_files ^$uri ^$uri/ /index.html; >> install-server.sh
echo         index index.html; >> install-server.sh
echo     } >> install-server.sh
echo. >> install-server.sh
echo     # API Backend >> install-server.sh
echo     location /api { >> install-server.sh
echo         proxy_pass http://localhost:3001; >> install-server.sh
echo         proxy_http_version 1.1; >> install-server.sh
echo         proxy_set_header Upgrade ^$http_upgrade; >> install-server.sh
echo         proxy_set_header Connection 'upgrade'; >> install-server.sh
echo         proxy_set_header Host ^$host; >> install-server.sh
echo         proxy_set_header X-Real-IP ^$remote_addr; >> install-server.sh
echo         proxy_set_header X-Forwarded-For ^$proxy_add_x_forwarded_for; >> install-server.sh
echo         proxy_set_header X-Forwarded-Proto ^$scheme; >> install-server.sh
echo         proxy_cache_bypass ^$http_upgrade; >> install-server.sh
echo     } >> install-server.sh
echo. >> install-server.sh
echo     # Health check >> install-server.sh
echo     location /health { >> install-server.sh
echo         proxy_pass http://localhost:3001/health; >> install-server.sh
echo         proxy_http_version 1.1; >> install-server.sh
echo         proxy_set_header Host ^$host; >> install-server.sh
echo     } >> install-server.sh
echo } >> install-server.sh
echo EOF >> install-server.sh
echo. >> install-server.sh
echo sudo ln -sf /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/ >> install-server.sh
echo sudo nginx -t >> install-server.sh
echo sudo systemctl restart nginx >> install-server.sh
echo sudo systemctl enable nginx >> install-server.sh
echo. >> install-server.sh
echo echo "Instalacion completada!" >> install-server.sh
echo echo "Frontend: http://34.198.163.51" >> install-server.sh
echo echo "API: http://34.198.163.51/api" >> install-server.sh
echo echo "Health: http://34.198.163.51/health" >> install-server.sh

echo.
echo [5/5] Deploy completado!
echo.
echo Archivos generados:
echo - ecosystem.config.json (configuracion PM2)
echo - install-server.sh (script de instalacion)
echo.
echo Para instalar en el servidor AWS:
echo 1. Subir todos los archivos al servidor
echo 2. Ejecutar: chmod +x install-server.sh
echo 3. Ejecutar: ./install-server.sh
echo.
echo ========================================
pause