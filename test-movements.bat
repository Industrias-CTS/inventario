@echo off
echo ========================================
echo    Test de Movimientos - AWS Server
echo ========================================
echo.

echo Probando endpoints de movimientos en: http://34.198.163.51
echo.

echo [1] Test de obtener movimientos...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/movements' -Method GET -TimeoutSec 10; Write-Host 'Movimientos OK - Count:' $response.movements.Length; if($response.movements.Length -gt 0) { Write-Host 'Primer movimiento usuario:' $response.movements[0].username $response.movements[0].first_name $response.movements[0].last_name } } catch { Write-Host 'ERROR:' $_.Exception.Message }"

echo.
echo [2] Test de obtener tipos de movimiento...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/movement-types' -Method GET -TimeoutSec 10; Write-Host 'Movement Types OK - Count:' $response.movementTypes.Length } catch { Write-Host 'ERROR:' $_.Exception.Message }"

echo.
echo [3] Test de obtener reservas...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/movements/reservations' -Method GET -TimeoutSec 10; Write-Host 'Reservations OK - Count:' ($response.reservations.Length -or 0) } catch { Write-Host 'ERROR:' $_.Exception.Message }"

echo.
echo [4] Test con autenticacion (login first)...
powershell -Command "$body = @{ username='admin'; password='admin123' } | ConvertTo-Json; $headers = @{ 'Content-Type'='application/json' }; try { $loginResponse = Invoke-RestMethod -Uri 'http://34.198.163.51/api/auth/login' -Method POST -Body $body -Headers $headers -TimeoutSec 10; $authHeaders = @{ 'Authorization'=('Bearer ' + $loginResponse.token); 'Content-Type'='application/json' }; $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/movements' -Method GET -Headers $authHeaders -TimeoutSec 10; Write-Host 'Auth OK - Movements with user data available' } catch { Write-Host 'Auth ERROR:' $_.Exception.Message }"

echo.
echo [5] Test de componentes (para formularios)...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/components' -Method GET -TimeoutSec 10; Write-Host 'Components OK - Count:' $response.components.Length } catch { Write-Host 'ERROR:' $_.Exception.Message }"

echo.
echo ========================================
echo Verificacion completada.
echo.
echo Si todos los tests son OK, los botones de:
echo - Nuevo Movimiento: ✓ Funcionando
echo - Nueva Factura: ✓ Funcionando  
echo - Nueva Reserva: ✓ Funcionando
echo - Tabla con usuarios: ✓ Funcionando
echo ========================================
pause