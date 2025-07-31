const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3008;

// Crear directorio data si no existe
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Configurar base de datos SQLite
const dbPath = path.join(dataDir, 'inventory.db');
const db = new sqlite3.Database(dbPath);

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3006',
  credentials: true,
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP',
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Función para generar ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Middleware de autenticación
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const decoded = jwt.verify(token, 'supersecretkey123456789inventory');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Crear tablas
db.serialize(() => {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de categorías
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de unidades
  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      symbol TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de componentes
  db.run(`
    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES categories(id),
      unit_id TEXT REFERENCES units(id),
      min_stock REAL DEFAULT 0,
      max_stock REAL,
      current_stock REAL DEFAULT 0,
      reserved_stock REAL DEFAULT 0,
      location TEXT,
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de tipos de movimiento
  db.run(`
    CREATE TABLE IF NOT EXISTS movement_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      operation TEXT CHECK (operation IN ('IN', 'OUT', 'RESERVE', 'RELEASE', 'CONSUME_RESERVED')) NOT NULL
    )
  `);

  // Tabla de movimientos
  db.run(`
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      movement_type_id TEXT REFERENCES movement_types(id),
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      reference_number TEXT,
      notes TEXT,
      user_id TEXT REFERENCES users(id),
      recipe_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de reservas
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      reference TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
      reserved_by TEXT REFERENCES users(id),
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      completed_at DATETIME
    )
  `);

  // Tabla de recetas
  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      output_component_id TEXT REFERENCES components(id),
      output_quantity REAL NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de ingredientes de recetas
  db.run(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT REFERENCES recipes(id),
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recipe_id, component_id)
    )
  `);

  // Tabla de proyecciones
  db.run(`
    CREATE TABLE IF NOT EXISTS projections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      total_recipes INTEGER NOT NULL,
      total_items INTEGER NOT NULL,
      is_feasible BOOLEAN DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de recetas de la proyección
  db.run(`
    CREATE TABLE IF NOT EXISTS projection_recipes (
      id TEXT PRIMARY KEY,
      projection_id TEXT REFERENCES projections(id),
      recipe_id TEXT REFERENCES recipes(id),
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de requerimientos de componentes de la proyección
  db.run(`
    CREATE TABLE IF NOT EXISTS projection_requirements (
      id TEXT PRIMARY KEY,
      projection_id TEXT REFERENCES projections(id),
      component_id TEXT REFERENCES components(id),
      required_quantity REAL NOT NULL,
      available_quantity REAL NOT NULL,
      shortage REAL NOT NULL,
      is_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Verificar y agregar columnas faltantes
  db.all("PRAGMA table_info(movements)", (err, columns) => {
    if (err) {
      console.error('Error verificando columnas:', err);
      return;
    }
    
    const hasTotal = columns.some(col => col.name === 'total_cost');
    const hasUserId = columns.some(col => col.name === 'user_id');
    
    if (!hasTotal) {
      db.run("ALTER TABLE movements ADD COLUMN total_cost REAL DEFAULT 0", (err) => {
        if (err) console.error('Error agregando columna total_cost:', err);
        else console.log('✅ Columna total_cost agregada a movements');
      });
    }
    
    if (!hasUserId) {
      db.run("ALTER TABLE movements ADD COLUMN user_id TEXT", (err) => {
        if (err) console.error('Error agregando columna user_id:', err);
        else console.log('✅ Columna user_id agregada a movements');
      });
    }
  });

  // Verificar y agregar user_id a components si no existe
  db.all("PRAGMA table_info(components)", (err, columns) => {
    if (err) {
      console.error('Error verificando columnas de components:', err);
      return;
    }
    
    const hasUserId = columns.some(col => col.name === 'created_by');
    
    if (!hasUserId) {
      db.run("ALTER TABLE components ADD COLUMN created_by TEXT", (err) => {
        if (err) console.error('Error agregando columna created_by:', err);
        else console.log('✅ Columna created_by agregada a components');
      });
    }
  });

  // Actualizar movimientos sin user_id con el admin por defecto
  setTimeout(() => {
    db.get("SELECT id FROM users WHERE username = 'admin'", (err, adminUser) => {
      if (err || !adminUser) {
        console.error('Error obteniendo usuario admin:', err);
        return;
      }
      
      db.run("UPDATE movements SET user_id = ? WHERE user_id IS NULL", [adminUser.id], function(err) {
        if (err) {
          console.error('Error actualizando user_id en movimientos:', err);
        } else if (this.changes > 0) {
          console.log(`✅ ${this.changes} movimientos actualizados con user_id del admin`);
        }
      });

      db.run("UPDATE components SET created_by = ? WHERE created_by IS NULL", [adminUser.id], function(err) {
        if (err) {
          console.error('Error actualizando created_by en componentes:', err);
        } else if (this.changes > 0) {
          console.log(`✅ ${this.changes} componentes actualizados con created_by del admin`);
        }
      });
    });
  }, 1000);

  // Insertar datos iniciales si no existen
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) console.error(err);
    if (row.count === 0) {
      // Generar IDs
      const unitId = generateId();
      const categoryId = generateId();
      const componentId = generateId();
      const movementTypeIds = {
        purchase: generateId(),
        sale: generateId(),
        adjustment: generateId(),
        reservation: generateId()
      };

      // Insertar datos de ejemplo
      db.run(`INSERT INTO units (id, name, symbol) VALUES (?, ?, ?)`, [unitId, 'Unidades', 'pcs']);
      db.run(`INSERT INTO units (id, name, symbol) VALUES (?, ?, ?)`, [generateId(), 'Kilogramos', 'kg']);
      db.run(`INSERT INTO units (id, name, symbol) VALUES (?, ?, ?)`, [generateId(), 'Metros', 'm']);

      db.run(`INSERT INTO categories (id, name, description) VALUES (?, ?, ?)`, [categoryId, 'Componentes Electrónicos', 'Resistencias, capacitores, etc.']);
      db.run(`INSERT INTO categories (id, name, description) VALUES (?, ?, ?)`, [generateId(), 'Herramientas', 'Herramientas de trabajo']);

      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [movementTypeIds.purchase, 'PURCHASE', 'Compra', 'IN']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [movementTypeIds.sale, 'SALE', 'Venta', 'OUT']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [movementTypeIds.adjustment, 'ADJUSTMENT_IN', 'Ajuste de entrada', 'IN']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [movementTypeIds.reservation, 'RESERVATION', 'Apartado', 'RESERVE']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [generateId(), 'RELEASE', 'Liberación de reserva', 'RELEASE']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [generateId(), 'CONSUMPTION', 'Consumo', 'OUT']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [generateId(), 'ADJUSTMENT_OUT', 'Ajuste de salida', 'OUT']);
      db.run(`INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)`, [generateId(), 'CONSUME_RESERVED', 'Consumo de reserva', 'CONSUME_RESERVED']);

      db.run(`INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, current_stock, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [componentId, 'RES001', 'Resistencia 1K Ohm', 'Resistencia de carbón 1/4W', categoryId, unitId, 10, 50, 0.50, 1.00]);
      db.run(`INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, current_stock, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [generateId(), 'CAP001', 'Capacitor 100uF', 'Capacitor electrolítico', categoryId, unitId, 5, 25, 2.00, 4.00]);
      db.run(`INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, current_stock, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [generateId(), 'LED001', 'LED Rojo 5mm', 'LED de alta luminosidad', categoryId, unitId, 20, 100, 0.25, 0.75]);

      console.log('Datos iniciales insertados en la base de datos SQLite');
    }
  });

  // Crear superusuario admin si no existe
  db.get("SELECT COUNT(*) as count FROM users WHERE username = 'admin'", async (err, row) => {
    if (err) console.error(err);
    if (row.count === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminId = generateId();
      
      db.run(
        `INSERT INTO users (id, username, email, password, first_name, last_name, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminId, 'admin', 'admin@inventory.com', hashedPassword, 'Super', 'Admin', 'admin'],
        function(err) {
          if (err) {
            console.error('Error creando superusuario:', err);
          } else {
            console.log('✅ Superusuario admin creado - Username: admin, Password: admin123');
          }
        }
      );
    } else {
      console.log('✅ Superusuario admin ya existe');
    }
  });
});

// Rutas de autenticación
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err) {
        console.error('Error en login:', err);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      try {
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
          'supersecretkey123456789inventory',
          { expiresIn: '7d' }
        );

        delete user.password;

        res.json({
          message: 'Inicio de sesión exitoso',
          user,
          token,
        });
      } catch (error) {
        console.error('Error verificando password:', error);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
      }
    }
  );
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role = 'user' } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId();

    db.run(
      `INSERT INTO users (id, username, email, password, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, hashedPassword, first_name, last_name, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
          }
          console.error('Error en registro:', err);
          return res.status(500).json({ error: 'Error al registrar usuario' });
        }

        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) {
            console.error('Error obteniendo usuario:', err);
            return res.status(500).json({ error: 'Error al registrar usuario' });
          }

          delete user.password;

          const token = jwt.sign(
            {
              userId: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
            'supersecretkey123456789inventory',
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user,
            token,
          });
        });
      }
    );
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Rutas de componentes
app.get('/api/components', authenticate, (req, res) => {
  const { search } = req.query;
  
  let query = `
    SELECT 
      c.*,
      cat.name as category_name,
      u.name as unit_name,
      u.symbol as unit_symbol
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE c.is_active = 1
  `;
  
  const params = [];
  
  if (search) {
    query += ' AND (c.name LIKE ? OR c.code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY c.name';
  
  db.all(query, params, (err, components) => {
    if (err) {
      console.error('Error al obtener componentes:', err);
      return res.status(500).json({ error: 'Error al obtener componentes' });
    }
    res.json({ components });
  });
});

// Crear componente
app.post('/api/components', authenticate, (req, res) => {
  // Verificar que el usuario sea admin o user
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear componentes' });
  }

  const { code, name, description, category_id, unit_id, min_stock, max_stock, location, cost_price, sale_price } = req.body;
  const componentId = generateId();

  db.run(
    `INSERT INTO components (id, code, name, description, category_id, unit_id, min_stock, max_stock, location, cost_price, sale_price, current_stock, reserved_stock, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    [componentId, code, name, description, category_id || null, unit_id, min_stock || 0, max_stock || null, location || null, cost_price || 0, sale_price || 0, req.user.userId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El código del componente ya existe' });
        }
        console.error('Error al crear componente:', err);
        return res.status(500).json({ error: 'Error al crear componente' });
      }

      db.get(
        `SELECT c.*, cat.name as category_name, u.name as unit_name, u.symbol as unit_symbol
         FROM components c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN units u ON c.unit_id = u.id
         WHERE c.id = ?`,
        [componentId],
        (err, component) => {
          if (err) {
            console.error('Error obteniendo componente:', err);
            return res.status(500).json({ error: 'Error al crear componente' });
          }

          res.status(201).json({
            message: 'Componente creado exitosamente',
            component
          });
        }
      );
    }
  );
});

// Actualizar componente
app.put('/api/components/:id', authenticate, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para editar componentes' });
  }

  const { id } = req.params;
  const { code, name, description, category_id, unit_id, min_stock, max_stock, location, cost_price, sale_price } = req.body;

  db.run(
    `UPDATE components SET code = ?, name = ?, description = ?, category_id = ?, unit_id = ?, 
     min_stock = ?, max_stock = ?, location = ?, cost_price = ?, sale_price = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [code, name, description, category_id || null, unit_id, min_stock || 0, max_stock || null, location || null, cost_price || 0, sale_price || 0, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El código del componente ya existe' });
        }
        console.error('Error al actualizar componente:', err);
        return res.status(500).json({ error: 'Error al actualizar componente' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Componente no encontrado' });
      }

      db.get(
        `SELECT c.*, cat.name as category_name, u.name as unit_name, u.symbol as unit_symbol
         FROM components c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN units u ON c.unit_id = u.id
         WHERE c.id = ?`,
        [id],
        (err, component) => {
          if (err) {
            console.error('Error obteniendo componente:', err);
            return res.status(500).json({ error: 'Error al actualizar componente' });
          }

          res.json({
            message: 'Componente actualizado exitosamente',
            component
          });
        }
      );
    }
  );
});

