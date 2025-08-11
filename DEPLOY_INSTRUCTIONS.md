# Instrucciones para Actualizar el Servidor AWS

## 📋 Resumen de Cambios
Se implementó la actualización automática de precios en los movimientos de inventario. Cuando se realiza un ingreso (entrada) con un precio unitario mayor al actual del componente, el sistema actualizará automáticamente el `cost_price` del componente.

## 🚀 Pasos para Actualizar el Servidor

### 1. Conectar al servidor AWS
```bash
ssh -i tu_clave_privada.pem ec2-user@tu-servidor-aws.com
# O usando la IP del servidor:
# ssh -i tu_clave_privada.pem ec2-user@34.198.163.51
```

### 2. Navegar al directorio del proyecto
```bash
cd /path/to/inventario
# O donde esté ubicado el proyecto en el servidor
```

### 3. Detener los servicios actuales
```bash
# Detener el servicio del backend
sudo systemctl stop inventario-backend
# O si está corriendo con PM2:
pm2 stop inventario-backend

# Detener el servicio del frontend (si aplica)
sudo systemctl stop nginx
# O si está en un puerto específico:
pm2 stop inventario-frontend
```

### 4. Obtener los últimos cambios
```bash
git fetch origin
git pull origin main
```

### 5. Actualizar dependencias (si es necesario)
```bash
# Backend
cd inventory-app/backend
npm install

# Frontend (si hay nuevas dependencias)
cd ../frontend
npm install
```

### 6. Compilar el proyecto
```bash
# Backend
cd inventory-app/backend
npm run build

# Frontend (ya está compilado, pero si es necesario)
cd ../frontend
npm run build
```

### 7. Reiniciar los servicios
```bash
# Reiniciar backend
sudo systemctl start inventario-backend
sudo systemctl status inventario-backend

# O si usa PM2:
pm2 restart inventario-backend
pm2 status

# Reiniciar frontend/nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

### 8. Verificar que todo funciona
```bash
# Verificar que el backend responde
curl http://localhost:3001/health

# Verificar logs del backend
sudo journalctl -u inventario-backend -f
# O con PM2:
pm2 logs inventario-backend

# Verificar logs de nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9. Probar la funcionalidad
1. Acceder a la aplicación desde el navegador
2. Hacer login como administrador
3. Crear un movimiento de tipo "entrada" con un precio mayor al actual de un componente
4. Verificar que el precio del componente se actualiza correctamente

## 📁 Archivos Modificados
- `inventory-app/backend/src/controllers/movements.controller.ts` - Lógica de actualización de precios
- `inventory-app/backend/src/routes/movements.routes.ts` - Validación actualizada
- `inventory-app/backend/dist/` - Archivos compilados del backend
- `inventory-app/frontend/build/` - Archivos compilados del frontend

## 🔍 Troubleshooting

### Si el backend no inicia:
```bash
# Verificar logs
sudo journalctl -u inventario-backend -n 50

# Verificar que el puerto no esté en uso
sudo netstat -tlnp | grep :3001

# Verificar permisos de archivos
ls -la inventory-app/backend/dist/
```

### Si hay problemas con la base de datos:
```bash
# Verificar que el archivo de base de datos existe y tiene permisos
ls -la inventory-app/backend/data/inventory.db

# Si es necesario, reinicializar la base de datos
cd inventory-app/backend
node init-database.js
```

### Si el frontend no carga:
```bash
# Verificar configuración de nginx
sudo nginx -t

# Reiniciar nginx
sudo systemctl restart nginx

# Verificar que los archivos build están presentes
ls -la inventory-app/frontend/build/
```

## 📝 Notas Importantes
- La nueva funcionalidad es retrocompatible
- No se requieren cambios en la base de datos
- Los movimientos existentes no se ven afectados
- Solo se actualiza el precio cuando el nuevo precio es mayor al actual
- La funcionalidad aplica tanto para movimientos individuales como para facturas

## 🎯 Commit Hash
**2f82ff771** - Fix price update in component movements - Auto-update cost_price on entries