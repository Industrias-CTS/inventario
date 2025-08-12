// Script de migración completa para el servidor AWS
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Iniciando migración completa de la base de datos...');

db.serialize(() => {
  console.log('1. Verificando tabla components...');
  
  // 1. Agregar columna sale_price si no existe
  db.all(`PRAGMA table_info(components)`, (err, rows) => {
    if (err) {
      console.error('Error al obtener información de components:', err);
      return;
    }
    
    const hasSalePrice = rows.some(col => col.name === 'sale_price');
    
    if (!hasSalePrice) {
      console.log('Agregando columna sale_price a components...');
      db.run(`ALTER TABLE components ADD COLUMN sale_price REAL DEFAULT 0`, (err) => {
        if (err) {
          console.error('Error al agregar sale_price:', err);
        } else {
          console.log('✅ Columna sale_price agregada');
          // Actualizar valores existentes
          db.run(`UPDATE components SET sale_price = cost_price * 2 WHERE sale_price = 0`, (err) => {
            if (err) {
              console.error('Error al actualizar sale_price:', err);
            } else {
              console.log('✅ Valores de sale_price actualizados');
            }
          });
        }
      });
    } else {
      console.log('✅ Columna sale_price ya existe');
    }
  });
  
  console.log('2. Creando tablas de recetas...');
  
  // 2. Crear tabla recipes si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      yield_quantity REAL DEFAULT 1,
      yield_unit TEXT DEFAULT 'unit',
      preparation_time INTEGER,
      cost_per_unit REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear tabla recipes:', err);
    } else {
      console.log('✅ Tabla recipes creada/verificada');
    }
  });
  
  // 3. Crear tabla recipe_ingredients si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES components(id),
      quantity REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear tabla recipe_ingredients:', err);
    } else {
      console.log('✅ Tabla recipe_ingredients creada/verificada');
    }
  });
  
  // 4. Verificar si falta la columna notes en recipe_ingredients
  setTimeout(() => {
    db.all(`PRAGMA table_info(recipe_ingredients)`, (err, rows) => {
      if (err) {
        console.error('Error al verificar recipe_ingredients:', err);
        return;
      }
      
      const hasNotes = rows.some(col => col.name === 'notes');
      
      if (!hasNotes) {
        console.log('Agregando columna notes a recipe_ingredients...');
        db.run(`ALTER TABLE recipe_ingredients ADD COLUMN notes TEXT`, (err) => {
          if (err) {
            console.error('Error al agregar notes a recipe_ingredients:', err);
          } else {
            console.log('✅ Columna notes agregada a recipe_ingredients');
          }
        });
      } else {
        console.log('✅ Columna notes ya existe en recipe_ingredients');
      }
    });
  }, 1000);
  
  // 5. Cerrar base de datos después de un tiempo
  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar base de datos:', err);
      } else {
        console.log('✅ Migración completada exitosamente');
        console.log('🚀 Reinicia el backend con: pm2 restart backend');
      }
    });
  }, 2000);
});

process.on('unhandledRejection', (err) => {
  console.error('Error no manejado:', err);
  process.exit(1);
});