// Eliminar componente
app.delete('/api/components/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Solo los administradores pueden eliminar componentes' });
  }

  const { id } = req.params;

  // Verificar si el componente tiene movimientos
  db.get('SELECT COUNT(*) as count FROM movements WHERE component_id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error verificando movimientos:', err);
      return res.status(500).json({ error: 'Error al eliminar componente' });
    }

    if (result.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar el componente porque tiene movimientos registrados' });
    }

    db.run('UPDATE components SET is_active = 0 WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error al eliminar componente:', err);
        return res.status(500).json({ error: 'Error al eliminar componente' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Componente no encontrado' });
      }

      res.json({ message: 'Componente eliminado exitosamente' });
    });
  });
});

app.get('/api/movements', authenticate, (req, res) => {
  const query = `
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
  `;
  
  db.all(query, [], (err, movements) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }
    res.json({ movements });
  });
});

app.get('/api/movements/reservations', authenticate, (req, res) => {
  const query = `
    SELECT 
      r.*,
      c.code as component_code,
      c.name as component_name,
      u.username,
      u.first_name,
      u.last_name
    FROM reservations r
    JOIN components c ON r.component_id = c.id
    JOIN users u ON r.reserved_by = u.id
    ORDER BY r.reserved_at DESC
  `;
  
  db.all(query, [], (err, reservations) => {
    if (err) {
      console.error('Error al obtener reservas:', err);
      return res.status(500).json({ error: 'Error al obtener reservas' });
    }
    res.json({ reservations });
  });
});

