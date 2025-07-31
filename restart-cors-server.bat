@echo off
echo Reiniciando servidor backend con CORS arreglado...

echo Deteniendo procesos existentes en puerto 3002...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3002" ^| find "LISTENING"') do (
    echo Matando proceso %%a
    taskkill /f /pid %%a >nul 2>&1
)

timeout /t 2 >nul

echo Iniciando servidor actualizado...
cd inventory-app\backend
node server-cors-fix.js