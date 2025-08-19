# 🚀 INSTRUCCIONES DE DESPLIEGUE - MÓDULO DE REMISIONES

## 📋 RESUMEN
Este documento contiene las instrucciones paso a paso para desplegar el módulo de remisiones en AWS, incluyendo la creación de copias de seguridad y verificación del despliegue.

---

## ⚡ DESPLIEGUE AUTOMÁTICO (RECOMENDADO)

### Opción 1: Script Bash (Linux/macOS/WSL)
```bash
# Desde el directorio del proyecto
cd C:\Users\USER\Documents\inventario
bash deploy-deliveries-module.sh
```

### Opción 2: Script PowerShell (Windows)
```powershell
# Desde PowerShell como Administrador
cd "C:\Users\USER\Documents\inventario"
PowerShell -ExecutionPolicy Bypass -File deploy-deliveries-module.ps1
```

---

## 🔧 DESPLIEGUE MANUAL (PASO A PASO)

### PASO 1: Preparación Local
```bash
# 1.1 Verificar que el frontend esté compilado
cd inventory-app/frontend
npm run build

# 1.2 Verificar archivos necesarios
ls build/          # Debe mostrar archivos compilados
ls ../backend/scripts/add-deliveries-module.js  # Debe existir
```

### PASO 2: Crear Backup de Base de Datos
```bash
# 2.1 Conectar al servidor
ssh ubuntu@34.198.163.51

# 2.2 Buscar y hacer backup de la base de datos
# Buscar ubicación de la BD
sudo find /var/www -name "inventory.db" -type f

# Crear directorio de backups
sudo mkdir -p /var/www/inventario-backend/backups

# Crear backup (ajustar ruta según ubicación encontrada)
sudo cp /var/www/inventario-backend/data/inventory.db \
        /var/www/inventario-backend/backups/inventory_backup_$(date +%Y%m%d_%H%M%S)_pre_deliveries.db

# Verificar backup
ls -lh /var/www/inventario-backend/backups/

# 2.3 Salir del servidor
exit
```

### PASO 3: Subir Frontend
```bash
# 3.1 Empaquetar frontend
cd inventory-app/frontend
tar -czf frontend-build.tar.gz -C build .

# 3.2 Subir al servidor
scp frontend-build.tar.gz ubuntu@34.198.163.51:/tmp/

# 3.3 Desplegar en servidor
ssh ubuntu@34.198.163.51

# Backup del frontend actual (opcional)
sudo tar -czf /tmp/frontend-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /var/www/inventario . 2>/dev/null || true

# Limpiar y desplegar
sudo rm -rf /var/www/inventario/*
cd /var/www/inventario
sudo tar -xzf /tmp/frontend-build.tar.gz

# Establecer permisos
sudo chown -R www-data:www-data /var/www/inventario
sudo chmod -R 755 /var/www/inventario

# Limpiar temporal
rm /tmp/frontend-build.tar.gz

exit
```

### PASO 4: Migrar Base de Datos
```bash
# 4.1 Subir script de migración
cd ../backend
scp scripts/add-deliveries-module.js ubuntu@34.198.163.51:/tmp/

# 4.2 Ejecutar migración
ssh ubuntu@34.198.163.51

# Mover script
sudo mv /tmp/add-deliveries-module.js /var/www/inventario-backend/scripts/
sudo chown ubuntu:ubuntu /var/www/inventario-backend/scripts/add-deliveries-module.js

# Ejecutar migración
cd /var/www/inventario-backend
node scripts/add-deliveries-module.js

# Si todo sale bien, deberías ver:
# ✅ Migración completada exitosamente!
# 🎉 ¡El módulo de remisiones está listo para usar!

exit
```

### PASO 5: Reiniciar Servicios
```bash
ssh ubuntu@34.198.163.51

# 5.1 Reiniciar backend (probar diferentes métodos según tu configuración)

# Método 1: SystemD
sudo systemctl restart inventario-backend
# o
sudo systemctl restart inventario

# Método 2: Service
sudo service inventario-backend restart

# Método 3: PM2 (si usas PM2)
pm2 restart inventory-backend
# o
pm2 restart all

# Método 4: Manual (si no tienes servicio configurado)
sudo pkill -f "node.*inventory"
cd /var/www/inventario-backend
sudo npm start &

# 5.2 Reiniciar Nginx
sudo systemctl reload nginx
# o si falla:
sudo systemctl restart nginx

# 5.3 Verificar servicios
sudo systemctl status inventario-backend
sudo systemctl status nginx

exit
```