// Crear movimiento
app.post('/api/movements', authenticate, (req, res) => {
  // Verificar que el usuario sea admin o user
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear movimientos' });
  }

  const { movement_type_id, component_id, quantity, unit_cost, reference_number, notes } = req.body;
  const movementId = generateId();
  const total_cost = (parseFloat(quantity) * parseFloat(unit_cost || 0)) || 0;

  // Primero obtener el tipo de movimiento para determinar la operación
  db.get('SELECT * FROM movement_types WHERE id = ?', [movement_type_id], (err, movementType) => {
    if (err) {
      console.error('Error al obtener tipo de movimiento:', err);
      return res.status(500).json({ error: 'Error al crear movimiento' });
    }

    if (!movementType) {
      return res.status(400).json({ error: 'Tipo de movimiento no encontrado' });
    }

    // Validar stock disponible según el tipo de operación
    if (movementType.operation === 'OUT' || movementType.operation === 'RESERVE' || movementType.operation === 'RELEASE' || movementType.operation === 'CONSUME_RESERVED') {
      db.get('SELECT current_stock, reserved_stock, name FROM components WHERE id = ?', [component_id], (err, component) => {
        if (err) {
          console.error('Error verificando stock:', err);
          return res.status(500).json({ error: 'Error al verificar stock disponible' });
        }

        if (!component) {
          return res.status(400).json({ error: 'Componente no encontrado' });
        }

        // Validaciones específicas por tipo de operación
        if (movementType.operation === 'OUT') {
          const availableStock = component.current_stock - component.reserved_stock;
          if (quantity > availableStock) {
            return res.status(400).json({ 
              error: `Stock insuficiente. Disponible: ${availableStock} unidades de ${component.name}. Solicitado: ${quantity} unidades.`
            });
          }
        } else if (movementType.operation === 'RESERVE') {
          const availableStock = component.current_stock - component.reserved_stock;
          if (quantity > availableStock) {
            return res.status(400).json({ 
              error: `Stock disponible insuficiente para reservar. Disponible: ${availableStock} unidades de ${component.name}. Solicitado: ${quantity} unidades.`
            });
          }
        } else if (movementType.operation === 'RELEASE') {
          if (quantity > component.reserved_stock) {
            return res.status(400).json({ 
              error: `No hay suficiente stock reservado para liberar. Reservado: ${component.reserved_stock} unidades de ${component.name}. Solicitado: ${quantity} unidades.`
            });
          }
        } else if (movementType.operation === 'CONSUME_RESERVED') {
          if (quantity > component.reserved_stock) {
            return res.status(400).json({ 
              error: `No hay suficiente stock reservado para consumir. Reservado: ${component.reserved_stock} unidades de ${component.name}. Solicitado: ${quantity} unidades.`
            });
          }
        }

        // Si las validaciones pasan, proceder con la inserción
        insertMovement();
      });
    } else {
      // Para operaciones IN, proceder directamente
      insertMovement();
    }

    function insertMovement() {
      // Insertar el movimiento
    db.run(
      `INSERT INTO movements (id, movement_type_id, component_id, quantity, unit_cost, total_cost, reference_number, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [movementId, movement_type_id, component_id, quantity, unit_cost || 0, total_cost, reference_number || null, notes || null, req.user.userId],
      function(err) {
        if (err) {
          console.error('Error al crear movimiento:', err);
          return res.status(500).json({ error: 'Error al crear movimiento' });
        }

        // Actualizar el stock del componente según el tipo de operación
        let stockQuery;
        let params;
        
        switch (movementType.operation) {
          case 'IN':
            stockQuery = 'UPDATE components SET current_stock = current_stock + ? WHERE id = ?';
            params = [quantity, component_id];
            break;
          case 'OUT':
            stockQuery = 'UPDATE components SET current_stock = current_stock - ? WHERE id = ?';
            params = [quantity, component_id];
            break;
          case 'RESERVE':
            stockQuery = 'UPDATE components SET reserved_stock = reserved_stock + ? WHERE id = ?';
            params = [quantity, component_id];
            break;
          case 'RELEASE':
            stockQuery = 'UPDATE components SET reserved_stock = reserved_stock - ? WHERE id = ?';
            params = [quantity, component_id];
            break;
          case 'CONSUME_RESERVED':
            // Para consumo de reserva, descontamos tanto del stock actual como del reservado
            stockQuery = 'UPDATE components SET current_stock = current_stock - ?, reserved_stock = reserved_stock - ? WHERE id = ?';
            params = [quantity, quantity, component_id];
            break;
        }

        if (stockQuery) {
          db.run(stockQuery, params, (err) => {
            if (err) {
              console.error('Error actualizando stock:', err);
              return res.status(500).json({ error: 'Error al actualizar stock' });
            }
          });
        }

        // Obtener el movimiento completo para respuesta
        db.get(
          `SELECT 
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
          JOIN users u ON m.user_id = u.id
          WHERE m.id = ?`,
          [movementId],
          (err, movement) => {
            if (err) {
              console.error('Error obteniendo movimiento:', err);
              return res.status(500).json({ error: 'Error al crear movimiento' });
            }

            res.status(201).json({
              message: 'Movimiento creado exitosamente',
              movement
            });
          }
        );
      }
    );
    } // Cierre de insertMovement
  });
});

// Crear reserva
app.post('/api/movements/reservations', authenticate, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear reservas' });
  }

  const { component_id, quantity, reference, expires_at, notes } = req.body;
  const reservationId = generateId();

  // Verificar stock disponible
  db.get('SELECT current_stock, reserved_stock FROM components WHERE id = ?', [component_id], (err, component) => {
    if (err) {
      console.error('Error verificando stock:', err);
      return res.status(500).json({ error: 'Error al crear reserva' });
    }

    if (!component) {
      return res.status(400).json({ error: 'Componente no encontrado' });
    }

    const availableStock = component.current_stock - component.reserved_stock;
    if (quantity > availableStock) {
      return res.status(400).json({ error: 'Stock insuficiente para la reserva' });
    }

    // Crear la reserva
    db.run(
      `INSERT INTO reservations (id, component_id, quantity, reference, expires_at, notes, reserved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [reservationId, component_id, quantity, reference || null, expires_at || null, notes || null, req.user.userId],
      function(err) {
        if (err) {
          console.error('Error al crear reserva:', err);
          return res.status(500).json({ error: 'Error al crear reserva' });
        }

        // Actualizar stock reservado
        db.run('UPDATE components SET reserved_stock = reserved_stock + ? WHERE id = ?', [quantity, component_id], (err) => {
          if (err) {
            console.error('Error actualizando stock reservado:', err);
            return res.status(500).json({ error: 'Error al actualizar stock reservado' });
          }

          // Obtener la reserva completa para respuesta
          db.get(
            `SELECT 
              r.*,
              c.code as component_code,
              c.name as component_name,
              u.username,
              u.first_name,
              u.last_name
            FROM reservations r
            JOIN components c ON r.component_id = c.id
            JOIN users u ON r.reserved_by = u.id
            WHERE r.id = ?`,
            [reservationId],
            (err, reservation) => {
              if (err) {
                console.error('Error obteniendo reserva:', err);
                return res.status(500).json({ error: 'Error al crear reserva' });
              }

              res.status(201).json({
                message: 'Reserva creada exitosamente',
                reservation
              });
            }
          );
        });
      }
    );
  });
});

// Rutas de gestión de usuarios (solo para admins)
app.get('/api/users', authenticate, (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  const query = `
    SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `;
  
  db.all(query, [], (err, users) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      return res.status(500).json({ error: 'Error al obtener usuarios' });
    }
    res.json({ users });
  });
});

