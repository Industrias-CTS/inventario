#!/bin/bash

# EC2 Deployment Script for Inventario App
set -e

echo "🚀 Starting EC2 deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
echo "📦 Installing nginx..."
sudo apt install -y nginx

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create web directory
echo "📁 Setting up web directory..."
sudo mkdir -p /var/www/html
sudo chown -R $USER:$USER /var/www/html

# Copy and configure nginx with HTTP-only first
echo "⚙️ Configuring nginx (HTTP-only initially)..."
sudo tee /etc/nginx/sites-available/inventario > /dev/null <<EOF
server {
    listen 80;
    server_name 34.198.163.51;
    
    location / {
        root /var/www/html;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/inventario /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t

# Build frontend
if [ -d "inventory-app/frontend" ]; then
    echo "🏗️ Building frontend..."
    cd inventory-app/frontend
    npm install
    npm run build
    
    # Copy build to nginx directory
    echo "📋 Copying build files..."
    sudo cp -r build/* /var/www/html/
    cd ../..
elif [ -f "package.json" ]; then
    echo "🏗️ Building frontend (fallback)..."
    npm install
    npm run build
    
    # Copy build to nginx directory
    echo "📋 Copying build files..."
    sudo cp -r build/* /var/www/html/ || sudo cp -r dist/* /var/www/html/
fi

# Start backend with PM2
if [ -d "inventory-app/backend" ]; then
    echo "🚀 Starting backend with PM2..."
    cd inventory-app/backend
    
    # Build TypeScript backend if needed
    if [ -f "tsconfig.json" ]; then
        echo "🔨 Building TypeScript backend..."
        npm install
        npm run build 2>/dev/null || npx tsc 2>/dev/null || echo "⚠️ TypeScript build failed, trying to start directly"
    fi
    
    # Find and start backend file
    if [ -f "dist/index.js" ]; then
        pm2 start dist/index.js --name "inventario-backend"
    elif [ -f "src/index.ts" ]; then
        pm2 start src/index.ts --name "inventario-backend" --interpreter="npx" --interpreter-args="ts-node"
    elif [ -f "server.js" ]; then
        pm2 start server.js --name "inventario-backend"
    elif [ -f "index.js" ]; then
        pm2 start index.js --name "inventario-backend"
    else
        echo "⚠️ Backend file not found in inventory-app/backend"
    fi
    
    pm2 startup
    pm2 save
    cd ../..
elif [ -f "server.js" ] || [ -f "index.js" ] || [ -f "app.js" ]; then
    echo "🚀 Starting backend with PM2 (fallback)..."
    BACKEND_FILE=$(ls server.js index.js app.js 2>/dev/null | head -1)
    pm2 start $BACKEND_FILE --name "inventario-backend"
    pm2 startup
    pm2 save
fi

# Start nginx
echo "🔄 Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw allow 3001
sudo ufw allow 80
sudo ufw allow 443
echo "y" | sudo ufw enable

# Keep HTTP-only configuration (no SSL for IP addresses)
echo "✅ Using HTTP-only configuration"

echo "✅ Deployment completed!"

echo "🌐 Your app is accessible at: http://34.198.163.51"
echo "📊 Backend API available at: http://34.198.163.51/api"
echo ""
echo "📝 Useful commands:"
echo "  - Check nginx status: sudo systemctl status nginx"
echo "  - Check PM2 processes: pm2 list"
echo "  - View nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "  - Restart nginx: sudo systemctl restart nginx"