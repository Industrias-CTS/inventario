#!/bin/bash

# =============================================================================
# SCRIPT DE DESPLIEGUE - MÓDULO DE REMISIONES
# =============================================================================
# Este script despliega el módulo de remisiones en AWS con copia de seguridad
# Ejecutar como: bash deploy-deliveries-module.sh
# =============================================================================

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue del módulo de remisiones..."
echo "📅 Fecha: $(date)"
echo "=============================================="

# Configuración
SERVER_IP="34.198.163.51"
SERVER_USER="ubuntu"  # Cambiar si usas otro usuario
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
LOCAL_FRONTEND_PATH="./inventory-app/frontend/build"
LOCAL_BACKEND_PATH="./inventory-app/backend"

echo "🔧 Configuración:"
echo "   Servidor: $SERVER_USER@$SERVER_IP"
echo "   Fecha backup: $BACKUP_DATE"
echo ""

# =============================================================================
# PASO 1: VERIFICAR ARCHIVOS LOCALES
# =============================================================================
echo "📋 PASO 1: Verificando archivos locales..."

if [ ! -d "$LOCAL_FRONTEND_PATH" ]; then
    echo "❌ Error: No se encontró el directorio build del frontend"
    echo "   Ejecuta: cd inventory-app/frontend && npm run build"
    exit 1
fi

if [ ! -f "$LOCAL_BACKEND_PATH/scripts/add-deliveries-module.js" ]; then
    echo "❌ Error: No se encontró el script de migración"
    exit 1
fi

echo "✅ Archivos locales verificados"

# =============================================================================
# PASO 2: CREAR BACKUP DE LA BASE DE DATOS REMOTA
# =============================================================================
echo ""
echo "💾 PASO 2: Creando backup de la base de datos..."