app.post('/api/users', authenticate, async (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  try {
    const { username, email, password, first_name, last_name, role = 'user' } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId();

    db.run(
      `INSERT INTO users (id, username, email, password, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, hashedPassword, first_name, last_name, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
          }
          console.error('Error al crear usuario:', err);
          return res.status(500).json({ error: 'Error al crear usuario' });
        }

        db.get('SELECT id, username, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) {
            console.error('Error obteniendo usuario:', err);
            return res.status(500).json({ error: 'Error al crear usuario' });
          }

          res.status(201).json({
            message: 'Usuario creado exitosamente',
            user
          });
        });
      }
    );
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role, is_active, password } = req.body;
    
    let updateFields = [];
    let values = [];
    
    if (username) {
      updateFields.push('username = ?');
      values.push(username);
    }
    if (email) {
      updateFields.push('email = ?');
      values.push(email);
    }
    if (first_name) {
      updateFields.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name) {
      updateFields.push('last_name = ?');
      values.push(last_name);
    }
    if (role) {
      updateFields.push('role = ?');
      values.push(role);
    }
    if (typeof is_active === 'boolean') {
      updateFields.push('is_active = ?');
      values.push(is_active);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        console.error('Error al actualizar usuario:', err);
        return res.status(500).json({ error: 'Error al actualizar usuario' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      db.get('SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
          console.error('Error obteniendo usuario:', err);
          return res.status(500).json({ error: 'Error al actualizar usuario' });
        }

        res.json({
          message: 'Usuario actualizado exitosamente',
          user
        });
      });
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/users/:id', authenticate, (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  const { id } = req.params;

  // Prevenir que el admin se elimine a sí mismo
  if (id === req.user.userId) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al desactivar usuario:', err);
      return res.status(500).json({ error: 'Error al desactivar usuario' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario desactivado exitosamente' });
  });
});

// Rutas para unidades de medida
app.get('/api/units', authenticate, (req, res) => {
  const query = 'SELECT * FROM units ORDER BY name';
  
  db.all(query, [], (err, units) => {
    if (err) {
      console.error('Error al obtener unidades:', err);
      return res.status(500).json({ error: 'Error al obtener unidades' });
    }
    res.json({ units });
  });
});

app.post('/api/units', authenticate, (req, res) => {
  // Verificar que el usuario sea admin o user
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear unidades' });
  }

  const { name, symbol } = req.body;
  const unitId = generateId();

  db.run(
    'INSERT INTO units (id, name, symbol) VALUES (?, ?, ?)',
    [unitId, name, symbol],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El nombre o símbolo de la unidad ya existe' });
        }
        console.error('Error al crear unidad:', err);
        return res.status(500).json({ error: 'Error al crear unidad' });
      }

      db.get('SELECT * FROM units WHERE id = ?', [unitId], (err, unit) => {
        if (err) {
          console.error('Error obteniendo unidad:', err);
          return res.status(500).json({ error: 'Error al crear unidad' });
        }

        res.status(201).json({
          message: 'Unidad creada exitosamente',
          unit
        });
      });
    }
  );
});

app.put('/api/units/:id', authenticate, (req, res) => {
  // Verificar que el usuario sea admin o user
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para editar unidades' });
  }

  const { id } = req.params;
  const { name, symbol } = req.body;

  db.run(
    'UPDATE units SET name = ?, symbol = ? WHERE id = ?',
    [name, symbol, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El nombre o símbolo de la unidad ya existe' });
        }
        console.error('Error al actualizar unidad:', err);
        return res.status(500).json({ error: 'Error al actualizar unidad' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      db.get('SELECT * FROM units WHERE id = ?', [id], (err, unit) => {
        if (err) {
          console.error('Error obteniendo unidad:', err);
          return res.status(500).json({ error: 'Error al actualizar unidad' });
        }

        res.json({
          message: 'Unidad actualizada exitosamente',
          unit
        });
      });
    }
  );
});

app.delete('/api/units/:id', authenticate, (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  const { id } = req.params;

  // Verificar si hay componentes usando esta unidad
  db.get('SELECT COUNT(*) as count FROM components WHERE unit_id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error verificando uso de unidad:', err);
      return res.status(500).json({ error: 'Error al verificar unidad' });
    }

    if (result.count > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar la unidad porque está siendo usada por ${result.count} componente(s)` 
      });
    }

    db.run('DELETE FROM units WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error al eliminar unidad:', err);
        return res.status(500).json({ error: 'Error al eliminar unidad' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      res.json({ message: 'Unidad eliminada exitosamente' });
    });
  });
});

