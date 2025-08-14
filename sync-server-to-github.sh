#!/bin/bash

# Script para sincronizar codigo del servidor con GitHub
# Ejecutar EN EL SERVIDOR AWS

echo "=== Sincronizando codigo del servidor con GitHub ==="

# Configurar git si no esta configurado
if ! git config user.email > /dev/null 2>&1; then
    echo "Configurando Git..."
    git config --global user.email "tu-email@example.com"
    git config --global user.name "Tu Nombre"
fi

# Ir al directorio de la aplicacion
cd /var/www/inventory || cd /home/ubuntu/inventory-app || {
    echo "❌ No se encontro el directorio de la aplicacion"
    echo "Directorios disponibles:"
    ls -la /var/www/
    ls -la /home/ubuntu/
    exit 1
}

# Inicializar git si no existe
if [ ! -d ".git" ]; then
    echo ">>> Inicializando repositorio Git"
    git init
    
    # Crear .gitignore
    cat > .gitignore << 'EOF'
# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build
dist/
build/

# Database
*.db
*.sqlite
*.sqlite3

# Logs
logs/
*.log

# Environment
.env
.env.local
.env.production

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Backups
*.backup
*.bak

# PM2
ecosystem.config.js
EOF
fi

# Agregar todos los archivos
echo ">>> Preparando archivos para commit"
git add -A

# Crear commit con fecha actual
git commit -m "Backup del servidor - $(date +%Y-%m-%d_%H:%M:%S)" || {
    echo "No hay cambios para commitear"
}

# Opcion A: Crear nuevo repositorio en GitHub (requiere GitHub CLI)
echo ""
echo "=== OPCION A: Crear nuevo repo en GitHub ==="
echo "1. Instala GitHub CLI si no lo tienes:"
echo "   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg"
echo "   echo 'deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main' | sudo tee /etc/apt/sources.list.d/github-cli.list"
echo "   sudo apt update && sudo apt install gh"
echo ""
echo "2. Autenticate: gh auth login"
echo "3. Crear repo: gh repo create inventory-aws --private --source=. --remote=origin --push"

echo ""
echo "=== OPCION B: Usar repositorio existente ==="
echo "1. Agrega el remote:"
echo "   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git"
echo "2. Push al repo:"
echo "   git push -u origin main --force"

echo ""
echo "=== OPCION C: Crear bundle para descargar ==="
git bundle create inventory-backup-$(date +%Y%m%d).bundle --all
echo "✅ Bundle creado: inventory-backup-*.bundle"
echo "Descarga con: scp ubuntu@34.198.163.51:~/inventory-backup-*.bundle ."