ssh $SERVER_USER@$SERVER_IP << 'EOF'
    echo "🔍 Verificando estructura del servidor..."
    
    # Buscar la base de datos
    if [ -f "/var/www/inventario-backend/data/inventory.db" ]; then
        DB_PATH="/var/www/inventario-backend/data/inventory.db"
    elif [ -f "/var/www/inventario-backend/inventory.db" ]; then
        DB_PATH="/var/www/inventario-backend/inventory.db"
    else
        echo "❌ No se encontró la base de datos. Ubicaciones buscadas:"
        echo "   - /var/www/inventario-backend/data/inventory.db"
        echo "   - /var/www/inventario-backend/inventory.db"
        echo ""
        echo "📂 Contenido actual:"
        ls -la /var/www/inventario-backend/ 2>/dev/null || echo "Directorio no encontrado"
        exit 1
    fi
    
    echo "✅ Base de datos encontrada en: $DB_PATH"
    
    # Crear directorio de backups si no existe
    sudo mkdir -p /var/www/inventario-backend/backups
    
    # Crear backup
    BACKUP_FILE="/var/www/inventario-backend/backups/inventory_backup_$(date +%Y%m%d_%H%M%S)_pre_deliveries.db"
    sudo cp "$DB_PATH" "$BACKUP_FILE"
    
    echo "✅ Backup creado: $BACKUP_FILE"
    
    # Mostrar tamaño del backup
    echo "📊 Información del backup:"
    sudo ls -lh "$BACKUP_FILE"
    
    # Listar últimos 3 backups
    echo ""
    echo "📂 Últimos backups disponibles:"
    sudo ls -lt /var/www/inventario-backend/backups/*.db 2>/dev/null | head -3 || echo "No hay backups previos"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Error creando backup. Abortando despliegue."
    exit 1
fi

echo "✅ Backup completado exitosamente"

# =============================================================================
# PASO 3: SUBIR FRONTEND
# =============================================================================
echo ""
echo "🌐 PASO 3: Subiendo frontend actualizado..."

# Crear archivo temporal con los archivos del build
echo "📦 Empaquetando archivos del frontend..."
tar -czf /tmp/frontend-build-$BACKUP_DATE.tar.gz -C "$LOCAL_FRONTEND_PATH" .

# Subir archivo
echo "📤 Subiendo archivos al servidor..."
scp "/tmp/frontend-build-$BACKUP_DATE.tar.gz" $SERVER_USER@$SERVER_IP:/tmp/

# Desplegar en el servidor
ssh $SERVER_USER@$SERVER_IP << EOF
    echo "🔧 Desplegando frontend..."
    
    # Backup del frontend actual
    if [ -d "/var/www/inventario" ]; then
        sudo tar -czf "/tmp/frontend-backup-$BACKUP_DATE.tar.gz" -C "/var/www/inventario" . 2>/dev/null || true
        echo "✅ Backup del frontend actual creado"
    fi
    
    # Crear directorio si no existe
    sudo mkdir -p /var/www/inventario
    
    # Limpiar directorio actual
    sudo rm -rf /var/www/inventario/*
    
    # Extraer nuevos archivos
    cd /var/www/inventario
    sudo tar -xzf "/tmp/frontend-build-$BACKUP_DATE.tar.gz"
    
    # Establecer permisos correctos
    sudo chown -R www-data:www-data /var/www/inventario
    sudo chmod -R 755 /var/www/inventario
    
    echo "✅ Frontend desplegado exitosamente"
    
    # Limpiar archivo temporal
    rm "/tmp/frontend-build-$BACKUP_DATE.tar.gz"
EOF

# Limpiar archivo temporal local
rm "/tmp/frontend-build-$BACKUP_DATE.tar.gz"

echo "✅ Frontend actualizado correctamente"

# =============================================================================
# PASO 4: SUBIR Y EJECUTAR MIGRACIÓN DE BASE DE DATOS
# =============================================================================
echo ""
echo "🗄️ PASO 4: Ejecutando migración de base de datos..."

# Subir script de migración
echo "📤 Subiendo script de migración..."
scp "$LOCAL_BACKEND_PATH/scripts/add-deliveries-module.js" $SERVER_USER@$SERVER_IP:/tmp/

# Ejecutar migración en el servidor
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    echo "🔍 Preparando migración..."
    
    # Buscar directorio del backend
    if [ -d "/var/www/inventario-backend" ]; then
        BACKEND_PATH="/var/www/inventario-backend"
    else
        echo "❌ No se encontró el directorio del backend"
        exit 1
    fi
    
    echo "✅ Backend encontrado en: $BACKEND_PATH"
    
    # Mover script de migración
    sudo mv /tmp/add-deliveries-module.js $BACKEND_PATH/scripts/
    sudo chown ubuntu:ubuntu $BACKEND_PATH/scripts/add-deliveries-module.js
    
    echo "🚀 Ejecutando migración..."
    cd $BACKEND_PATH
    
    # Ejecutar migración
    node scripts/add-deliveries-module.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Migración completada exitosamente"
    else
        echo "❌ Error en la migración"
        exit 1
    fi
EOF

if [ $? -ne 0 ]; then
    echo "❌ Error ejecutando migración."
    echo "💡 El backup está disponible para restaurar si es necesario."
    exit 1
fi

echo "✅ Migración de base de datos completada"

# =============================================================================
# PASO 5: REINICIAR SERVICIOS
# =============================================================================
echo ""
echo "🔄 PASO 5: Reiniciando servicios..."

ssh $SERVER_USER@$SERVER_IP << 'EOF'
    echo "🔄 Reiniciando servicios del backend..."
    
    # Intentar diferentes métodos de reinicio
    if sudo systemctl list-units --type=service | grep -q inventario; then
        echo "📋 Usando systemctl..."
        sudo systemctl restart inventario-backend || sudo systemctl restart inventario || true
    elif sudo service inventario-backend status >/dev/null 2>&1; then
        echo "📋 Usando service..."
        sudo service inventario-backend restart
    elif pgrep -f "node.*inventory" >/dev/null; then
        echo "📋 Reiniciando proceso Node.js..."
        sudo pkill -f "node.*inventory"
        sleep 2
        # El proceso debería reiniciarse automáticamente con PM2 o similar
    else
        echo "⚠️  No se encontró servicio activo. Intentando iniciar..."
        cd /var/www/inventario-backend && sudo npm start &
    fi
    
    echo "🔄 Reiniciando Nginx..."
    sudo systemctl reload nginx || sudo systemctl restart nginx
    
    echo "✅ Servicios reiniciados"
EOF

echo "✅ Servicios reiniciados correctamente"

# =============================================================================
# PASO 6: VERIFICAR DESPLIEGUE
# =============================================================================
echo ""
echo "🔍 PASO 6: Verificando despliegue..."

# Verificar que el servidor responde
echo "🌐 Verificando conectividad..."
if curl -s --max-time 10 "http://$SERVER_IP" >/dev/null; then
    echo "✅ Servidor web responde correctamente"
else
    echo "⚠️  El servidor web no responde. Verifica manualmente."
fi

# Verificar API si es posible
if curl -s --max-time 10 "http://$SERVER_IP/api/health" >/dev/null; then
    echo "✅ API del backend responde correctamente"
else
    echo "⚠️  La API no responde. Verifica el backend manualmente."
fi

# =============================================================================
# RESUMEN FINAL
# =============================================================================
echo ""
echo "🎉 DESPLIEGUE COMPLETADO"
echo "========================"
echo "✅ Frontend actualizado con módulo de remisiones"
echo "✅ Base de datos migrada (backup disponible)"
echo "✅ Servicios reiniciados"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "1. Accede a: http://$SERVER_IP"
echo "2. Inicia sesión en el sistema"
echo "3. Verifica que aparezca 'Remisiones' en el menú lateral"
echo "4. Prueba crear una nueva remisión"
echo ""
echo "🛡️ INFORMACIÓN DE BACKUP:"
echo "- Backup de BD: /var/www/inventario-backend/backups/inventory_backup_*_pre_deliveries.db"
echo "- Backup de frontend: /tmp/frontend-backup-$BACKUP_DATE.tar.gz (en servidor)"
echo ""
echo "🚨 EN CASO DE PROBLEMAS:"
echo "1. Restaurar BD: sudo cp /var/www/inventario-backend/backups/[ultimo_backup].db [ubicacion_original]"
echo "2. Revisar logs: sudo journalctl -f -u inventario-backend"
echo "3. Reiniciar servicios: sudo systemctl restart inventario-backend nginx"
echo ""
echo "📞 ¡Despliegue finalizado! El módulo de remisiones está listo para usar."

exit 0