// Rutas para tipos de movimiento
app.get('/api/movement-types', authenticate, (req, res) => {
  const query = 'SELECT * FROM movement_types ORDER BY name';
  
  db.all(query, [], (err, movementTypes) => {
    if (err) {
      console.error('Error al obtener tipos de movimiento:', err);
      return res.status(500).json({ error: 'Error al obtener tipos de movimiento' });
    }
    res.json({ movementTypes });
  });
});

app.post('/api/movement-types', authenticate, (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
  }

  const { code, name, operation } = req.body;
  const movementTypeId = generateId();

  // Validar operation
  const validOperations = ['IN', 'OUT', 'RESERVE', 'RELEASE'];
  if (!validOperations.includes(operation)) {
    return res.status(400).json({ error: 'Operación inválida. Debe ser: IN, OUT, RESERVE, RELEASE' });
  }

  db.run(
    'INSERT INTO movement_types (id, code, name, operation) VALUES (?, ?, ?, ?)',
    [movementTypeId, code, name, operation],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El código del tipo de movimiento ya existe' });
        }
        console.error('Error al crear tipo de movimiento:', err);
        return res.status(500).json({ error: 'Error al crear tipo de movimiento' });
      }

      db.get('SELECT * FROM movement_types WHERE id = ?', [movementTypeId], (err, movementType) => {
        if (err) {
          console.error('Error obteniendo tipo de movimiento:', err);
          return res.status(500).json({ error: 'Error al crear tipo de movimiento' });
        }

        res.status(201).json({
          message: 'Tipo de movimiento creado exitosamente',
          movementType
        });
      });
    }
  );
});

// Rutas para categorías
app.get('/api/categories', authenticate, (req, res) => {
  const query = 'SELECT * FROM categories ORDER BY name';
  
  db.all(query, [], (err, categories) => {
    if (err) {
      console.error('Error al obtener categorías:', err);
      return res.status(500).json({ error: 'Error al obtener categorías' });
    }
    res.json({ categories });
  });
});

app.post('/api/categories', authenticate, (req, res) => {
  // Verificar que el usuario sea admin o user
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear categorías' });
  }

  const { name, description } = req.body;
  const categoryId = generateId();

  db.run(
    'INSERT INTO categories (id, name, description) VALUES (?, ?, ?)',
    [categoryId, name, description],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El nombre de la categoría ya existe' });
        }
        console.error('Error al crear categoría:', err);
        return res.status(500).json({ error: 'Error al crear categoría' });
      }

      db.get('SELECT * FROM categories WHERE id = ?', [categoryId], (err, category) => {
        if (err) {
          console.error('Error obteniendo categoría:', err);
          return res.status(500).json({ error: 'Error al crear categoría' });
        }

        res.status(201).json({
          message: 'Categoría creada exitosamente',
          category
        });
      });
    }
  );
});

// Función para generar PDF con tabla
function generatePDFTable(title, headers, data) {
  const doc = new PDFDocument({ margin: 50 });
  
  // Título
  doc.fontSize(20).text(title, 50, 50);
  doc.fontSize(12).text(`Generado el: ${new Date().toLocaleString()}`, 50, 75);
  
  let y = 110;
  const cellHeight = 20;
  const cellPadding = 5;
  
  // Calcular anchos de columna
  const pageWidth = doc.page.width - 100;
  const columnWidth = pageWidth / headers.length;
  
  // Encabezados
  doc.font('Helvetica-Bold');
  headers.forEach((header, i) => {
    const x = 50 + (i * columnWidth);
    doc.rect(x, y, columnWidth, cellHeight).stroke();
    doc.text(header, x + cellPadding, y + cellPadding, {
      width: columnWidth - (2 * cellPadding),
      align: 'left'
    });
  });
  
  y += cellHeight;
  doc.font('Helvetica');
  
  // Datos
  data.forEach((row) => {
    headers.forEach((header, i) => {
      const x = 50 + (i * columnWidth);
      doc.rect(x, y, columnWidth, cellHeight).stroke();
      
      let cellValue = row[header.toLowerCase().replace(/\s+/g, '_')] || '';
      if (typeof cellValue === 'number') {
        cellValue = cellValue.toString();
      }
      if (cellValue === null || cellValue === undefined) {
        cellValue = '-';
      }
      
      doc.text(cellValue, x + cellPadding, y + cellPadding, {
        width: columnWidth - (2 * cellPadding),
        height: cellHeight - (2 * cellPadding),
        align: 'left'
      });
    });
    y += cellHeight;
    
    // Nueva página si es necesario
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }
  });
  
  return doc;
}

