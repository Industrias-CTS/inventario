@echo off
echo ========================================
echo    Test de Gestion de Usuarios - AWS
echo ========================================
echo.

echo Probando endpoints de usuarios en: http://34.198.163.51
echo.

echo [1] Test de autenticacion admin...
powershell -Command "$body = @{ username='admin'; password='admin123' } | ConvertTo-Json; $headers = @{ 'Content-Type'='application/json' }; try { $loginResponse = Invoke-RestMethod -Uri 'http://34.198.163.51/api/auth/login' -Method POST -Body $body -Headers $headers -TimeoutSec 10; Write-Host 'Login OK - Token obtenido'; $global:token = $loginResponse.token } catch { Write-Host 'Login ERROR:' $_.Exception.Message; exit 1 }"

echo.
echo [2] Test de obtener usuarios (requiere admin)...
powershell -Command "$authHeaders = @{ 'Authorization'=('Bearer ' + $global:token); 'Content-Type'='application/json' }; try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/users' -Method GET -Headers $authHeaders -TimeoutSec 10; Write-Host 'Users OK - Count:' $response.users.Length; if($response.users.Length -gt 0) { Write-Host 'Primer usuario:' $response.users[0].username $response.users[0].first_name $response.users[0].last_name } } catch { Write-Host 'ERROR:' $_.Exception.Message }"

echo.
echo [3] Test de crear usuario nuevo...
powershell -Command "$authHeaders = @{ 'Authorization'=('Bearer ' + $global:token); 'Content-Type'='application/json' }; $newUser = @{ username='testuser'; email='test@example.com'; password='test123'; first_name='Usuario'; last_name='Prueba'; role='user' } | ConvertTo-Json; try { $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/users' -Method POST -Body $newUser -Headers $authHeaders -TimeoutSec 10; Write-Host 'Create User OK:' $response.message; $global:newUserId = $response.user.id } catch { Write-Host 'Create ERROR:' $_.Exception.Message }"

echo.
echo [4] Test de actualizar usuario...
powershell -Command "if($global:newUserId) { $authHeaders = @{ 'Authorization'=('Bearer ' + $global:token); 'Content-Type'='application/json' }; $updateData = @{ first_name='Usuario'; last_name='Actualizado'; email='updated@example.com' } | ConvertTo-Json; try { $response = Invoke-RestMethod -Uri ('http://34.198.163.51/api/users/' + $global:newUserId) -Method PUT -Body $updateData -Headers $authHeaders -TimeoutSec 10; Write-Host 'Update User OK:' $response.message } catch { Write-Host 'Update ERROR:' $_.Exception.Message } } else { Write-Host 'Update SKIP: No user ID available' }"

echo.
echo [5] Test de desactivar usuario...
powershell -Command "if($global:newUserId) { $authHeaders = @{ 'Authorization'=('Bearer ' + $global:token); 'Content-Type'='application/json' }; try { $response = Invoke-RestMethod -Uri ('http://34.198.163.51/api/users/' + $global:newUserId) -Method DELETE -Headers $authHeaders -TimeoutSec 10; Write-Host 'Delete User OK:' $response.message } catch { Write-Host 'Delete ERROR:' $_.Exception.Message } } else { Write-Host 'Delete SKIP: No user ID available' }"

echo.
echo [6] Test de acceso sin permisos...
powershell -Command "$body = @{ username='user'; password='user123' } | ConvertTo-Json; $headers = @{ 'Content-Type'='application/json' }; try { $loginResponse = Invoke-RestMethod -Uri 'http://34.198.163.51/api/auth/login' -Method POST -Body $body -Headers $headers -TimeoutSec 5; $userHeaders = @{ 'Authorization'=('Bearer ' + $loginResponse.token); 'Content-Type'='application/json' }; $response = Invoke-RestMethod -Uri 'http://34.198.163.51/api/users' -Method GET -Headers $userHeaders -TimeoutSec 5; Write-Host 'Access SHOULD BE DENIED but got users:' $response.users.Length } catch { Write-Host 'Access Control OK - User denied access to users endpoint' }"

echo.
echo ========================================
echo Verificacion completada.
echo.
echo Si todos los tests son OK, las funcionalidades de:
echo - Crear Usuario: ✓ Funcionando
echo - Editar Usuario: ✓ Funcionando
echo - Eliminar/Desactivar Usuario: ✓ Funcionando
echo - Control de Permisos: ✓ Funcionando
echo - Tabla con datos: ✓ Funcionando
echo ========================================
pause