### PASO 6: Verificar Despliegue
```bash
# 6.1 Verificar servidor web
curl -I http://34.198.163.51
# Debe retornar: HTTP/1.1 200 OK

# 6.2 Verificar API (si tienes endpoint de health)
curl http://34.198.163.51/api/health

# 6.3 Verificar en navegador
# Abrir: http://34.198.163.51
# - Iniciar sesión
# - Verificar que aparezca "Remisiones" en el menú lateral
# - Hacer clic en "Remisiones"
# - Intentar crear una nueva remisión de prueba
```

---

## 🔍 VERIFICACIÓN POST-DESPLIEGUE

### ✅ Lista de Verificación
- [ ] El sitio web carga correctamente
- [ ] El login funciona
- [ ] Aparece "Remisiones" en el menú lateral
- [ ] Se puede acceder a la página de remisiones
- [ ] Se pueden ver las tabs: Todas, Pendientes, Entregadas, Canceladas
- [ ] El botón "Nueva Remisión" funciona
- [ ] Se puede crear una remisión de prueba
- [ ] Se puede generar y descargar PDF de prueba

### 🧪 Prueba Completa
1. **Crear remisión de prueba:**
   - Destinatario: "Usuario Prueba"
   - Empresa: "Empresa Test"
   - Agregar 1-2 items del inventario
   - Guardar remisión

2. **Verificar funcionalidades:**
   - Vista previa de la remisión
   - Descarga del PDF
   - Búsqueda de remisiones
   - Filtrado por estado

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Error: "No se encontró la base de datos"
```bash
# Buscar en todo el sistema
sudo find /var -name "*.db" | grep -i inventory

# Ubicaciones comunes:
ls -la /var/www/inventario-backend/
ls -la /var/www/inventario-backend/data/
ls -la /home/ubuntu/
```

### Error: "Servicio no responde"
```bash
# Verificar logs
sudo journalctl -f -u inventario-backend
sudo tail -f /var/log/nginx/error.log

# Verificar puertos
sudo netstat -tlnp | grep :3001  # Backend
sudo netstat -tlnp | grep :80    # Nginx
```

### Error: "Permisos denegados"
```bash
# Corregir permisos del frontend
sudo chown -R www-data:www-data /var/www/inventario
sudo chmod -R 755 /var/www/inventario

# Corregir permisos del backend
sudo chown -R ubuntu:ubuntu /var/www/inventario-backend
```

### Error: "Cannot find module 'pdfkit'"
```bash
# Instalar dependencia faltante
cd /var/www/inventario-backend
sudo npm install pdfkit
sudo systemctl restart inventario-backend
```

---

## 🛡️ RESPALDO Y RECUPERACIÓN

### Crear Backup Manual
```bash
ssh ubuntu@34.198.163.51

# Backup de base de datos
sudo cp /var/www/inventario-backend/data/inventory.db \
        /var/www/inventario-backend/backups/manual_backup_$(date +%Y%m%d_%H%M%S).db

# Backup de frontend
sudo tar -czf /tmp/frontend_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
              -C /var/www/inventario .
```

### Restaurar desde Backup
```bash
ssh ubuntu@34.198.163.51

# 1. Listar backups disponibles
ls -lt /var/www/inventario-backend/backups/

# 2. Restaurar base de datos (ajustar nombres de archivo)
sudo cp /var/www/inventario-backend/backups/inventory_backup_20250819_123000_pre_deliveries.db \
        /var/www/inventario-backend/data/inventory.db

# 3. Reiniciar servicios
sudo systemctl restart inventario-backend
sudo systemctl restart nginx
```

---

## 📞 INFORMACIÓN DE CONTACTO

**En caso de problemas:**
1. Verificar logs del servidor
2. Comprobar backups disponibles
3. Consultar esta documentación
4. Contactar soporte técnico

**Archivos importantes:**
- BD Principal: `/var/www/inventario-backend/data/inventory.db`
- Backups: `/var/www/inventario-backend/backups/`
- Logs: `sudo journalctl -u inventario-backend`
- Frontend: `/var/www/inventario/`

---

## 🎉 ¡DESPLIEGUE EXITOSO!

Una vez completados todos los pasos, el módulo de remisiones estará disponible en:
**http://34.198.163.51**

**Funcionalidades disponibles:**
- ✅ Crear/editar/eliminar remisiones
- ✅ Gestión de destinatarios completa
- ✅ Items con componentes, cantidades y seriales
- ✅ Estados: Pendiente, Entregado, Cancelado
- ✅ Vista previa profesional
- ✅ Generación y descarga de PDFs
- ✅ Búsqueda y filtros
- ✅ Integración con inventario existente

El sistema mantiene toda la funcionalidad anterior y agrega las nuevas capacidades de remisiones de manera integrada.