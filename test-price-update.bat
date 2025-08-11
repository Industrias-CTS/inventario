@echo off
echo ===== Test de Actualizacion de Precios en Movimientos =====
echo.

REM Configurar variables
set API_URL=http://localhost:3001/api
set TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMDAxIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzM2MDE2MDAwfQ.example

echo 1. Obteniendo informacion del componente COMP001...
curl -s -X GET "%API_URL%/components?code=COMP001" ^
  -H "Authorization: Bearer %TOKEN%" | findstr "cost_price"
echo.

echo 2. Creando movimiento de INGRESO con precio mayor...
echo    - Componente: COMP001
echo    - Cantidad: 10
echo    - Precio unitario: 150 (mayor al actual)
curl -X POST "%API_URL%/movements" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"movement_type_id\":\"mvt001\",\"component_id\":\"comp001\",\"quantity\":10,\"unit_cost\":150,\"reference_number\":\"TEST-PRICE-001\",\"notes\":\"Prueba actualizacion de precio\"}"
echo.
echo.

timeout /t 2 /nobreak > nul

echo 3. Verificando el precio actualizado del componente...
curl -s -X GET "%API_URL%/components?code=COMP001" ^
  -H "Authorization: Bearer %TOKEN%" | findstr "cost_price"
echo.

echo 4. Creando movimiento de INGRESO con precio menor (no debe actualizar)...
echo    - Precio unitario: 50 (menor al actual, no debe cambiar)
curl -X POST "%API_URL%/movements" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"movement_type_id\":\"mvt001\",\"component_id\":\"comp001\",\"quantity\":5,\"unit_cost\":50,\"reference_number\":\"TEST-PRICE-002\",\"notes\":\"Prueba con precio menor\"}"
echo.
echo.

timeout /t 2 /nobreak > nul

echo 5. Verificando que el precio NO cambio (debe seguir en 150)...
curl -s -X GET "%API_URL%/components?code=COMP001" ^
  -H "Authorization: Bearer %TOKEN%" | findstr "cost_price"
echo.

echo ===== Prueba completada =====
pause