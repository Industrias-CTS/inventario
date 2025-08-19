# 🚀 PASOS PARA DESPLEGAR EN SERVIDOR AWS

## ✅ **CAMBIOS SUBIDOS A GITHUB**
**Commit:** `8d981391b` - "🔧 FIX: Solucionar error de path alias y compilación TypeScript"
**URL:** https://github.com/Industrias-CTS/inventario

---

## 📋 **PASOS A EJECUTAR EN EL SERVIDOR**

### **PASO 1: Conectar al Servidor**
```bash
ssh ubuntu@34.198.163.51
```

### **PASO 2: Crear Backup de Seguridad**
```bash
# Verificar ubicación actual de la base de datos
sudo find /var/www -name "inventory.db" -type f

# Crear directorio de backups
sudo mkdir -p /var/www/inventario-backend/backups

# Crear backup (ajustar ruta según la ubicación real)
sudo cp /var/www/inventario-backend/data/inventory.db \
        /var/www/inventario-backend/backups/backup_pre_remisiones_$(date +%Y%m%d_%H%M%S).db

# Verificar que el backup se creó correctamente
ls -lh /var/www/inventario-backend/backups/
```

### **PASO 3: Actualizar Código desde GitHub**
```bash
# Ir al directorio del proyecto
cd /var/www/inventario-backend

# Verificar el estado actual
git status
git log --oneline -5

# Hacer pull de los últimos cambios
git pull origin main

# Verificar que se descargaron los cambios
git log --oneline -2
```

### **PASO 4: Instalar Nueva Dependencia**
```bash
# Instalar PDFKit para generar PDFs
npm install pdfkit

# Verificar que se instaló correctamente
npm list pdfkit
```

### **PASO 5: Ejecutar Migración de Base de Datos**
```bash
# Verificar que el script de migración existe
ls -la scripts/add-deliveries-module.js

# Ejecutar la migración
node scripts/add-deliveries-module.js

# Deberías ver salida como:
# 🚀 Iniciando migración del módulo de remisiones...
# ✅ Tablas de remisiones creadas exitosamente
# ✅ Migración completada exitosamente!
```

### **PASO 6: Actualizar Frontend**
```bash
# Verificar ubicación del frontend
ls -la /var/www/inventario/

# Método 1: Si tienes el código fuente en el servidor
cd /var/www/inventario-frontend  # o donde tengas el frontend
git pull origin main
npm run build
sudo cp -r build/* /var/www/inventario/

# Método 2: Si solo tienes los archivos build
# (Necesitarás subir manualmente los archivos compilados)
```

### **PASO 7: Compilar Backend (OBLIGATORIO)**
```bash
cd /var/www/inventario-backend

# Compilar TypeScript (esto resuelve los path aliases automáticamente)
npm run build

# Deberías ver algo como:
# 🔧 Fixing TypeScript path aliases in compiled files...
# ✅ Fixed: [varios archivos]
# ✅ Path fix completed. Processed X files.

# Verificar que se compilaron los nuevos archivos
ls -la dist/controllers/
ls -la dist/routes/
```

### **PASO 8: Reiniciar Servicios**
```bash
# Reiniciar el backend (prueba estos métodos en orden)

# Método 1: SystemD
sudo systemctl restart inventario-backend
sudo systemctl status inventario-backend

# Si no funciona, Método 2:
sudo systemctl restart inventario
sudo systemctl status inventario

# Si no funciona, Método 3: PM2
pm2 restart all
pm2 status

# Si no funciona, Método 4: Service
sudo service inventario-backend restart

# Método 5: Manual (último recurso)
sudo pkill -f "node.*inventory"
sleep 2
cd /var/www/inventario-backend
nohup npm start > /tmp/inventario.log 2>&1 &

# Reiniciar Nginx
sudo systemctl reload nginx
sudo systemctl status nginx
```

### **PASO 9: Verificar Funcionamiento**
```bash
# Verificar que el backend responde
curl -I http://localhost:3001/api/health

# Verificar que Nginx está sirviendo correctamente  
curl -I http://localhost/

# Verificar que el nuevo endpoint existe
curl -I http://localhost/api/deliveries

# Ver logs en tiempo real (en otra terminal)
sudo journalctl -f -u inventario-backend
```

### **PASO 10: Prueba Final**
```bash
# Abrir en navegador: http://34.198.163.51
# 1. Iniciar sesión
# 2. Verificar que aparece "Remisiones" en el menú
# 3. Crear una remisión de prueba
# 4. Generar y descargar PDF

# Si todo funciona:
echo "✅ DESPLIEGUE EXITOSO - Módulo de remisiones activo"
```

---

## 🔧 **COMANDOS DE VERIFICACIÓN RÁPIDA**

```bash
# Estado de servicios
sudo systemctl status inventario-backend nginx

# Logs del backend
sudo journalctl -u inventario-backend --since "5 minutes ago"

# Procesos Node.js activos
ps aux | grep node

# Puertos en uso
sudo netstat -tlnp | grep -E ":(80|3001|443)"

# Espacio en disco
df -h

# Verificar BD después de migración
sqlite3 /var/www/inventario-backend/data/inventory.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'deliver%';"
```

---

## 🚨 **EN CASO DE PROBLEMAS**

### **Error: Migración falla**
```bash
# Restaurar backup
sudo cp /var/www/inventario-backend/backups/backup_pre_remisiones_*.db \
        /var/www/inventario-backend/data/inventory.db

# Reiniciar servicio
sudo systemctl restart inventario-backend
```

### **Error: Servicio no inicia**
```bash
# Ver logs detallados
sudo journalctl -u inventario-backend -n 50

# Verificar configuración
cd /var/www/inventario-backend
npm start  # Ejecutar manualmente para ver errores
```

### **Error: Frontend no se ve**
```bash
# Verificar permisos
sudo chown -R www-data:www-data /var/www/inventario
sudo chmod -R 755 /var/www/inventario

# Verificar configuración de Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 **VERIFICACIÓN POST-DESPLIEGUE**

### ✅ **Lista de Verificación**
- [ ] Backup de BD creado exitosamente
- [ ] Código actualizado desde GitHub  
- [ ] PDFKit instalado correctamente
- [ ] Migración de BD ejecutada sin errores
- [ ] Backend compilado (si aplica)
- [ ] Servicios reiniciados correctamente
- [ ] Frontend actualizado
- [ ] Sitio web accesible
- [ ] Login funciona
- [ ] "Remisiones" aparece en menú
- [ ] Se puede crear remisión de prueba
- [ ] PDF se genera y descarga correctamente

### 📱 **URLs de Prueba**
- **Frontend:** http://34.198.163.51
- **API Health:** http://34.198.163.51/api/health  
- **API Remisiones:** http://34.198.163.51/api/deliveries

---

## 🎉 **RESULTADO ESPERADO**

Una vez completados todos los pasos:

1. **El sitio web funcionará normalmente** con todas las funciones existentes
2. **Aparecerá "Remisiones" en el menú lateral** con icono de camión
3. **Se podrán crear remisiones completas** con destinatarios e items
4. **Los PDFs se generarán y descargarán** correctamente
5. **El sistema estará integrado** con el inventario existente

**🚀 ¡El módulo de remisiones estará completamente operativo!**