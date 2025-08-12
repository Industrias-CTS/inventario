// Script para corregir esquema de la tabla recipes
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Corrigiendo esquema de la tabla recipes...');

db.serialize(() => {
  // 1. Ver el esquema actual
  db.all(`PRAGMA table_info(recipes)`, (err, rows) => {
    if (err) {
      console.error('Error al obtener info de recipes:', err);
      return;
    }
    
    console.log('Esquema actual de recipes:');
    rows.forEach(col => console.log(`- ${col.name}: ${col.type}`));
    
    const columns = rows.map(col => col.name);
    
    // 2. Agregar columnas faltantes
    const columnsToAdd = [
      { name: 'code', type: 'TEXT', check: !columns.includes('code') },
      { name: 'output_component_id', type: 'TEXT', check: !columns.includes('output_component_id') },
      { name: 'output_quantity', type: 'REAL DEFAULT 1', check: !columns.includes('output_quantity') },
      { name: 'production_time', type: 'INTEGER', check: !columns.includes('production_time') }
    ];
    
    columnsToAdd.forEach(col => {
      if (col.check) {
        console.log(`Agregando columna ${col.name}...`);
        db.run(`ALTER TABLE recipes ADD COLUMN ${col.name} ${col.type}`, (err) => {
          if (err) {
            console.error(`Error al agregar ${col.name}:`, err);
          } else {
            console.log(`✅ Columna ${col.name} agregada`);
          }
        });
      } else {
        console.log(`✅ Columna ${col.name} ya existe`);
      }
    });
  });
  
  // 3. También corregir recipe_ingredients si es necesario
  setTimeout(() => {
    db.all(`PRAGMA table_info(recipe_ingredients)`, (err, rows) => {
      if (err) {
        console.error('Error al verificar recipe_ingredients:', err);
        return;
      }
      
      const columns = rows.map(col => col.name);
      
      if (!columns.includes('notes')) {
        console.log('Agregando columna notes a recipe_ingredients...');
        db.run(`ALTER TABLE recipe_ingredients ADD COLUMN notes TEXT`, (err) => {
          if (err) {
            console.error('Error al agregar notes:', err);
          } else {
            console.log('✅ Columna notes agregada a recipe_ingredients');
          }
        });
      } else {
        console.log('✅ Columna notes ya existe en recipe_ingredients');
      }
    });
  }, 1000);
  
  // 4. Cerrar base de datos
  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar base de datos:', err);
      } else {
        console.log('✅ Corrección de esquema completada');
        console.log('🚀 Reinicia el backend con: pm2 restart backend');
      }
    });
  }, 2000);
});

process.on('unhandledRejection', (err) => {
  console.error('Error no manejado:', err);
  process.exit(1);
});