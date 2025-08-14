#!/bin/bash

# Script para sincronizar cambios del servidor AWS con GitHub
# Ejecutar en el servidor: bash sync-aws-github.sh

echo "=== Sincronizando proyecto con GitHub ==="
echo "Repositorio: Industrias-CTS/inventario"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d ".git" ]; then
    echo "❌ No estás en un repositorio Git"
    echo "Cambiando a /home/ubuntu/inventario..."
    cd /home/ubuntu/inventario || exit 1
fi

# Mostrar estado actual
echo "📊 Estado actual del repositorio:"
git status

# Preguntar si continuar
read -p "¿Deseas agregar y subir todos los cambios? (s/n): " confirm
if [ "$confirm" != "s" ]; then
    echo "Cancelado"
    exit 0
fi

# Agregar archivos
echo ""
echo "📝 Agregando archivos..."
git add .

# Mostrar cambios a commitear
echo ""
echo "Cambios a incluir:"
git status --short

# Crear commit
echo ""
read -p "Mensaje del commit (Enter para usar fecha): " msg
if [ -z "$msg" ]; then
    msg="Update from AWS server - $(date +%Y-%m-%d_%H:%M)"
fi

git commit -m "$msg"

# Intentar push
echo ""
echo "📤 Subiendo a GitHub..."
if git push origin main; then
    echo "✅ Cambios subidos exitosamente"
else
    echo ""
    echo "❌ Error al hacer push. Posibles soluciones:"
    echo ""
    echo "1. Si es error de autenticación SSH:"
    echo "   ssh-keygen -t ed25519 -C 'email@example.com'"
    echo "   cat ~/.ssh/id_ed25519.pub"
    echo "   # Agregar la clave en: https://github.com/settings/keys"
    echo ""
    echo "2. Cambiar a HTTPS con token:"
    echo "   git remote set-url origin https://github.com/Industrias-CTS/inventario.git"
    echo "   # Generar token en: https://github.com/settings/tokens"
    echo "   git push origin main"
    echo "   # Usar token como contraseña"
    echo ""
    echo "3. Si hay cambios remotos:"
    echo "   git pull origin main --rebase"
    echo "   git push origin main"
fi

echo ""
echo "📥 Para clonar en tu PC local:"
echo "git clone https://github.com/Industrias-CTS/inventario.git"