// Rutas de reportes
app.get('/api/reports/inventory', authenticate, (req, res) => {
  const query = `
    SELECT 
      c.code as 'Código',
      c.name as 'Nombre',
      cat.name as 'Categoría',
      c.current_stock as 'Stock Actual',
      c.reserved_stock as 'Stock Reservado',
      (c.current_stock - c.reserved_stock) as 'Stock Disponible',
      c.min_stock as 'Stock Mínimo',
      u.symbol as 'Unidad',
      c.cost_price as 'Precio Costo',
      c.location as 'Ubicación'
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE c.is_active = 1
    ORDER BY c.name
  `;
  
  db.all(query, [], (err, components) => {
    if (err) {
      console.error('Error generando reporte de inventario:', err);
      return res.status(500).json({ error: 'Error generando reporte' });
    }
    
    const headers = ['Código', 'Nombre', 'Categoría', 'Stock Actual', 'Stock Reservado', 'Stock Disponible', 'Stock Mínimo', 'Unidad', 'Precio Costo', 'Ubicación'];
    const doc = generatePDFTable('Reporte de Inventario', headers, components);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-inventario.pdf"');
    
    doc.pipe(res);
    doc.end();
  });
});

app.get('/api/reports/movements', authenticate, (req, res) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      m.created_at as 'Fecha',
      mt.name as 'Tipo',
      mt.operation as 'Operación',
      c.name as 'Componente',
      m.quantity as 'Cantidad',
      m.unit_cost as 'Costo Unitario',
      m.total_cost as 'Costo Total',
      m.reference_number as 'Referencia',
      COALESCE(u.username, u.first_name || ' ' || u.last_name) as 'Usuario'
    FROM movements m
    JOIN movement_types mt ON m.movement_type_id = mt.id
    JOIN components c ON m.component_id = c.id
    JOIN users u ON m.user_id = u.id
  `;
  
  const params = [];
  if (start_date && end_date) {
    query += ' WHERE DATE(m.created_at) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  
  query += ' ORDER BY m.created_at DESC';
  
  db.all(query, params, (err, movements) => {
    if (err) {
      console.error('Error generando reporte de movimientos:', err);
      return res.status(500).json({ error: 'Error generando reporte' });
    }
    
    // Formatear fechas
    movements.forEach(movement => {
      movement.fecha = new Date(movement.fecha).toLocaleString();
    });
    
    const headers = ['Fecha', 'Tipo', 'Operación', 'Componente', 'Cantidad', 'Costo Unitario', 'Costo Total', 'Referencia', 'Usuario'];
    const doc = generatePDFTable('Reporte de Movimientos', headers, movements);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-movimientos.pdf"');
    
    doc.pipe(res);
    doc.end();
  });
});

app.get('/api/reports/low-stock', authenticate, (req, res) => {
  const query = `
    SELECT 
      c.code as 'Código',
      c.name as 'Nombre',
      cat.name as 'Categoría',
      c.current_stock as 'Stock Actual',
      c.min_stock as 'Stock Mínimo',
      (c.min_stock - c.current_stock) as 'Déficit',
      u.symbol as 'Unidad',
      c.location as 'Ubicación'
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE c.is_active = 1 AND c.current_stock <= c.min_stock
    ORDER BY (c.min_stock - c.current_stock) DESC
  `;
  
  db.all(query, [], (err, components) => {
    if (err) {
      console.error('Error generando reporte de stock bajo:', err);
      return res.status(500).json({ error: 'Error generando reporte' });
    }
    
    const headers = ['Código', 'Nombre', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Déficit', 'Unidad', 'Ubicación'];
    const doc = generatePDFTable('Reporte de Stock Bajo', headers, components);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-stock-bajo.pdf"');
    
    doc.pipe(res);
    doc.end();
  });
});

app.get('/api/reports/reservations', authenticate, (req, res) => {
  const query = `
    SELECT 
      r.reserved_at as 'Fecha Reserva',
      c.name as 'Componente',
      r.quantity as 'Cantidad',
      r.status as 'Estado',
      r.reference as 'Referencia',
      r.expires_at as 'Expira',
      COALESCE(u.username, u.first_name || ' ' || u.last_name) as 'Usuario'
    FROM reservations r
    JOIN components c ON r.component_id = c.id
    JOIN users u ON r.reserved_by = u.id
    ORDER BY r.reserved_at DESC
  `;
  
  db.all(query, [], (err, reservations) => {
    if (err) {
      console.error('Error generando reporte de reservas:', err);
      return res.status(500).json({ error: 'Error generando reporte' });
    }
    
    // Formatear fechas
    reservations.forEach(reservation => {
      reservation.fecha_reserva = new Date(reservation.fecha_reserva).toLocaleString();
      if (reservation.expira) {
        reservation.expira = new Date(reservation.expira).toLocaleDateString();
      } else {
        reservation.expira = '-';
      }
    });
    
    const headers = ['Fecha Reserva', 'Componente', 'Cantidad', 'Estado', 'Referencia', 'Expira', 'Usuario'];
    const doc = generatePDFTable('Reporte de Reservas', headers, reservations);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-reservas.pdf"');
    
    doc.pipe(res);
    doc.end();
  });
});

// Rutas de recetas
app.get('/api/recipes', authenticate, (req, res) => {
  const query = `
    SELECT 
      r.*,
      c.code as output_component_code,
      c.name as output_component_name,
      u.symbol as output_unit_symbol
    FROM recipes r
    LEFT JOIN components c ON r.output_component_id = c.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE r.is_active = 1
    ORDER BY r.name
  `;
  
  db.all(query, [], (err, recipes) => {
    if (err) {
      console.error('Error al obtener recetas:', err);
      return res.status(500).json({ error: 'Error al obtener recetas' });
    }
    
    // Para cada receta, obtener sus ingredientes
    const recipesWithIngredients = [];
    let processed = 0;
    
    if (recipes.length === 0) {
      return res.json({ recipes: [] });
    }
    
    recipes.forEach(recipe => {
      db.all(
        `SELECT 
          ri.*,
          c.code as component_code,
          c.name as component_name,
          u.symbol as unit_symbol,
          c.cost_price
        FROM recipe_ingredients ri
        JOIN components c ON ri.component_id = c.id
        LEFT JOIN units u ON c.unit_id = u.id
        WHERE ri.recipe_id = ?`,
        [recipe.id],
        (err, ingredients) => {
          if (err) {
            console.error('Error obteniendo ingredientes:', err);
          }
          
          recipe.ingredients = ingredients || [];
          
          // Calcular costo total
          recipe.total_cost = ingredients ? ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_price), 0) : 0;
          recipe.unit_cost = recipe.output_quantity > 0 ? recipe.total_cost / recipe.output_quantity : 0;
          
          recipesWithIngredients.push(recipe);
          processed++;
          
          if (processed === recipes.length) {
            res.json({ recipes: recipesWithIngredients });
          }
        }
      );
    });
  });
});

app.get('/api/recipes/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT 
      r.*,
      c.code as output_component_code,
      c.name as output_component_name,
      u.symbol as output_unit_symbol
    FROM recipes r
    LEFT JOIN components c ON r.output_component_id = c.id
    LEFT JOIN units u ON c.unit_id = u.id
    WHERE r.id = ? AND r.is_active = 1`,
    [id],
    (err, recipe) => {
      if (err) {
        console.error('Error al obtener receta:', err);
        return res.status(500).json({ error: 'Error al obtener receta' });
      }
      
      if (!recipe) {
        return res.status(404).json({ error: 'Receta no encontrada' });
      }
      
      // Obtener ingredientes
      db.all(
        `SELECT 
          ri.*,
          c.code as component_code,
          c.name as component_name,
          u.symbol as unit_symbol,
          c.cost_price,
          (ri.quantity * c.cost_price) as ingredient_cost
        FROM recipe_ingredients ri
        JOIN components c ON ri.component_id = c.id
        LEFT JOIN units u ON c.unit_id = u.id
        WHERE ri.recipe_id = ?`,
        [id],
        (err, ingredients) => {
          if (err) {
            console.error('Error obteniendo ingredientes:', err);
            return res.status(500).json({ error: 'Error al obtener ingredientes' });
          }
          
          recipe.ingredients = ingredients || [];
          
          // Calcular costos
          recipe.total_cost = ingredients.reduce((sum, ing) => sum + (ing.ingredient_cost || 0), 0);
          recipe.unit_cost = recipe.output_quantity > 0 ? recipe.total_cost / recipe.output_quantity : 0;
          
          res.json({ recipe });
        }
      );
    }
  );
});

