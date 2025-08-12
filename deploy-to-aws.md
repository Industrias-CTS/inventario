# Script de Despliegue en AWS

Para actualizar la aplicación en el servidor AWS, ejecutar los siguientes comandos:

```bash
# 1. Conectar al servidor AWS
ssh -i tu-clave.pem ubuntu@34.198.163.51

# 2. Navegar al directorio del proyecto
cd inventario

# 3. Hacer pull de los cambios más recientes
git pull origin main

# 4. Aplicar migración de base de datos (si es necesario)
cd inventory-app/backend
node migrate-db.js

# 5. Reiniciar el backend
pm2 restart backend

# 6. Verificar que todo esté funcionando
pm2 logs backend --lines 20
```

## Verificación de cambios incluidos:

✅ Colores en columna Tipo de movimientos (verde/rojo)
✅ Selector de recetas en nuevo movimiento  
✅ Multiplicador para aplicar recetas varias veces
✅ Vista previa de componentes de receta
✅ Migración de base de datos para columna sale_price

## Último commit con cambios del frontend:
- `6c28a0a9a` - Mejoras en movimientos con recetas
- `25217869e` - Fix de columna sale_price

## Archivos modificados:
- `inventory-app/frontend/src/pages/Movements.tsx` - Nuevas funcionalidades
- `inventory-app/frontend/build/*` - Build actualizado
- `inventory-app/backend/src/config/database-sqlite.ts` - Migración automática
- `inventory-app/backend/migrate-db.js` - Script de migración manual