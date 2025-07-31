@echo off
echo Iniciando servidores...

echo.
echo 1. Iniciando backend con CORS arreglado (puerto 3002)...
start "Backend CORS Fix" cmd /k "cd inventory-app\backend && node server-cors-fix.js"

timeout /t 3 >nul

echo.
echo 2. Iniciando frontend (puerto 3005)...
start "Frontend" cmd /k "cd inventory-app\frontend && npm start"

echo.
echo Servidores iniciándose...
echo Backend: http://localhost:3002
echo Frontend: http://localhost:3005
echo.
echo Credenciales:
echo Usuario: admin - Contraseña: admin123
echo Usuario: user - Contraseña: user123
pause