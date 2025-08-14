#!/bin/bash

# Script para actualizar el servidor manteniendo la base de datos intacta
# Ejecutar: bash deploy-safe-update.sh

SERVER_IP="34.198.163.51"
SERVER_USER="ubuntu"

echo "=== Deployment Seguro - Manteniendo Base de Datos ==="
echo "Servidor: $SERVER_USER@$SERVER_IP"
echo ""

# Verificar conexión
if ! ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'Conexión exitosa'" 2>/dev/null; then
    echo "❌ Error: No se puede conectar al servidor"
    echo "Verifica tu conexión SSH"
    exit 1
fi

echo "✅ Conexión al servidor establecida"
echo ""

# Paso 1: Hacer backup de la base de datos actual
echo "📦 PASO 1: Haciendo backup de la base de datos..."
if ! bash backup-database.sh; then
    echo "❌ Error en el backup. Abortando deployment"
    exit 1
fi

echo ""
echo "📡 PASO 2: Actualizando código en el servidor..."

# Conectar al servidor y hacer update seguro
ssh $SERVER_USER@$SERVER_IP << 'EOF'
set -e  # Salir si hay error

echo "🔍 Verificando ubicación del proyecto..."

# Ir al directorio del proyecto
if [ -d "/home/ubuntu/inventario" ]; then
    cd /home/ubuntu/inventario
    echo "📁 Trabajando en: /home/ubuntu/inventario"
elif [ -d "/var/www/inventory" ]; then
    cd /var/www/inventory  
    echo "📁 Trabajando en: /var/www/inventory"
else
    echo "❌ No se encontró el directorio del proyecto"
    exit 1
fi

# Verificar que es un repositorio Git
if [ ! -d ".git" ]; then
    echo "❌ No es un repositorio Git válido"
    exit 1
fi

echo ""
echo "💾 Haciendo backup de archivos críticos..."

# Backup de la base de datos local antes de pull
DB_FILES=$(find . -name "*.db" -type f 2>/dev/null || true)
if [ ! -z "$DB_FILES" ]; then
    echo "🔒 Creando backup temporal de bases de datos:"
    mkdir -p /tmp/db_backup_$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="/tmp/db_backup_$(date +%Y%m%d_%H%M%S)"
    
    for db_file in $DB_FILES; do
        echo "  - $db_file"
        cp "$db_file" "$BACKUP_DIR/"
    done
    echo "📂 Backup temporal en: $BACKUP_DIR"
else
    echo "ℹ️  No se encontraron archivos .db en el proyecto"
fi

# Backup de ecosystem.config.js si existe
if [ -f "inventory-app/backend/ecosystem.config.js" ]; then
    echo "🔒 Backing up ecosystem.config.js"
    cp inventory-app/backend/ecosystem.config.js /tmp/ecosystem.config.backup
fi

echo ""
echo "📥 Descargando cambios de GitHub..."

# Guardar cambios locales antes de pull
git status --porcelain | grep -q . && {
    echo "💾 Guardando cambios locales..."
    git stash push -m "Auto-backup before deployment $(date)"
}

# Pull cambios
git pull origin main

echo ""
echo "🔄 Restaurando archivos críticos..."

# Restaurar bases de datos
if [ ! -z "$DB_FILES" ] && [ -d "$BACKUP_DIR" ]; then
    for db_file in $DB_FILES; do
        if [ -f "$BACKUP_DIR/$(basename $db_file)" ]; then
            echo "🔙 Restaurando: $db_file"
            cp "$BACKUP_DIR/$(basename $db_file)" "$db_file"
        fi
    done
    # Limpiar backup temporal
    rm -rf "$BACKUP_DIR"
fi

# Restaurar ecosystem.config.js
if [ -f "/tmp/ecosystem.config.backup" ]; then
    echo "🔙 Restaurando ecosystem.config.js"
    cp /tmp/ecosystem.config.backup inventory-app/backend/ecosystem.config.js
    rm /tmp/ecosystem.config.backup
fi

echo ""
echo "📦 Actualizando dependencias del backend..."
cd inventory-app/backend
npm install --production

echo ""
echo "🎨 Actualizando frontend..."
cd ../frontend

# Solo copiar build si existe
if [ -d "build" ]; then
    echo "📋 Copiando archivos del frontend..."
    
    # Buscar directorio de deployment
    if [ -d "/var/www/inventory/frontend" ]; then
        FRONTEND_DIR="/var/www/inventory/frontend"
    else
        echo "⚠️  Directorio /var/www/inventory/frontend no encontrado"
        echo "Los archivos build están disponibles en: $(pwd)/build/"
        FRONTEND_DIR=""
    fi
    
    if [ ! -z "$FRONTEND_DIR" ]; then
        sudo cp -r build/* "$FRONTEND_DIR/"
        echo "✅ Frontend actualizado en $FRONTEND_DIR"
    fi
else
    echo "ℹ️  No hay directorio build, ejecuta 'npm run build' si es necesario"
fi

echo ""
echo "🔄 Reiniciando servicios..."
cd ../backend

# Reiniciar con PM2 si está disponible
if command -v pm2 > /dev/null; then
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    echo "✅ Backend reiniciado con PM2"
else
    echo "ℹ️  PM2 no disponible, reinicia manualmente si es necesario"
fi

echo ""
echo "✅ Actualización completada exitosamente"
echo "🔒 La base de datos original se mantuvo intacta"

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT EXITOSO"
    echo ""
    echo "✅ Código actualizado"
    echo "🔒 Base de datos preservada" 
    echo "📦 Servicios reiniciados"
    echo ""
    echo "🌐 Aplicación disponible en: http://$SERVER_IP"
    echo ""
    echo "Para aplicar el fix de Nginx ejecuta:"
    echo "bash deploy-nginx-fix.sh"
else
    echo ""
    echo "❌ Error en el deployment"
    echo "La base de datos no fue afectada"
fi