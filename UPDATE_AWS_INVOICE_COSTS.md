# 🚀 Actualización AWS: Distribución de Costos de Envío en Facturas

## Nueva Funcionalidad Implementada ✅

La funcionalidad de facturas ahora **distribuye automáticamente los costos de envío e impuestos** entre todos los componentes de la factura:

### 📐 Fórmula de Cálculo:
```
Costo adicional = shipping_cost + shipping_tax
Costo por ítem = costo_adicional / número_de_items
Nuevo unit_cost = unit_cost_original + costo_por_ítem
```

### 🔄 ¿Qué hace ahora el sistema?
1. **Suma los costos adicionales**: `shipping_cost + shipping_tax`
2. **Divide entre todos los items** de la factura por igual
3. **Agrega este costo** al `unit_cost` de cada componente
4. **Actualiza el `cost_price`** del componente si el nuevo precio es mayor

---

## 🔧 Comandos para Actualizar el Servidor AWS

### Paso 1: Conectar y actualizar código
```bash
ssh -i tu-llave.pem ubuntu@tu-ip-aws
cd /home/ubuntu/inventario/inventory-app/backend
git pull origin main
```

### Paso 2: Reconstruir aplicación
```bash
npm run build
```

### Paso 3: Reiniciar PM2
```bash
pm2 restart backend
```

### Paso 4: Verificar funcionamiento
```bash
pm2 logs backend --lines 10
```

---

## 🧪 Prueba de la Nueva Funcionalidad

### Ejemplo de Factura con Costos de Envío:

```bash
curl -X POST http://localhost:3000/api/movements/invoice \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reference_number": "FAC-001",
    "shipping_cost": 30.00,
    "shipping_tax": 4.50,
    "items": [
      {
        "component_code": "COMP001", 
        "component_name": "Componente A",
        "quantity": 2,
        "unit_cost": 100.00,
        "total_cost": 200.00
      },
      {
        "component_code": "COMP002",
        "component_name": "Componente B", 
        "quantity": 3,
        "unit_cost": 50.00,
        "total_cost": 150.00
      }
    ]
  }'
```

### 📊 Resultado Esperado:

Con **2 items** en la factura:
- **Costo adicional total**: $30.00 + $4.50 = $34.50
- **Costo por item**: $34.50 ÷ 2 = $17.25

**Item 1:**
- `unit_cost` original: $100.00
- `unit_cost` final: $100.00 + $17.25 = **$117.25**

**Item 2:** 
- `unit_cost` original: $50.00  
- `unit_cost` final: $50.00 + $17.25 = **$67.25**

### 📋 Respuesta de la API:
```json
{
  "message": "Factura creada exitosamente",
  "movements": [
    {
      "component_code": "COMP001",
      "unit_cost": 117.25,
      "base_unit_cost": 100.00,
      "additional_cost_per_item": 17.25
    },
    {
      "component_code": "COMP002", 
      "unit_cost": 67.25,
      "base_unit_cost": 50.00,
      "additional_cost_per_item": 17.25
    }
  ],
  "shipping_cost": 30.00,
  "shipping_tax": 4.50,
  "total_amount": 384.50
}
```

---

## ✅ Verificación de Funcionamiento

### 1. Crear una factura con shipping_cost y shipping_tax
### 2. Verificar que los unit_cost se calculen correctamente
### 3. Confirmar que los cost_price de los componentes se actualicen
### 4. Comprobar que la respuesta incluya el desglose detallado

---

## 🎯 Beneficios de la Nueva Funcionalidad

✅ **Distribución justa** de costos adicionales  
✅ **Actualización automática** de precios de componentes  
✅ **Transparencia total** en el cálculo de costos  
✅ **Compatibilidad completa** con funcionalidad existente  
✅ **Desglose detallado** en la respuesta de la API  

---

**⏱️ Tiempo estimado de actualización: 2-3 minutos**

Una vez aplicada la actualización, todas las facturas que incluyan `shipping_cost` y/o `shipping_tax` distribuirán automáticamente estos costos entre los componentes de manera proporcional.