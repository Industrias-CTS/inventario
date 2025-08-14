@echo off
REM Script para Windows - Descargar aplicacion del servidor AWS

echo === Descargando aplicacion del servidor AWS ===
echo.

REM Configurar variables
set SERVER_IP=34.198.163.51
set SERVER_USER=ubuntu
set LOCAL_DIR=inventario-server

echo Creando directorio local: %LOCAL_DIR%
if not exist %LOCAL_DIR% mkdir %LOCAL_DIR%

echo.
echo === OPCION 1: Descargar con SCP (requiere clave SSH) ===
echo Ejecuta estos comandos:
echo.
echo 1. Descargar toda la aplicacion:
echo    scp -r %SERVER_USER%@%SERVER_IP%:/var/www/inventory %LOCAL_DIR%/
echo.
echo 2. Descargar solo configuracion Nginx:
echo    scp %SERVER_USER%@%SERVER_IP%:/etc/nginx/sites-available/* %LOCAL_DIR%/nginx-configs/
echo.
echo === OPCION 2: Crear archivo comprimido en servidor y descargar ===
echo.
echo En el servidor ejecuta:
echo    cd /var/www
echo    tar -czf inventory-backup.tar.gz inventory/
echo    tar -czf nginx-configs.tar.gz /etc/nginx/sites-available/ /etc/nginx/nginx.conf
echo.
echo Luego desde tu PC:
echo    scp %SERVER_USER%@%SERVER_IP%:~/inventory-backup.tar.gz .
echo    scp %SERVER_USER%@%SERVER_IP%:~/nginx-configs.tar.gz .
echo.
echo === OPCION 3: Usar rsync (mas eficiente) ===
echo    rsync -avz --progress %SERVER_USER%@%SERVER_IP%:/var/www/inventory/ %LOCAL_DIR%/
echo.
pause