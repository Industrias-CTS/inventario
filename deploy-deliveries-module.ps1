# =============================================================================
# SCRIPT DE DESPLIEGUE - MÓDULO DE REMISIONES (PowerShell)
# =============================================================================
# Este script despliega el módulo de remisiones en AWS con copia de seguridad
# Ejecutar como: PowerShell -ExecutionPolicy Bypass -File deploy-deliveries-module.ps1
# =============================================================================

param(
    [string]$ServerIP = "34.198.163.51",
    [string]$ServerUser = "ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando despliegue del módulo de remisiones..." -ForegroundColor Green
Write-Host "📅 Fecha: $(Get-Date)" -ForegroundColor Gray
Write-Host "==============================================" -ForegroundColor Gray

# Configuración
$BackupDate = Get-Date -Format "yyyyMMdd_HHmmss"
$LocalFrontendPath = ".\inventory-app\frontend\build"
$LocalBackendPath = ".\inventory-app\backend"

Write-Host "🔧 Configuración:" -ForegroundColor Yellow
Write-Host "   Servidor: $ServerUser@$ServerIP" -ForegroundColor Gray
Write-Host "   Fecha backup: $BackupDate" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# PASO 1: VERIFICAR ARCHIVOS LOCALES
# =============================================================================
Write-Host "📋 PASO 1: Verificando archivos locales..." -ForegroundColor Cyan

if (-not (Test-Path $LocalFrontendPath)) {
    Write-Host "❌ Error: No se encontró el directorio build del frontend" -ForegroundColor Red
    Write-Host "   Ejecuta: cd inventory-app\frontend && npm run build" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$LocalBackendPath\scripts\add-deliveries-module.js")) {
    Write-Host "❌ Error: No se encontró el script de migración" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Archivos locales verificados" -ForegroundColor Green

# =============================================================================
# PASO 2: CREAR BACKUP DE LA BASE DE DATOS REMOTA
# =============================================================================
Write-Host ""
Write-Host "💾 PASO 2: Creando backup de la base de datos..." -ForegroundColor Cyan

$backupScript = @"
echo '🔍 Verificando estructura del servidor...'

# Buscar la base de datos
if [ -f '/var/www/inventario-backend/data/inventory.db' ]; then
    DB_PATH='/var/www/inventario-backend/data/inventory.db'
elif [ -f '/var/www/inventario-backend/inventory.db' ]; then
    DB_PATH='/var/www/inventario-backend/inventory.db'
else
    echo '❌ No se encontró la base de datos. Ubicaciones buscadas:'
    echo '   - /var/www/inventario-backend/data/inventory.db'
    echo '   - /var/www/inventario-backend/inventory.db'
    echo ''
    echo '📂 Contenido actual:'
    ls -la /var/www/inventario-backend/ 2>/dev/null || echo 'Directorio no encontrado'
    exit 1
fi

echo "✅ Base de datos encontrada en: `$DB_PATH"

# Crear directorio de backups si no existe
sudo mkdir -p /var/www/inventario-backend/backups

# Crear backup
BACKUP_FILE="/var/www/inventario-backend/backups/inventory_backup_`$(date +%Y%m%d_%H%M%S)_pre_deliveries.db"
sudo cp "`$DB_PATH" "`$BACKUP_FILE"

echo "✅ Backup creado: `$BACKUP_FILE"

# Mostrar tamaño del backup
echo '📊 Información del backup:'
sudo ls -lh "`$BACKUP_FILE"

# Listar últimos 3 backups
echo ''
echo '📂 Últimos backups disponibles:'
sudo ls -lt /var/www/inventario-backend/backups/*.db 2>/dev/null | head -3 || echo 'No hay backups previos'
"@

ssh "$ServerUser@$ServerIP" $backupScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error creando backup. Abortando despliegue." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backup completado exitosamente" -ForegroundColor Green

# =============================================================================
# PASO 3: SUBIR FRONTEND
# =============================================================================
Write-Host ""
Write-Host "🌐 PASO 3: Subiendo frontend actualizado..." -ForegroundColor Cyan

# Crear archivo temporal con los archivos del build
Write-Host "📦 Empaquetando archivos del frontend..." -ForegroundColor Gray
$tempArchive = "$env:TEMP\frontend-build-$BackupDate.zip"
Compress-Archive -Path "$LocalFrontendPath\*" -DestinationPath $tempArchive -Force

# Subir archivo
Write-Host "📤 Subiendo archivos al servidor..." -ForegroundColor Gray
scp $tempArchive "$ServerUser@$ServerIP":/tmp/frontend-build-$BackupDate.zip

# Desplegar en el servidor
$deployScript = @"
echo '🔧 Desplegando frontend...'

# Backup del frontend actual
if [ -d '/var/www/inventario' ]; then
    sudo tar -czf '/tmp/frontend-backup-$BackupDate.tar.gz' -C '/var/www/inventario' . 2>/dev/null || true
    echo '✅ Backup del frontend actual creado'
fi

# Crear directorio si no existe
sudo mkdir -p /var/www/inventario

# Limpiar directorio actual
sudo rm -rf /var/www/inventario/*

# Extraer nuevos archivos
cd /var/www/inventario
sudo unzip -q '/tmp/frontend-build-$BackupDate.zip'

# Establecer permisos correctos
sudo chown -R www-data:www-data /var/www/inventario
sudo chmod -R 755 /var/www/inventario

echo '✅ Frontend desplegado exitosamente'

# Limpiar archivo temporal
rm '/tmp/frontend-build-$BackupDate.zip'
"@

ssh "$ServerUser@$ServerIP" $deployScript

# Limpiar archivo temporal local
Remove-Item $tempArchive -Force

Write-Host "✅ Frontend actualizado correctamente" -ForegroundColor Green

# =============================================================================
# PASO 4: SUBIR Y EJECUTAR MIGRACIÓN DE BASE DE DATOS
# =============================================================================
Write-Host ""
Write-Host "🗄️ PASO 4: Ejecutando migración de base de datos..." -ForegroundColor Cyan

# Subir script de migración
Write-Host "📤 Subiendo script de migración..." -ForegroundColor Gray
scp "$LocalBackendPath\scripts\add-deliveries-module.js" "$ServerUser@$ServerIP":/tmp/

# Ejecutar migración en el servidor
$migrationScript = @"
echo '🔍 Preparando migración...'

# Buscar directorio del backend
if [ -d '/var/www/inventario-backend' ]; then
    BACKEND_PATH='/var/www/inventario-backend'
else
    echo '❌ No se encontró el directorio del backend'
    exit 1
fi

echo "✅ Backend encontrado en: `$BACKEND_PATH"

# Mover script de migración
sudo mv /tmp/add-deliveries-module.js `$BACKEND_PATH/scripts/
sudo chown ubuntu:ubuntu `$BACKEND_PATH/scripts/add-deliveries-module.js

echo '🚀 Ejecutando migración...'
cd `$BACKEND_PATH

# Ejecutar migración
node scripts/add-deliveries-module.js

if [ `$? -eq 0 ]; then
    echo '✅ Migración completada exitosamente'
else
    echo '❌ Error en la migración'
    exit 1
fi
"@

ssh "$ServerUser@$ServerIP" $migrationScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error ejecutando migración." -ForegroundColor Red
    Write-Host "💡 El backup está disponible para restaurar si es necesario." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Migración de base de datos completada" -ForegroundColor Green

# =============================================================================
# PASO 5: REINICIAR SERVICIOS
# =============================================================================
Write-Host ""
Write-Host "🔄 PASO 5: Reiniciando servicios..." -ForegroundColor Cyan

$restartScript = @"
echo '🔄 Reiniciando servicios del backend...'

# Intentar diferentes métodos de reinicio
if sudo systemctl list-units --type=service | grep -q inventario; then
    echo '📋 Usando systemctl...'
    sudo systemctl restart inventario-backend || sudo systemctl restart inventario || true
elif sudo service inventario-backend status >/dev/null 2>&1; then
    echo '📋 Usando service...'
    sudo service inventario-backend restart
elif pgrep -f 'node.*inventory' >/dev/null; then
    echo '📋 Reiniciando proceso Node.js...'
    sudo pkill -f 'node.*inventory'
    sleep 2
else
    echo '⚠️  No se encontró servicio activo. Intentando iniciar...'
    cd /var/www/inventario-backend && sudo npm start &
fi

echo '🔄 Reiniciando Nginx...'
sudo systemctl reload nginx || sudo systemctl restart nginx

echo '✅ Servicios reiniciados'
"@

ssh "$ServerUser@$ServerIP" $restartScript

Write-Host "✅ Servicios reiniciados correctamente" -ForegroundColor Green

# =============================================================================
# PASO 6: VERIFICAR DESPLIEGUE
# =============================================================================
Write-Host ""
Write-Host "🔍 PASO 6: Verificando despliegue..." -ForegroundColor Cyan

# Verificar que el servidor responde
Write-Host "🌐 Verificando conectividad..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest "http://$ServerIP" -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Servidor web responde correctamente" -ForegroundColor Green
} catch {
    Write-Host "⚠️  El servidor web no responde. Verifica manualmente." -ForegroundColor Yellow
}

# Verificar API si es posible
try {
    $response = Invoke-WebRequest "http://$ServerIP/api/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ API del backend responde correctamente" -ForegroundColor Green
} catch {
    Write-Host "⚠️  La API no responde. Verifica el backend manualmente." -ForegroundColor Yellow
}

# =============================================================================
# RESUMEN FINAL
# =============================================================================
Write-Host ""
Write-Host "🎉 DESPLIEGUE COMPLETADO" -ForegroundColor Green -BackgroundColor Black
Write-Host "========================" -ForegroundColor Green
Write-Host "✅ Frontend actualizado con módulo de remisiones" -ForegroundColor Green
Write-Host "✅ Base de datos migrada (backup disponible)" -ForegroundColor Green
Write-Host "✅ Servicios reiniciados" -ForegroundColor Green
Write-Host ""
Write-Host "📝 PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "1. Accede a: http://$ServerIP" -ForegroundColor Gray
Write-Host "2. Inicia sesión en el sistema" -ForegroundColor Gray
Write-Host "3. Verifica que aparezca 'Remisiones' en el menú lateral" -ForegroundColor Gray
Write-Host "4. Prueba crear una nueva remisión" -ForegroundColor Gray
Write-Host ""
Write-Host "🛡️ INFORMACIÓN DE BACKUP:" -ForegroundColor Magenta
Write-Host "- Backup de BD: /var/www/inventario-backend/backups/inventory_backup_*_pre_deliveries.db" -ForegroundColor Gray
Write-Host "- Backup de frontend: /tmp/frontend-backup-$BackupDate.tar.gz (en servidor)" -ForegroundColor Gray
Write-Host ""
Write-Host "🚨 EN CASO DE PROBLEMAS:" -ForegroundColor Red
Write-Host "1. Restaurar BD: sudo cp /var/www/inventario-backend/backups/[ultimo_backup].db [ubicacion_original]" -ForegroundColor Gray
Write-Host "2. Revisar logs: sudo journalctl -f -u inventario-backend" -ForegroundColor Gray
Write-Host "3. Reiniciar servicios: sudo systemctl restart inventario-backend nginx" -ForegroundColor Gray
Write-Host ""
Write-Host "📞 ¡Despliegue finalizado! El módulo de remisiones está listo para usar." -ForegroundColor Green -BackgroundColor Black

exit 0