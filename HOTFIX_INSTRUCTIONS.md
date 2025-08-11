# HOTFIX - Instrucciones de Actualización Urgente

## 🚨 Problema Identificado y Solucionado
**Commit que causó el problema:** `2f82ff771`
**Commit de la solución:** `7ddbf7e2e`

### ❌ Problema:
Los cambios anteriores rompieron la funcionalidad de movimientos al cambiar la estructura de la API:
- Se cambió de `movement_type_id` a `type` rompiendo la integración con el frontend
- Se modificaron las reglas de validación causando que las llamadas API fallaran
- El sistema de añadir movimientos dejó de funcionar

### ✅ Solución:
Se restauró la estructura original de la API manteniendo la nueva funcionalidad de actualización de precios:
- ✅ Restaurado parámetro `movement_type_id` y validación
- ✅ Restaurada integración con tabla `movement_types`  
- ✅ Restaurados todos los endpoints y funcionalidad original
- ✅ MANTENIDA nueva lógica de actualización de precios para operaciones IN
- ✅ Compatible con el frontend existente sin cambios

## 🚀 Pasos Urgentes de Actualización en AWS

### 1. Conectar al servidor
```bash
ssh -i tu_clave_privada.pem ubuntu@ip-172-31-82-182
cd ~/inventario
```

### 2. Resolver conflictos y actualizar
```bash
# Si hay conflictos, usar stash para guardar cambios locales
git stash

# Actualizar desde GitHub
git pull origin main

# Verificar que se obtuvo la corrección
git log --oneline -2
# Debe mostrar: 7ddbf7e2e HOTFIX: Restore original movements API structure with price update feature
```

### 3. Identificar y reiniciar el servicio
```bash
# Verificar cómo está corriendo la aplicación
pm2 list
# O verificar procesos de Node.js
ps aux | grep node

# Si está con PM2:
pm2 restart all

# Si está corriendo directamente:
pkill -f "node.*inventario"
cd ~/inventario/inventory-app/backend
npm start &
```

### 4. Verificar que funciona
```bash
# Verificar que el backend responde
curl http://localhost:3001/health

# Verificar logs
pm2 logs
# O si está corriendo directamente, verificar el terminal
```

## 🧪 Verificación de Funcionalidad

### Probar en la aplicación web:
1. Acceder a la aplicación desde el navegador
2. Hacer login como administrador  
3. Ir a la sección de Movimientos
4. **PROBAR:** Crear un movimiento de entrada con los campos:
   - `movement_type_id`: ID del tipo de movimiento (ej: "entrada001")
   - `component_id`: ID del componente  
   - `quantity`: Cantidad
   - `unit_cost`: Precio unitario
   - `reference_number`: Número de referencia
   - `notes`: Notas

### Validar nueva funcionalidad de precios:
1. Crear un movimiento de entrada con precio mayor al actual del componente
2. Verificar que el `cost_price` del componente se actualiza automáticamente
3. Crear otro movimiento con precio menor - debe mantener el precio anterior

## 📋 Funcionalidades Restauradas

### ✅ Endpoints que deben funcionar:
- `POST /api/movements` - Crear movimiento (con movement_type_id)
- `GET /api/movements` - Obtener movimientos
- `GET /api/movements/:id` - Obtener movimiento por ID  
- `POST /api/movements/reservations` - Crear reserva
- `GET /api/movements/reservations` - Obtener reservas
- `POST /api/movements/invoice` - Crear factura

### ✅ Funcionalidad de precios:
- Al hacer movimientos de entrada (IN), si `unit_cost > cost_price` actual, se actualiza el precio del componente
- Funciona tanto en movimientos individuales como en facturas
- Solo actualiza cuando el precio es mayor (no cuando es menor)

## 🔍 Troubleshooting

### Si persisten los errores:
```bash
# Verificar que el código se actualizó correctamente
cd ~/inventario
git show --name-only HEAD

# Debe mostrar los archivos:
# inventory-app/backend/src/controllers/movements.controller.ts
# inventory-app/backend/src/routes/movements.routes.ts
# inventory-app/backend/dist/ (archivos compilados)
```

### Si la aplicación no responde:
```bash
# Verificar puerto en uso
sudo ss -tlnp | grep :3001

# Verificar logs de errores
pm2 logs --err
```

## 📞 Contacto
Si hay problemas durante la actualización, contactar inmediatamente.

**Estado:** ✅ LISTO PARA DEPLOYMENT
**Urgencia:** 🔴 ALTA - Reparar funcionalidad crítica rota