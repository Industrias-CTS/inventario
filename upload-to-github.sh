#!/bin/bash

# Script automatizado para subir proyecto a GitHub desde servidor AWS
# Uso: bash upload-to-github.sh [nombre-repo] [usuario-github]

REPO_NAME=${1:-inventario-aws}
GITHUB_USER=${2:-tu-usuario}

echo "=== Subiendo proyecto a GitHub ==="
echo "Repositorio: $REPO_NAME"
echo "Usuario: $GITHUB_USER"
echo ""

# Buscar directorio del proyecto
if [ -d "/var/www/inventory" ]; then
    PROJECT_DIR="/var/www/inventory"
elif [ -d "/home/ubuntu/inventory-app" ]; then
    PROJECT_DIR="/home/ubuntu/inventory-app"
else
    echo "❌ No se encontró el directorio del proyecto"
    exit 1
fi

cd $PROJECT_DIR
echo "📁 Trabajando en: $PROJECT_DIR"

# Configurar Git si no está configurado
if ! git config user.name > /dev/null 2>&1; then
    echo "Configurando Git..."
    read -p "Ingresa tu nombre: " git_name
    read -p "Ingresa tu email: " git_email
    git config --global user.name "$git_name"
    git config --global user.email "$git_email"
fi

# Inicializar Git
if [ ! -d ".git" ]; then
    echo "Inicializando repositorio Git..."
    git init
fi

# Crear .gitignore completo
echo "Creando .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
bower_components/

# Build outputs
dist/
build/
*.bundle.js
*.bundle.css

# Databases
*.db
*.sqlite
*.sqlite3
data/*.db

# Environment variables
.env
.env.local
.env.production
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS files
.DS_Store
Thumbs.db
*.swp
*.swo

# IDE
.vscode/
.idea/
*.sublime-*

# PM2
ecosystem.config.js
.pm2/

# Backups
*.backup
*.bak
backup/

# Temporary files
tmp/
temp/
*.tmp

# Certificates (por seguridad)
*.pem
*.key
*.crt
*.cer

# Nginx configs con datos sensibles
nginx-configs/
EOF

# Agregar archivos al staging
echo "Agregando archivos..."
git add -A

# Ver estado
echo ""
echo "Archivos a incluir:"
git status --short

# Crear commit
echo ""
read -p "Mensaje del commit (Enter para mensaje por defecto): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Initial commit from AWS server - $(date +%Y-%m-%d)"
fi
git commit -m "$commit_msg"

# Configurar rama principal
git branch -M main

echo ""
echo "=== Opciones para subir a GitHub ==="
echo ""
echo "1) Usar GitHub CLI (recomendado)"
echo "2) Usar HTTPS con token"
echo "3) Generar comandos para ejecutar manualmente"
echo ""
read -p "Selecciona opción (1-3): " option

case $option in
    1)
        # Verificar si gh está instalado
        if ! command -v gh &> /dev/null; then
            echo "Instalando GitHub CLI..."
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list
            sudo apt update && sudo apt install gh -y
        fi
        
        echo "Autenticándote en GitHub..."
        gh auth login
        
        echo "Creando repositorio y subiendo..."
        gh repo create $REPO_NAME --private --source=. --remote=origin --push
        ;;
        
    2)
        echo ""
        echo "Necesitarás un token de GitHub:"
        echo "1. Ve a https://github.com/settings/tokens"
        echo "2. Genera un nuevo token con permisos 'repo'"
        echo ""
        read -p "Ingresa tu token de GitHub: " github_token
        
        # Configurar remote con token
        git remote add origin https://$github_token@github.com/$GITHUB_USER/$REPO_NAME.git
        
        echo "Subiendo a GitHub..."
        git push -u origin main
        ;;
        
    3)
        echo ""
        echo "Ejecuta estos comandos:"
        echo ""
        echo "# 1. Crea un nuevo repositorio en https://github.com/new"
        echo "# 2. Luego ejecuta:"
        echo ""
        echo "git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
        echo "git push -u origin main"
        echo ""
        echo "# Si pide credenciales, usa tu usuario y un token personal"
        echo "# Genera token en: https://github.com/settings/tokens"
        ;;
esac

echo ""
echo "✅ Proceso completado"
echo ""
echo "Para clonar en tu PC local:"
echo "git clone https://github.com/$GITHUB_USER/$REPO_NAME.git"