app.post('/api/recipes', authenticate, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear recetas' });
  }

  const { code, name, description, output_component_id, output_quantity, ingredients } = req.body;
  const recipeId = generateId();

  db.run(
    `INSERT INTO recipes (id, code, name, description, output_component_id, output_quantity, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [recipeId, code, name, description, output_component_id, output_quantity, req.user.userId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El código de la receta ya existe' });
        }
        console.error('Error al crear receta:', err);
        return res.status(500).json({ error: 'Error al crear receta' });
      }

      // Insertar ingredientes
      const insertIngredients = () => {
        let inserted = 0;
        
        if (!ingredients || ingredients.length === 0) {
          getRecipeAndRespond();
          return;
        }
        
        ingredients.forEach(ingredient => {
          const ingredientId = generateId();
          db.run(
            'INSERT INTO recipe_ingredients (id, recipe_id, component_id, quantity) VALUES (?, ?, ?, ?)',
            [ingredientId, recipeId, ingredient.component_id, ingredient.quantity],
            (err) => {
              if (err) {
                console.error('Error insertando ingrediente:', err);
              }
              inserted++;
              
              if (inserted === ingredients.length) {
                getRecipeAndRespond();
              }
            }
          );
        });
      };

      const getRecipeAndRespond = () => {
        db.get(
          `SELECT 
            r.*,
            c.code as output_component_code,
            c.name as output_component_name,
            u.symbol as output_unit_symbol
          FROM recipes r
          LEFT JOIN components c ON r.output_component_id = c.id
          LEFT JOIN units u ON c.unit_id = u.id
          WHERE r.id = ?`,
          [recipeId],
          (err, recipe) => {
            if (err) {
              console.error('Error obteniendo receta:', err);
              return res.status(500).json({ error: 'Error al crear receta' });
            }

            res.status(201).json({
              message: 'Receta creada exitosamente',
              recipe
            });
          }
        );
      };

      insertIngredients();
    }
  );
});

app.put('/api/recipes/:id', authenticate, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para editar recetas' });
  }

  const { id } = req.params;
  const { code, name, description, output_component_id, output_quantity, ingredients } = req.body;

  db.run(
    `UPDATE recipes SET code = ?, name = ?, description = ?, output_component_id = ?, 
     output_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [code, name, description, output_component_id, output_quantity, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El código de la receta ya existe' });
        }
        console.error('Error al actualizar receta:', err);
        return res.status(500).json({ error: 'Error al actualizar receta' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Receta no encontrada' });
      }

      // Eliminar ingredientes existentes
      db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id], (err) => {
        if (err) {
          console.error('Error eliminando ingredientes:', err);
        }

        // Insertar nuevos ingredientes
        let inserted = 0;
        
        if (!ingredients || ingredients.length === 0) {
          getRecipeAndRespond();
          return;
        }
        
        ingredients.forEach(ingredient => {
          const ingredientId = generateId();
          db.run(
            'INSERT INTO recipe_ingredients (id, recipe_id, component_id, quantity) VALUES (?, ?, ?, ?)',
            [ingredientId, id, ingredient.component_id, ingredient.quantity],
            (err) => {
              if (err) {
                console.error('Error insertando ingrediente:', err);
              }
              inserted++;
              
              if (inserted === ingredients.length) {
                getRecipeAndRespond();
              }
            }
          );
        });
      });

      const getRecipeAndRespond = () => {
        db.get(
          `SELECT 
            r.*,
            c.code as output_component_code,
            c.name as output_component_name,
            u.symbol as output_unit_symbol
          FROM recipes r
          LEFT JOIN components c ON r.output_component_id = c.id
          LEFT JOIN units u ON c.unit_id = u.id
          WHERE r.id = ?`,
          [id],
          (err, recipe) => {
            if (err) {
              console.error('Error obteniendo receta:', err);
              return res.status(500).json({ error: 'Error al actualizar receta' });
            }

            res.json({
              message: 'Receta actualizada exitosamente',
              recipe
            });
          }
        );
      };
    }
  );
});

