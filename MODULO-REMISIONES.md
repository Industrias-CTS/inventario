# 📦 Módulo de Remisiones - Sistema de Inventario

## 🌟 Características Implementadas

### ✅ Funcionalidades Principales
- **Gestión completa de remisiones**: Crear, editar, eliminar y consultar remisiones
- **Información detallada del destinatario**: Nombre, empresa, documento, teléfono, email, dirección
- **Items de remisión**: Múltiples componentes por remisión con cantidades, precios y seriales
- **Estados de remisión**: Pendiente, Entregado, Cancelado
- **Numeración automática**: REM-YYYY-0001 (año-secuencial)
- **Vista previa**: Visualización completa antes de generar PDF
- **Descarga en PDF**: Documento profesional para impresión
- **Búsqueda y filtros**: Por número de remisión, destinatario y estado
- **Firma digital**: Campo para captura de firma (preparado para futuras implementaciones)

### 🏗️ Arquitectura

#### Backend (Express + TypeScript + SQLite)
- **Tablas de base de datos**:
  - `deliveries`: Información principal de la remisión
  - `delivery_items`: Items individuales de cada remisión
- **Endpoints API**:
  - `GET /api/deliveries` - Listar remisiones con paginación
  - `GET /api/deliveries/:id` - Obtener remisión específica
  - `POST /api/deliveries` - Crear nueva remisión
  - `PUT /api/deliveries/:id` - Actualizar remisión
  - `DELETE /api/deliveries/:id` - Eliminar remisión
  - `GET /api/deliveries/:id/pdf` - Descargar PDF
- **Funcionalidades**:
  - Generación automática de PDFs con PDFKit
  - Numeración secuencial por año
  - Validaciones de datos
  - Transacciones de base de datos
  - Registro de movimientos de inventario

#### Frontend (React + TypeScript + Material-UI)
- **Páginas principales**:
  - `/deliveries` - Lista de remisiones con tabs por estado
- **Componentes**:
  - `DeliveryForm` - Formulario completo para crear/editar
  - `DeliveryPreview` - Vista previa estilo documento
  - `DataTable` - Tabla con búsqueda y paginación
- **Funcionalidades**:
  - Interfaz responsiva
  - Validaciones en tiempo real
  - Autocompletar componentes
  - Cálculo automático de totales
  - Descarga directa de PDFs

### 📋 Campos del Formulario

#### Información del Destinatario
- **Nombre del Destinatario** (requerido)
- **Empresa** (opcional)
- **Documento de Identidad** (opcional)
- **Fecha de Entrega** (por defecto hoy)
- **Teléfono** (opcional)
- **Email** (opcional)
- **Dirección de Entrega** (opcional)
- **Estado** (solo en edición)

#### Items de la Remisión
- **Componente** (autocompletar con código y nombre)
- **Cantidad** (numérico, requerido)
- **Números de Serie** (texto libre)
- **Precio Unitario** (numérico, se sugiere desde el componente)
- **Notas del Item** (opcional)

#### Información Adicional
- **Notas Generales** (opcional)
- **Firma Digital** (preparado para implementación futura)

## 🚀 Instalación y Configuración

### 1. Backend
```bash
cd inventory-app/backend
npm install pdfkit @types/pdfkit
```

### 2. Base de Datos
```bash
# Ejecutar migración para crear tablas
node scripts/add-deliveries-module.js
```

### 3. Frontend
Los componentes ya están integrados en el sistema existente.

### 4. Reiniciar Servicios
```bash
# Backend
npm start

# Frontend (si es necesario rebuilding)
npm run build
```

### 5. Actualizar Producción en AWS
```bash
# Ejecutar comando existente para actualizar frontend
sudo cp -r inventory-app/frontend/build/* /var/www/inventario/
```

## 📁 Archivos Creados/Modificados

### Backend
```
backend/src/
├── controllers/deliveries.controller.ts    # Controlador principal
├── routes/deliveries.routes.ts             # Rutas API
├── database/schema.sql                     # Actualizado con nuevas tablas
├── index-simple.ts                         # Integración de rutas
└── scripts/add-deliveries-module.js        # Migración de base de datos
```

