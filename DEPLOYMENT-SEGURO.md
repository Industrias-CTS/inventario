# 🔒 Deployment Seguro - Manteniendo Base de Datos

Este documento explica cómo actualizar tu servidor AWS manteniendo toda la información de la base de datos intacta.

## 🚨 Importante
**Los siguientes scripts garantizan que tu base de datos NO se sobrescriba durante las actualizaciones.**

## 📋 Scripts Disponibles

### 1. `backup-database.sh` - Backup de la Base de Datos
Crea un backup completo de tu base de datos del servidor.

```bash
bash backup-database.sh
```

**Qué hace:**
- Encuentra automáticamente la base de datos en el servidor
- Crea un backup con timestamp
- Lo descarga a tu PC local en `./database-backups/`
- Mantiene un historial de backups

### 2. `deploy-safe-update.sh` - Deployment Seguro
Actualiza el servidor completo preservando la base de datos.

```bash
bash deploy-safe-update.sh
```

**Qué hace:**
1. ✅ Hace backup automático de la base de datos
2. 🔒 Preserva archivos críticos (*.db, ecosystem.config.js)
3. 📥 Descarga cambios de GitHub
4. 🔄 Actualiza dependencias
5. 🎨 Actualiza frontend build
6. 🔄 Reinicia servicios
7. 🔙 Restaura base de datos original

### 3. `deploy-nginx-fix.sh` - Fix del Error 429
Aplica la corrección de Nginx para el error 429.

```bash
bash deploy-nginx-fix.sh
```

## 🚀 Proceso Completo Recomendado

### Opción A: Todo en uno (Recomendado)
```bash
# 1. Deployment seguro (incluye backup automático)
bash deploy-safe-update.sh

# 2. Aplicar fix de Nginx
bash deploy-nginx-fix.sh
```

### Opción B: Paso a paso
```bash
# 1. Backup manual (opcional, ya se hace automático)
bash backup-database.sh

# 2. Actualizar servidor manteniendo DB
bash deploy-safe-update.sh

# 3. Aplicar configuración de Nginx
bash deploy-nginx-fix.sh
```

## 🔍 Verificación Post-Deployment

### En tu navegador:
1. Ve a `http://34.198.163.51`
2. Intenta hacer login
3. Verifica que tus datos están intactos

### En el servidor (si necesitas debug):
```bash
ssh ubuntu@34.198.163.51

# Ver logs de la aplicación
pm2 logs

# Ver logs de Nginx
sudo tail -f /var/log/nginx/inventory_error.log

# Verificar estado de servicios
pm2 status
sudo systemctl status nginx
```

## 📂 Estructura de Backups

Los backups se guardan en:
```
./database-backups/
├── inventory_backup_20250814_143022.db
├── inventory_backup_20250814_150315.db
└── ...
```

## 🆘 Restauración de Emergencia

Si algo sale mal, puedes restaurar tu base de datos:

```bash
# En el servidor
ssh ubuntu@34.198.163.51

# Encontrar la ubicación actual de la DB
find /var/www /home/ubuntu -name "*.db" -type f

# Restaurar desde backup local
scp ./database-backups/inventory_backup_FECHA.db ubuntu@34.198.163.51:/tmp/
ssh ubuntu@34.198.163.51
sudo cp /tmp/inventory_backup_FECHA.db /ruta/a/tu/base/datos/inventory.db
pm2 restart all
```

## ✅ Garantías de Seguridad

- ✅ **Base de datos nunca se sobrescribe**
- ✅ **Backup automático antes de cada cambio**
- ✅ **Restauración automática de archivos críticos**
- ✅ **Proceso reversible**
- ✅ **Verificación de errores en cada paso**

## 🔧 Configuración Específica

### Rate Limiting (Error 429)
- Login: 10 requests/segundo con burst de 20
- APIs: 30 requests/segundo con burst de 50
- Headers CORS configurados

### Archivos Preservados
- `*.db` - Todas las bases de datos
- `ecosystem.config.js` - Configuración de PM2
- Configuraciones locales del servidor

## 📞 Soporte

Si encuentras problemas:
1. Los backups están en `./database-backups/`
2. El servidor mantiene stash de Git con cambios locales
3. Los logs están disponibles con `pm2 logs`

**Recuerda:** Siempre se crea un backup antes de cualquier cambio, así que tus datos están seguros.