app.delete('/api/recipes/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Solo los administradores pueden eliminar recetas' });
  }

  const { id } = req.params;

  db.run('UPDATE recipes SET is_active = 0 WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al eliminar receta:', err);
      return res.status(500).json({ error: 'Error al eliminar receta' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    res.json({ message: 'Receta eliminada exitosamente' });
  });
});

// Rutas de proyecciones
app.get('/api/projections', authenticate, (req, res) => {
  const query = `
    SELECT 
      p.*,
      u.username,
      u.first_name,
      u.last_name
    FROM projections p
    LEFT JOIN users u ON p.created_by = u.id
    ORDER BY p.created_at DESC
  `;
  
  db.all(query, [], (err, projections) => {
    if (err) {
      console.error('Error al obtener proyecciones:', err);
      return res.status(500).json({ error: 'Error al obtener proyecciones' });
    }
    res.json({ projections });
  });
});

app.get('/api/projections/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  // Obtener la proyección principal
  db.get(
    `SELECT 
      p.*,
      u.username,
      u.first_name,
      u.last_name
    FROM projections p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?`,
    [id],
    (err, projection) => {
      if (err) {
        console.error('Error al obtener proyección:', err);
        return res.status(500).json({ error: 'Error al obtener proyección' });
      }
      
      if (!projection) {
        return res.status(404).json({ error: 'Proyección no encontrada' });
      }
      
      // Obtener las recetas de la proyección
      db.all(
        `SELECT 
          pr.*,
          r.code as recipe_code,
          r.name as recipe_name
        FROM projection_recipes pr
        JOIN recipes r ON pr.recipe_id = r.id
        WHERE pr.projection_id = ?`,
        [id],
        (err, recipes) => {
          if (err) {
            console.error('Error obteniendo recetas:', err);
            return res.status(500).json({ error: 'Error al obtener recetas' });
          }
          
          // Obtener los requerimientos
          db.all(
            `SELECT 
              pr.*,
              c.code as component_code,
              c.name as component_name,
              u.symbol as unit_symbol
            FROM projection_requirements pr
            JOIN components c ON pr.component_id = c.id
            LEFT JOIN units u ON c.unit_id = u.id
            WHERE pr.projection_id = ?`,
            [id],
            (err, requirements) => {
              if (err) {
                console.error('Error obteniendo requerimientos:', err);
                return res.status(500).json({ error: 'Error al obtener requerimientos' });
              }
              
              projection.recipes = recipes || [];
              projection.requirements = requirements || [];
              
              res.json({ projection });
            }
          );
        }
      );
    }
  );
});

app.post('/api/projections', authenticate, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para crear proyecciones' });
  }

  const { name, description, recipes, requirements } = req.body;
  const projectionId = generateId();
  
  // Calcular totales
  const totalRecipes = recipes.length;
  const totalItems = recipes.reduce((sum, r) => sum + r.quantity, 0);
  const isFeasible = requirements.every(r => r.is_available);

  // Insertar la proyección principal
  db.run(
    `INSERT INTO projections (id, name, description, total_recipes, total_items, is_feasible, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectionId, name, description, totalRecipes, totalItems, isFeasible ? 1 : 0, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error al crear proyección:', err);
        return res.status(500).json({ error: 'Error al crear proyección' });
      }

      // Insertar las recetas
      let recipesInserted = 0;
      let requirementsInserted = 0;
      let hasError = false;

      const checkComplete = () => {
        if (!hasError && recipesInserted === recipes.length && requirementsInserted === requirements.length) {
          db.get(
            `SELECT 
              p.*,
              u.username,
              u.first_name,
              u.last_name
            FROM projections p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = ?`,
            [projectionId],
            (err, projection) => {
              if (err) {
                console.error('Error obteniendo proyección:', err);
                return res.status(500).json({ error: 'Error al crear proyección' });
              }

              res.status(201).json({
                message: 'Proyección guardada exitosamente',
                projection
              });
            }
          );
        }
      };

      // Insertar recetas
      recipes.forEach(recipe => {
        const recipeId = generateId();
        db.run(
          'INSERT INTO projection_recipes (id, projection_id, recipe_id, quantity) VALUES (?, ?, ?, ?)',
          [recipeId, projectionId, recipe.recipe_id, recipe.quantity],
          (err) => {
            if (err) {
              console.error('Error insertando receta de proyección:', err);
              hasError = true;
            }
            recipesInserted++;
            checkComplete();
          }
        );
      });

      // Insertar requerimientos
      requirements.forEach(req => {
        const requirementId = generateId();
        db.run(
          `INSERT INTO projection_requirements 
           (id, projection_id, component_id, required_quantity, available_quantity, shortage, is_available) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [requirementId, projectionId, req.component_id, req.required_quantity, 
           req.available_quantity, req.shortage, req.is_available ? 1 : 0],
          (err) => {
            if (err) {
              console.error('Error insertando requerimiento:', err);
              hasError = true;
            }
            requirementsInserted++;
            checkComplete();
          }
        );
      });
    }
  );
});

app.delete('/api/projections/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Solo los administradores pueden eliminar proyecciones' });
  }

  const { id } = req.params;

  // Eliminar requerimientos primero
  db.run('DELETE FROM projection_requirements WHERE projection_id = ?', [id], (err) => {
    if (err) {
      console.error('Error eliminando requerimientos:', err);
      return res.status(500).json({ error: 'Error al eliminar proyección' });
    }

    // Eliminar recetas
    db.run('DELETE FROM projection_recipes WHERE projection_id = ?', [id], (err) => {
      if (err) {
        console.error('Error eliminando recetas:', err);
        return res.status(500).json({ error: 'Error al eliminar proyección' });
      }

      // Eliminar proyección principal
      db.run('DELETE FROM projections WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error eliminando proyección:', err);
          return res.status(500).json({ error: 'Error al eliminar proyección' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Proyección no encontrada' });
        }

        res.json({ message: 'Proyección eliminada exitosamente' });
      });
    });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} con base de datos SQLite`);
  console.log(`Base de datos ubicada en: ${dbPath}`);
});