### Frontend
```
frontend/src/
├── pages/Deliveries.tsx                    # Página principal del módulo
├── components/
│   ├── DeliveryForm.tsx                    # Formulario de remisiones
│   └── DeliveryPreview.tsx                 # Vista previa
├── services/deliveries.service.ts          # Servicios API
├── types/index.ts                          # Tipos TypeScript actualizados
├── App.tsx                                 # Ruta agregada
└── layouts/MainLayout.tsx                  # Navegación actualizada
```

## 🎯 Uso del Sistema

### 1. Crear Nueva Remisión
1. Navegar a "Remisiones" en el menú lateral
2. Hacer clic en "Nueva Remisión"
3. Llenar información del destinatario
4. Agregar items usando el botón "Agregar Item"
5. Seleccionar componentes con autocompletar
6. Especificar cantidades y precios
7. Agregar seriales si es necesario
8. Guardar la remisión

### 2. Gestionar Remisiones Existentes
- **Ver todas**: Tab "Todas"
- **Filtrar por estado**: Tabs "Pendientes", "Entregadas", "Canceladas"
- **Buscar**: Campo de búsqueda por número o destinatario
- **Vista previa**: Icono de preview
- **Descargar PDF**: Icono de descarga
- **Editar**: Icono de edición
- **Eliminar**: Icono de papelera (con confirmación)

### 3. PDF Generado
El PDF incluye:
- Encabezado con número de remisión
- Información del sistema/empresa
- Datos completos del destinatario
- Tabla detallada de items con precios
- Total calculado
- Espacios para firmas
- Números de serie cuando aplique

## 🔧 Configuración Adicional

### Personalización de PDFs
En `deliveries.controller.ts`, función `generateDeliveryPDF()`:
- Modificar información de la empresa
- Ajustar diseño y colores
- Agregar logos o imágenes

### Numeración de Remisiones
El formato actual es `REM-YYYY-NNNN`:
- `REM`: Prefijo fijo
- `YYYY`: Año actual
- `NNNN`: Secuencial de 4 dígitos

Para cambiar el formato, modificar la función `generate_delivery_number()` en el schema.

### Estados Personalizados
Para agregar nuevos estados:
1. Actualizar constraint CHECK en la tabla `deliveries`
2. Modificar tipos en `frontend/src/types/index.ts`
3. Actualizar función `getStatusChip()` en los componentes

## 🔐 Seguridad

- ✅ Autenticación requerida para todos los endpoints
- ✅ Validación de datos en backend y frontend
- ✅ Transacciones de base de datos para consistencia
- ✅ Sanitización de entradas de usuario
- ✅ Control de acceso basado en roles (preparado)

## 📊 Base de Datos

### Tabla `deliveries`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| delivery_number | VARCHAR(50) | Número de remisión |
| recipient_name | VARCHAR(255) | Nombre destinatario |
| recipient_company | VARCHAR(255) | Empresa (opcional) |
| recipient_id | VARCHAR(50) | Documento (opcional) |
| delivery_date | TIMESTAMP | Fecha de entrega |
| notes | TEXT | Notas generales |
| signature_data | TEXT | Datos de firma |
| delivery_address | TEXT | Dirección entrega |
| phone | VARCHAR(20) | Teléfono |
| email | VARCHAR(255) | Email |
| status | VARCHAR(20) | Estado actual |
| created_by | UUID | Usuario creador |
| created_at | TIMESTAMP | Fecha creación |
| updated_at | TIMESTAMP | Fecha actualización |

### Tabla `delivery_items`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| delivery_id | UUID | Referencia a remisión |
| component_id | UUID | Referencia a componente |
| quantity | DECIMAL(10,2) | Cantidad |
| serial_numbers | TEXT | Números de serie |
| unit_price | DECIMAL(10,2) | Precio unitario |
| total_price | DECIMAL(10,2) | Total calculado |
| notes | TEXT | Notas del item |
| created_at | TIMESTAMP | Fecha creación |

## 🎉 ¡Listo para Usar!

El módulo de remisiones está completamente integrado en el sistema existente. Los usuarios pueden comenzar a crear remisiones inmediatamente después de ejecutar la migración de base de datos.

### Próximos Pasos Sugeridos
1. **Implementar firma digital táctil** para dispositivos móviles
2. **Agregar plantillas personalizables** de PDF
3. **Integrar con sistema de email** para envío automático
4. **Reportes de remisiones** por fechas y usuarios
5. **Códigos de barras/QR** en las remisiones
6. **Historial de cambios** y auditoría

---
*Módulo desarrollado para el Sistema de Gestión de Inventario*