@echo off
echo ========================================
echo    Sistema de Inventario - Modo Desarrollo
echo ========================================
echo.

echo [1/3] Verificando dependencias...
cd inventory-app\backend
if not exist node_modules (
    echo Instalando dependencias del backend...
    npm install
)

cd ..\frontend
if not exist node_modules (
    echo Instalando dependencias del frontend...
    npm install
)

echo.
echo [2/3] Iniciando Backend en puerto 3001...
cd ..\backend
start cmd /k "npm run dev"

echo.
echo [3/3] Esperando 5 segundos para iniciar Frontend...
timeout /t 5 /nobreak > nul

echo Iniciando Frontend en puerto 3000...
cd ..\frontend
start cmd /k "set PORT=3000 && npm start"

echo.
echo ========================================
echo    Servidores iniciados:
echo    - Backend: http://localhost:3001
echo    - Frontend: http://localhost:3000
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul