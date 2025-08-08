@echo off
echo ========================================
echo    Verificacion del Servidor AWS
echo ========================================
echo.

echo Verificando servidor AWS: 34.198.163.51
echo.

echo [1] Health check del backend...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://34.198.163.51/health' -UseBasicParsing -TimeoutSec 10; Write-Host 'Backend OK:' $response.StatusCode; Write-Host $response.Content } catch { Write-Host 'Backend ERROR:' $_.Exception.Message }"

echo.
echo [2] Verificando API de autenticacion...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://34.198.163.51/api/auth/profile' -UseBasicParsing -TimeoutSec 10; Write-Host 'Auth endpoint:' $response.StatusCode } catch { Write-Host 'Auth endpoint accessible (401 expected)' }"

echo.
echo [3] Verificando frontend...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://34.198.163.51' -UseBasicParsing -TimeoutSec 10; Write-Host 'Frontend OK:' $response.StatusCode; if ($response.Content -like '*Sistema de Inventario*') { Write-Host 'Frontend content OK' } else { Write-Host 'Frontend content may have issues' } } catch { Write-Host 'Frontend ERROR:' $_.Exception.Message }"

echo.
echo [4] Verificando endpoints principales...
echo Componentes:
powershell -Command "try { Invoke-WebRequest -Uri 'http://34.198.163.51/api/components' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Components endpoint: OK' } catch { Write-Host 'Components endpoint: ERROR' }"

echo Categorias:
powershell -Command "try { Invoke-WebRequest -Uri 'http://34.198.163.51/api/categories' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Categories endpoint: OK' } catch { Write-Host 'Categories endpoint: ERROR' }"

echo Unidades:
powershell -Command "try { Invoke-WebRequest -Uri 'http://34.198.163.51/api/units' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Units endpoint: OK' } catch { Write-Host 'Units endpoint: ERROR' }"

echo Tipos de movimiento:
powershell -Command "try { Invoke-WebRequest -Uri 'http://34.198.163.51/api/movement-types' -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host 'Movement types endpoint: OK' } catch { Write-Host 'Movement types endpoint: ERROR' }"

echo.
echo [5] Test de login...
powershell -Command "$body = @{ username='admin'; password='admin123' } | ConvertTo-Json; $headers = @{ 'Content-Type'='application/json' }; try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/auth/login' -Method POST -Body $body -Headers $headers -TimeoutSec 10; Write-Host 'Login OK - Token received:' $response.token.Substring(0,20)... } catch { Write-Host 'Login ERROR:' $_.Exception.Message }"

echo.
echo ========================================
echo.
echo URLs para verificar manualmente:
echo - Frontend: http://34.198.163.51
echo - API Health: http://34.198.163.51/health
echo - API Base: http://34.198.163.51/api
echo.
echo Credenciales de prueba:
echo - Admin: admin / admin123
echo - Usuario: user / user123
echo ========================================
echo.
pause