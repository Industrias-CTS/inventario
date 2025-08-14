# Instrucciones para Sincronizar Servidor AWS con Local

## 🚀 Método Rápido (Recomendado)

### Paso 1: En el servidor AWS
```bash
# Conectate al servidor
ssh ubuntu@34.198.163.51

# Crear backup completo
cd /home/ubuntu
sudo tar -czf inventory-complete.tar.gz \
  /var/www/inventory \
  /etc/nginx/sites-available \
  /etc/nginx/sites-enabled \
  /etc/nginx/nginx.conf \
  /var/log/nginx/inventory*.log

# Cambiar permisos para poder descargar
sudo chown ubuntu:ubuntu inventory-complete.tar.gz
```

### Paso 2: En tu PC local (Windows)
```bash
# Descargar el backup
scp ubuntu@34.198.163.51:~/inventory-complete.tar.gz .

# Extraer (usando Git Bash o WSL)
tar -xzf inventory-complete.tar.gz
```

## 📁 Método GitHub

### En el servidor:
```bash
# Subir script y ejecutar
scp sync-server-to-github.sh ubuntu@34.198.163.51:~/
ssh ubuntu@34.198.163.51
bash sync-server-to-github.sh
```

### Luego en local:
```bash
git clone https://github.com/tu-usuario/tu-repo.git inventario-server
```

## 🔍 Solo Configuración Nginx

### En el servidor:
```bash
# Subir y ejecutar script
scp get-nginx-config.sh ubuntu@34.198.163.51:~/
ssh ubuntu@34.198.163.51
bash get-nginx-config.sh
```

### En local:
```bash
# Descargar configuracion
scp ubuntu@34.198.163.51:~/nginx-config-*.tar.gz .
tar -xzf nginx-config-*.tar.gz
```

## 🔧 Aplicar Fix de Rate Limiting

### Opción 1: Aplicar directamente
```bash
# Subir y ejecutar fix
scp fix-nginx-aws.sh ubuntu@34.198.163.51:~/
ssh ubuntu@34.198.163.51
sudo bash fix-nginx-aws.sh
```

### Opción 2: Aplicar manualmente
```bash
# En el servidor
sudo nano /etc/nginx/sites-available/inventory
# Pegar contenido de nginx-inventory-fixed.conf

# Verificar y recargar
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 Verificar que el Fix Funcionó

```bash
# Ver logs en tiempo real
sudo tail -f /var/log/nginx/inventory_error.log

# Verificar rate limiting
curl -I http://34.198.163.51/api/auth/login

# Ver configuración activa
sudo nginx -T | grep limit_req
```

## 🆘 Si algo sale mal

```bash
# Restaurar configuración anterior
sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/inventory
sudo systemctl reload nginx

# Ver estado de servicios
sudo systemctl status nginx
sudo pm2 status
```