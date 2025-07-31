const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = 3011;

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
  
  // Crear tablas de recetas si no existen
  await db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      output_component_id TEXT NOT NULL,
      output_quantity REAL NOT NULL DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (output_component_id) REFERENCES components (id)
    );
    
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components (id)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      status TEXT DEFAULT 'active',
      reference TEXT,
      notes TEXT,
      expires_at DATETIME,
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      cancelled_at DATETIME,
      FOREIGN KEY (component_id) REFERENCES components (id)
    );
  `);
  
  console.log('Tablas de recetas verificadas/creadas');
}

// Middlewares
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

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  return next();
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// ========== RUTAS DE AUTENTICACIÓN ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      'secret',
      { expiresIn: '7d' }
    );

    delete user.password;

    res.json({
      message: 'Inicio de sesión exitoso',
      user,
      token,
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ========== RUTAS DE COMPONENTES ==========
app.get('/api/components', authenticate, async (req, res) => {
  try {
    const components = await db.all(`
      SELECT 
        c.*,
        cat.name as category_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.is_active = 1
      ORDER BY c.name
    `);
    res.json({ components });
  } catch (error) {
    console.error('Error al obtener componentes:', error);
    return res.status(500).json({ error: 'Error al obtener componentes' });
  }
});

app.get('/api/components/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const component = await db.get(`
      SELECT 
        c.*,
        cat.name as category_name,
        u.name as unit_name,
        u.symbol as unit_symbol
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE c.id = ? AND c.is_active = 1
    `, [id]);
    
    if (!component) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    
    res.json({ component });
  } catch (error) {
    console.error('Error al obtener componente:', error);
    return res.status(500).json({ error: 'Error al obtener componente' });
  }
});

app.post('/api/components', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      category_id,
      unit_id,
      min_stock = 0,
      max_stock = 0,
      location,
      cost_price = 0
    } = req.body;
    
    const existingComponent = await db.get('SELECT id FROM components WHERE code = ?', [code]);
    if (existingComponent) {
      return res.status(400).json({ error: 'Ya existe un componente con este código' });
    }
    
    const componentId = generateId();
    await db.run(
      `INSERT INTO components (
        id, code, name, description, category_id, unit_id,
        current_stock, min_stock, max_stock, reserved_stock,
        location, cost_price, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        componentId, code, name, description, category_id, unit_id,
        0, min_stock, max_stock, 0,
        location, cost_price, 1
      ]
    );
    
    const component = await db.get('SELECT * FROM components WHERE id = ?', [componentId]);
    
    res.status(201).json({
      message: 'Componente creado exitosamente',
      component
    });
  } catch (error) {
    console.error('Error al crear componente:', error);
    return res.status(500).json({ error: 'Error al crear componente' });
  }
});

