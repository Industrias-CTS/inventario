#!/bin/bash

# Script para hacer backup de la base de datos del servidor AWS
# Ejecutar: bash backup-database.sh

SERVER_IP="34.198.163.51"
SERVER_USER="ubuntu"

echo "=== Backup de Base de Datos del Servidor ==="
echo "Servidor: $SERVER_USER@$SERVER_IP"
echo ""

# Crear directorio local para backups
mkdir -p database-backups

# Crear timestamp para el backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="inventory_backup_$TIMESTAMP.db"

echo "📦 Creando backup de la base de datos..."

# Conectar al servidor y crear backup
ssh $SERVER_USER@$SERVER_IP << EOF
echo "Creando backup en el servidor..."

# Buscar la base de datos
if [ -f "/var/www/inventory/backend/data/inventory.db" ]; then
    DB_PATH="/var/www/inventory/backend/data/inventory.db"
elif [ -f "/home/ubuntu/inventario/inventory-app/backend/data/inventory.db" ]; then
    DB_PATH="/home/ubuntu/inventario/inventory-app/backend/data/inventory.db"
elif [ -f "/home/ubuntu/inventario/inventory-app/backend/inventory.db" ]; then
    DB_PATH="/home/ubuntu/inventario/inventory-app/backend/inventory.db"
else
    echo "❌ No se encontró la base de datos"
    find /var/www -name "*.db" -type f 2>/dev/null || echo "No se encontraron archivos .db en /var/www"
    find /home/ubuntu -name "*.db" -type f 2>/dev/null || echo "No se encontraron archivos .db en /home/ubuntu"
    exit 1
fi

echo "📁 Base de datos encontrada: \$DB_PATH"

# Crear backup con timestamp
cp "\$DB_PATH" "/tmp/$BACKUP_NAME"

# Verificar que el backup se creó correctamente
if [ -f "/tmp/$BACKUP_NAME" ]; then
    echo "✅ Backup creado: /tmp/$BACKUP_NAME"
    ls -lh "/tmp/$BACKUP_NAME"
else
    echo "❌ Error al crear el backup"
    exit 1
fi
EOF

# Verificar que el comando ssh fue exitoso
if [ $? -eq 0 ]; then
    echo ""
    echo "📥 Descargando backup a local..."
    scp $SERVER_USER@$SERVER_IP:/tmp/$BACKUP_NAME ./database-backups/
    
    if [ -f "./database-backups/$BACKUP_NAME" ]; then
        echo "✅ Backup descargado exitosamente"
        echo "📁 Ubicación: ./database-backups/$BACKUP_NAME"
        echo ""
        echo "📊 Información del backup:"
        ls -lh "./database-backups/$BACKUP_NAME"
        
        # Limpiar archivo temporal del servidor
        ssh $SERVER_USER@$SERVER_IP "rm -f /tmp/$BACKUP_NAME"
        
        echo ""
        echo "🗂️ Historial de backups:"
        ls -lah ./database-backups/
    else
        echo "❌ Error al descargar el backup"
    fi
else
    echo "❌ Error al conectar con el servidor"
fi

echo ""
echo "📝 Nota: La base de datos del servidor permanece intacta"
echo "Este backup se puede usar para restaurar si es necesario"