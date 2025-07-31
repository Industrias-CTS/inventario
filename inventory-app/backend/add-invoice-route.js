// Script para agregar la ruta de factura al servidor en ejecución
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = 3004; // Puerto diferente para no interferir

// CORS permisivo
app.use(cors({
  origin: ['http://localhost:3005', 'http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Base de datos
let db;

async function initDB() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// Middleware de autenticación
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Función para generar ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Solo la ruta de procesar facturas
app.post('/api/movements/invoice', authenticate, async (req, res) => {
  try {
    const {
      movement_type_id,
      reference_number,
      notes,
      shipping_cost = 0,
      shipping_tax = 0,
      items
    } = req.body;
    
    const user_id = req.user.userId;

    // Obtener tipo de movimiento
    const movementType = await db.get(
      'SELECT operation FROM movement_types WHERE id = ?',
      [movement_type_id]
    );
    
    if (!movementType) {
      return res.status(400).json({ error: 'Tipo de movimiento no válido' });
    }
    
    const operation = movementType.operation;
    
    // Calcular el costo adicional por unidad (envío + impuestos)
    const totalItems = items.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
    const additionalCostPerUnit = (parseFloat(shipping_cost) + parseFloat(shipping_tax)) / totalItems;
    
    const createdMovements = [];
    
    for (const item of items) {
      const {
        component_code,
        component_name,
        quantity,
        total_cost,
        unit
      } = item;
      
      // Calcular costo unitario base
      const unitCostBase = parseFloat(total_cost) / parseFloat(quantity);
      // Costo unitario final incluyendo costos adicionales
      const unitCostFinal = unitCostBase + additionalCostPerUnit;
      
      // Buscar si el componente existe
      let component = await db.get(
        'SELECT * FROM components WHERE code = ?',
        [component_code]
      );
      
      let component_id;
      
      if (!component) {
        // Si no existe, crear el componente con unit_id por defecto
        component_id = generateId();
        // Obtener una unidad por defecto (la primera disponible)
        const defaultUnit = await db.get('SELECT id FROM units LIMIT 1');
        const unit_id = defaultUnit ? defaultUnit.id : null;
        
        await db.run(
          `INSERT INTO components (
            id, code, name, unit_id, current_stock, min_stock, max_stock, reserved_stock, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [component_id, component_code, component_name, unit_id, 0, 0, 0, 0, 1]
        );
      } else {
        component_id = component.id;
      }
      
      // Obtener stock actual
      const stockData = await db.get(
        'SELECT current_stock, reserved_stock FROM components WHERE id = ?',
        [component_id]
      );
      
      if (!stockData) {
        return res.status(400).json({ error: `Componente ${component_name} no encontrado después de creación` });
      }
      
      const { current_stock, reserved_stock } = stockData;
      let newStock = parseFloat(current_stock || 0);
      let newReservedStock = parseFloat(reserved_stock || 0);

      // Actualizar stock según operación
      switch (operation) {
        case 'IN':
          newStock += parseFloat(quantity);
          break;
        case 'OUT':
          if (newStock - newReservedStock < parseFloat(quantity)) {
            return res.status(400).json({ error: `Stock insuficiente para ${component_name}` });
          }
          newStock -= parseFloat(quantity);
          break;
      }

      // Actualizar stock del componente
      await db.run(
        'UPDATE components SET current_stock = ?, reserved_stock = ? WHERE id = ?',
        [newStock, newReservedStock, component_id]
      );

      // Crear movimiento
      const movementId = generateId();
      await db.run(
        `INSERT INTO movements (
          id, movement_type_id, component_id, quantity, unit_cost,
          reference_number, notes, user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          movement_type_id,
          component_id,
          quantity,
          unitCostFinal,
          reference_number,
          `${notes || ''} | Item: ${component_name} | Costo base: ${unitCostBase.toFixed(2)} | Costo adicional: ${additionalCostPerUnit.toFixed(2)}`,
          user_id
        ]
      );

      const movement = await db.get('SELECT * FROM movements WHERE id = ?', [movementId]);
      createdMovements.push({
        ...movement,
        component_code,
        component_name,
        unit_cost_base: unitCostBase,
        additional_cost: additionalCostPerUnit,
        newStock,
        newReservedStock
      });
    }

    res.status(201).json({
      message: 'Factura procesada exitosamente',
      invoice: {
        reference_number,
        movement_type_id,
        items_count: items.length,
        total_items: totalItems,
        shipping_cost: parseFloat(shipping_cost),
        shipping_tax: parseFloat(shipping_tax),
        additional_cost_per_unit: additionalCostPerUnit
      },
      movements: createdMovements
    });
  } catch (error) {
    console.error('Error al procesar factura:', error);
    return res.status(400).json({ error: error.message || 'Error al procesar factura' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor solo para facturas', port: PORT, timestamp: new Date() });
});

// Inicializar y arrancar
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Servidor para facturas corriendo en puerto ${PORT}`);
    console.log(`Solo maneja POST /api/movements/invoice`);
  });
}

start().catch(console.error);