app.put('/api/components/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      category_id,
      unit_id,
      min_stock,
      max_stock,
      location,
      cost_price
    } = req.body;
    
    const existingComponent = await db.get('SELECT * FROM components WHERE id = ? AND is_active = 1', [id]);
    if (!existingComponent) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    
    if (code && code !== existingComponent.code) {
      const codeExists = await db.get('SELECT id FROM components WHERE code = ? AND id != ?', [code, id]);
      if (codeExists) {
        return res.status(400).json({ error: 'Ya existe un componente con este código' });
      }
    }
    
    await db.run(
      `UPDATE components SET 
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category_id = ?,
        unit_id = COALESCE(?, unit_id),
        min_stock = COALESCE(?, min_stock),
        max_stock = COALESCE(?, max_stock),
        location = ?,
        cost_price = COALESCE(?, cost_price),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [code, name, description, category_id, unit_id, min_stock, max_stock, location, cost_price, id]
    );
    
    const component = await db.get('SELECT * FROM components WHERE id = ?', [id]);
    
    res.json({
      message: 'Componente actualizado exitosamente',
      component
    });
  } catch (error) {
    console.error('Error al actualizar componente:', error);
    return res.status(500).json({ error: 'Error al actualizar componente' });
  }
});

app.delete('/api/components/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingComponent = await db.get('SELECT * FROM components WHERE id = ? AND is_active = 1', [id]);
    if (!existingComponent) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    
    const hasMovements = await db.get('SELECT COUNT(*) as count FROM movements WHERE component_id = ?', [id]);
    if (hasMovements.count > 0) {
      await db.run('UPDATE components SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    } else {
      await db.run('DELETE FROM components WHERE id = ?', [id]);
    }
    
    res.json({
      message: 'Componente eliminado exitosamente',
      component: existingComponent
    });
  } catch (error) {
    console.error('Error al eliminar componente:', error);
    return res.status(500).json({ error: 'Error al eliminar componente' });
  }
});

// ========== RUTAS DE CATEGORÍAS Y UNIDADES ==========
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.json({ categories });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    return res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

app.get('/api/units', authenticate, async (req, res) => {
  try {
    const units = await db.all('SELECT * FROM units ORDER BY name');
    res.json({ units });
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    return res.status(500).json({ error: 'Error al obtener unidades' });
  }
});

app.post('/api/units', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, symbol } = req.body;
    
    // Validaciones
    if (!name || !symbol) {
      return res.status(400).json({ error: 'Nombre y símbolo son requeridos' });
    }
    
    // Verificar que el símbolo no existe
    const existingSymbol = await db.get('SELECT id FROM units WHERE symbol = ?', [symbol]);
    if (existingSymbol) {
      return res.status(400).json({ error: 'Ya existe una unidad con este símbolo' });
    }
    
    // Verificar que el nombre no existe
    const existingName = await db.get('SELECT id FROM units WHERE name = ?', [name]);
    if (existingName) {
      return res.status(400).json({ error: 'Ya existe una unidad con este nombre' });
    }
    
    const unitId = generateId();
    await db.run(
      'INSERT INTO units (id, name, symbol, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [unitId, name, symbol]
    );
    
    const unit = await db.get('SELECT * FROM units WHERE id = ?', [unitId]);
    
    res.status(201).json({
      message: 'Unidad creada exitosamente',
      unit
    });
  } catch (error) {
    console.error('Error al crear unidad:', error);
    return res.status(500).json({ error: 'Error al crear unidad' });
  }
});

// ========== RUTAS DE RECETAS ==========
console.log('Registrando rutas de recetas...');

app.get('/api/recipes', authenticate, async (req, res) => {
  try {
    console.log('GET /api/recipes llamado');
    const { search } = req.query;
    
    let query = `
      SELECT 
        r.*,
        c.code as output_component_code,
        c.name as output_component_name,
        u.symbol as output_unit_symbol
      FROM recipes r
      JOIN components c ON r.output_component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE r.is_active = 1
    `;
    
    const params = [];
    if (search) {
      query += ` AND (r.code LIKE ? OR r.name LIKE ? OR r.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY r.name`;
    
    const recipes = await db.all(query, params);
    
    // Calcular el costo total de cada receta
    for (const recipe of recipes) {
      const ingredients = await db.all(`
        SELECT 
          ri.quantity,
          c.cost_price
        FROM recipe_ingredients ri
        JOIN components c ON ri.component_id = c.id
        WHERE ri.recipe_id = ?
      `, [recipe.id]);
      
      let totalCost = 0;
      for (const ingredient of ingredients) {
        totalCost += ingredient.quantity * (ingredient.cost_price || 0);
      }
      
      recipe.total_cost = totalCost;
      recipe.unit_cost = totalCost / recipe.output_quantity;
    }
    
    res.json({ recipes });
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    return res.status(500).json({ error: 'Error al obtener recetas', details: error.message });
  }
});

app.get('/api/recipes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const recipe = await db.get(`
      SELECT 
        r.*,
        c.code as output_component_code,
        c.name as output_component_name,
        u.symbol as output_unit_symbol
      FROM recipes r
      JOIN components c ON r.output_component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE r.id = ? AND r.is_active = 1
    `, [id]);
    
    if (!recipe) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    const ingredients = await db.all(`
      SELECT 
        ri.*,
        c.code as component_code,
        c.name as component_name,
        c.cost_price,
        u.symbol as unit_symbol
      FROM recipe_ingredients ri
      JOIN components c ON ri.component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE ri.recipe_id = ?
    `, [id]);
    
    let totalCost = 0;
    const ingredientsWithCost = ingredients.map(ingredient => {
      const ingredientCost = ingredient.quantity * (ingredient.cost_price || 0);
      totalCost += ingredientCost;
      return {
        ...ingredient,
        ingredient_cost: ingredientCost
      };
    });
    
    recipe.ingredients = ingredientsWithCost;
    recipe.total_cost = totalCost;
    recipe.unit_cost = totalCost / recipe.output_quantity;
    
    res.json({ recipe });
  } catch (error) {
    console.error('Error al obtener receta:', error);
    return res.status(500).json({ error: 'Error al obtener receta' });
  }
});

app.post('/api/recipes', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/recipes llamado con data:', req.body);
    const {
      code,
      name,
      description,
      output_component_id,
      output_quantity,
      ingredients
    } = req.body;
    
    // Verificar que el código no existe
    const existingRecipe = await db.get('SELECT id FROM recipes WHERE code = ?', [code]);
    if (existingRecipe) {
      return res.status(400).json({ error: 'Ya existe una receta con este código' });
    }
    
    // Verificar que el componente de salida existe
    const outputComponent = await db.get('SELECT id FROM components WHERE id = ?', [output_component_id]);
    if (!outputComponent) {
      return res.status(400).json({ error: 'El componente de salida no existe' });
    }
    
    // Verificar que todos los ingredientes existen
    for (const ingredient of ingredients) {
      const component = await db.get('SELECT id FROM components WHERE id = ?', [ingredient.component_id]);
      if (!component) {
        return res.status(400).json({ error: `El componente ${ingredient.component_id} no existe` });
      }
    }
    
    // Crear receta
    const recipeId = generateId();
    await db.run(
      `INSERT INTO recipes (
        id, code, name, description, output_component_id, 
        output_quantity, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [recipeId, code, name, description, output_component_id, output_quantity, 1]
    );
    
    // Agregar ingredientes
    for (const ingredient of ingredients) {
      await db.run(
        `INSERT INTO recipe_ingredients (
          id, recipe_id, component_id, quantity, created_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [generateId(), recipeId, ingredient.component_id, ingredient.quantity]
      );
    }
    
    // Obtener receta completa con costos
    const fullRecipe = await db.get(`
      SELECT 
        r.*,
        c.name as output_component_name,
        u.symbol as output_unit_symbol
      FROM recipes r
      JOIN components c ON r.output_component_id = c.id
      LEFT JOIN units u ON c.unit_id = u.id
      WHERE r.id = ?
    `, [recipeId]);
    
    // Calcular costo total
    const ingredientsData = await db.all(`
      SELECT 
        ri.quantity,
        c.cost_price
      FROM recipe_ingredients ri
      JOIN components c ON ri.component_id = c.id
      WHERE ri.recipe_id = ?
    `, [recipeId]);
    
    let totalCost = 0;
    for (const ing of ingredientsData) {
      totalCost += ing.quantity * (ing.cost_price || 0);
    }
    
    fullRecipe.total_cost = totalCost;
    fullRecipe.unit_cost = totalCost / output_quantity;
    
    res.status(201).json({
      message: 'Receta creada exitosamente',
      recipe: fullRecipe
    });
  } catch (error) {
    console.error('Error al crear receta:', error);
    return res.status(500).json({ error: 'Error al crear receta', details: error.message });
  }
});

app.put('/api/recipes/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      output_component_id,
      output_quantity,
      ingredients
    } = req.body;
    
    const existingRecipe = await db.get('SELECT * FROM recipes WHERE id = ? AND is_active = 1', [id]);
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    if (code && code !== existingRecipe.code) {
      const codeExists = await db.get('SELECT id FROM recipes WHERE code = ? AND id != ?', [code, id]);
      if (codeExists) {
        return res.status(400).json({ error: 'Ya existe una receta con este código' });
      }
    }
    
    await db.run(
      `UPDATE recipes SET 
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        description = ?,
        output_component_id = COALESCE(?, output_component_id),
        output_quantity = COALESCE(?, output_quantity),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [code, name, description, output_component_id, output_quantity, id]
    );
    
    if (ingredients && ingredients.length > 0) {
      await db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
      
      for (const ingredient of ingredients) {
        await db.run(
          `INSERT INTO recipe_ingredients (
            id, recipe_id, component_id, quantity, created_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [generateId(), id, ingredient.component_id, ingredient.quantity]
        );
      }
    }
    
    const recipe = await db.get('SELECT * FROM recipes WHERE id = ?', [id]);
    
    res.json({
      message: 'Receta actualizada exitosamente',
      recipe
    });
  } catch (error) {
    console.error('Error al actualizar receta:', error);
    return res.status(500).json({ error: 'Error al actualizar receta' });
  }
});

app.delete('/api/recipes/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingRecipe = await db.get('SELECT * FROM recipes WHERE id = ? AND is_active = 1', [id]);
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }
    
    await db.run('UPDATE recipes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    res.json({
      message: 'Receta eliminada exitosamente',
      recipe: existingRecipe
    });
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    return res.status(500).json({ error: 'Error al eliminar receta' });
  }
});

// ========== RUTAS DE MOVIMIENTOS ==========
app.get('/api/movement-types', authenticate, async (req, res) => {
  try {
    const movementTypes = await db.all('SELECT * FROM movement_types ORDER BY name');
    res.json({ movementTypes });
  } catch (error) {
    console.error('Error al obtener tipos de movimiento:', error);
    return res.status(500).json({ error: 'Error al obtener tipos de movimiento' });
  }
});

app.get('/api/movements', authenticate, async (req, res) => {
  try {
    const movements = await db.all(`
      SELECT 
        m.*,
        mt.code as movement_type_code,
        mt.name as movement_type_name,
        mt.operation,
        c.code as component_code,
        c.name as component_name,
        u.username,
        u.first_name,
        u.last_name
      FROM movements m
      JOIN movement_types mt ON m.movement_type_id = mt.id
      JOIN components c ON m.component_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);
    
    res.json({ movements });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

app.post('/api/movements', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      movement_type_id,
      component_id,
      quantity,
      unit_cost = 0,
      reference_number,
      notes,
    } = req.body;
    
    const user_id = req.user.userId;
    const movementId = generateId();

    // Obtener tipo de movimiento
    const movementType = await db.get(
      'SELECT operation FROM movement_types WHERE id = ?',
      [movement_type_id]
    );
    
    if (!movementType) {
      return res.status(400).json({ error: 'Tipo de movimiento no válido' });
    }

    // Obtener componente actual con precio
    const component = await db.get(
      'SELECT current_stock, reserved_stock, cost_price, name FROM components WHERE id = ?',
      [component_id]
    );
    
    if (!component) {
      return res.status(400).json({ error: 'Componente no encontrado' });
    }

    let newStock = component.current_stock;
    let newReservedStock = component.reserved_stock;
    let priceUpdated = false;
    let oldPrice = component.cost_price;

    // Actualizar stock según operación
    switch (movementType.operation) {
      case 'IN':
        newStock += quantity;
        break;
      case 'OUT':
        if (newStock - newReservedStock < quantity) {
          return res.status(400).json({ error: 'Stock insuficiente' });
        }
        newStock -= quantity;
        break;
    }

    // Para movimientos de compra (IN): actualizar precio si es mayor
    let updateQuery = 'UPDATE components SET current_stock = ?, reserved_stock = ?';
    let updateParams = [newStock, newReservedStock];
    let finalNotes = notes;
    
    if (movementType.operation === 'IN' && unit_cost > 0 && unit_cost > (component.cost_price || 0)) {
      updateQuery += ', cost_price = ?, updated_at = CURRENT_TIMESTAMP';
      updateParams.push(unit_cost);
      priceUpdated = true;
      
      // Agregar nota sobre actualización de precio
      if (finalNotes) {
        finalNotes += ` | PRECIO ACTUALIZADO: $${oldPrice || 0} → $${unit_cost}`;
      } else {
        finalNotes = `PRECIO ACTUALIZADO: $${oldPrice || 0} → $${unit_cost}`;
      }
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(component_id);

    // Actualizar componente
    await db.run(updateQuery, updateParams);

    // Crear movimiento
    await db.run(
      `INSERT INTO movements (
        id, movement_type_id, component_id, quantity, unit_cost,
        reference_number, notes, user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [movementId, movement_type_id, component_id, quantity, unit_cost, reference_number, finalNotes, user_id]
    );

    const movement = await db.get('SELECT * FROM movements WHERE id = ?', [movementId]);

    const response = {
      message: 'Movimiento creado exitosamente',
      movement,
      newStock,
      newReservedStock
    };

    // Agregar información de actualización de precio si ocurrió
    if (priceUpdated) {
      response.priceUpdated = true;
      response.oldPrice = oldPrice;
      response.newPrice = unit_cost;
      response.componentName = component.name;
      response.message += ` - Precio del componente actualizado de $${oldPrice || 0} a $${unit_cost}`;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    return res.status(500).json({ error: 'Error al crear movimiento' });
  }
});

// ========== RUTA DE FACTURA ==========
app.post('/api/movements/invoice', authenticate, requireAdmin, async (req, res) => {
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
        // Si no existe, crear el componente
        component_id = generateId();
        await db.run(
          `INSERT INTO components (
            id, code, name, current_stock, min_stock, max_stock, reserved_stock, cost_price, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [component_id, component_code, component_name, 0, 0, 0, 0, unitCostFinal, 1]
        );
      } else {
        component_id = component.id;
      }
      
      // Obtener stock actual con precio
      const stockData = await db.get(
        'SELECT current_stock, reserved_stock, cost_price, name FROM components WHERE id = ?',
        [component_id]
      );
      
      const { current_stock, reserved_stock, cost_price } = stockData;
      let newStock = parseFloat(current_stock);
      let newReservedStock = parseFloat(reserved_stock);
      let priceUpdated = false;
      let oldPrice = cost_price;

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

      // Para movimientos de compra (IN): actualizar precio si es mayor
      let updateQuery = 'UPDATE components SET current_stock = ?, reserved_stock = ?';
      let updateParams = [newStock, newReservedStock];
      let finalNotes = `${notes || ''} | Item: ${component_name} | Costo base: ${unitCostBase.toFixed(2)} | Costo adicional: ${additionalCostPerUnit.toFixed(2)}`;
      
      if (operation === 'IN' && unitCostFinal > 0 && unitCostFinal > (cost_price || 0)) {
        updateQuery += ', cost_price = ?, updated_at = CURRENT_TIMESTAMP';
        updateParams.push(unitCostFinal);
        priceUpdated = true;
        finalNotes += ` | PRECIO ACTUALIZADO: $${oldPrice || 0} → $${unitCostFinal}`;
      }
      
      updateQuery += ' WHERE id = ?';
      updateParams.push(component_id);

      // Actualizar stock del componente
      await db.run(updateQuery, updateParams);

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
          finalNotes,
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
        price_updated: priceUpdated,
        old_price: oldPrice,
        new_price: priceUpdated ? unitCostFinal : cost_price,
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

// ========== RUTAS DE RESERVAS ==========
app.get('/api/movements/reservations', authenticate, async (req, res) => {
  try {
    // Por ahora devolver lista vacía hasta que se implemente completamente
    res.json({ reservations: [] });
  } catch (error) {
    console.error('Error al obtener reservas:', error);
    return res.status(500).json({ error: 'Error al obtener reservas', details: error.message });
  }
});

app.post('/api/movements/reservations', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      component_id,
      quantity,
      reference,
      notes,
      expires_at
    } = req.body;
    
    const user_id = req.user.userId;
    const reservationId = generateId();

    // Verificar que el componente existe y tiene stock suficiente
    const component = await db.get(
      'SELECT current_stock, reserved_stock FROM components WHERE id = ?',
      [component_id]
    );
    
    if (!component) {
      return res.status(400).json({ error: 'Componente no encontrado' });
    }

    const availableStock = component.current_stock - component.reserved_stock;
    if (availableStock < quantity) {
      return res.status(400).json({ error: 'Stock insuficiente para la reserva' });
    }

    // Actualizar stock reservado
    const newReservedStock = component.reserved_stock + quantity;
    await db.run(
      'UPDATE components SET reserved_stock = ? WHERE id = ?',
      [newReservedStock, component_id]
    );

    // Crear reserva
    await db.run(
      `INSERT INTO reservations (
        id, component_id, quantity, status, reference, notes, 
        expires_at, reserved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [reservationId, component_id, quantity, 'active', reference, notes, expires_at]
    );

    const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', [reservationId]);

    res.status(201).json({
      message: 'Reserva creada exitosamente',
      reservation
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    return res.status(500).json({ error: 'Error al crear reserva' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: PORT, timestamp: new Date() });
});

// Inicializar y arrancar
async function start() {
  try {
    console.log('Iniciando servidor...');
    await initDB();
    console.log('Base de datos conectada');
    
    app.listen(PORT, () => {
      console.log(`Servidor completo corriendo en puerto ${PORT}`);
      console.log(`Acepta conexiones desde puertos 3000, 3005 y 3002`);
      console.log('Rutas disponibles:');
      console.log('- Autenticación: /api/auth/login');
      console.log('- Componentes: /api/components');
      console.log('- Recetas: /api/recipes');
      console.log('- Movimientos: /api/movements');
      console.log('- Categorías: /api/categories');
      console.log('- Unidades: /api/units');
    });
  } catch (error) {
    console.error('Error al iniciar servidor:', error);
  }
}

start().catch(console.error);