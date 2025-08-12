// Script de migración para ejecutar en el servidor
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Conectando a la base de datos...');

db.serialize(() => {
  // Verificar si la columna sale_price existe
  db.all(`PRAGMA table_info(components)`, (err, rows) => {
    if (err) {
      console.error('Error al obtener información de la tabla:', err);
      db.close();
      process.exit(1);
    }
    
    const hasSalePrice = rows.some(col => col.name === 'sale_price');
    
    if (!hasSalePrice) {
      console.log('Agregando columna sale_price...');
      
      db.run(`ALTER TABLE components ADD COLUMN sale_price REAL DEFAULT 0`, (err) => {
        if (err) {
          console.error('Error al agregar columna:', err);
          db.close();
          process.exit(1);
        }
        
        console.log('Columna sale_price agregada exitosamente');
        
        // Actualizar valores existentes
        db.run(`UPDATE components SET sale_price = cost_price * 2 WHERE sale_price = 0 OR sale_price IS NULL`, (err) => {
          if (err) {
            console.error('Error al actualizar valores:', err);
          } else {
            console.log('Valores de sale_price actualizados');
          }
          
          db.close();
          console.log('Migración completada exitosamente');
        });
      });
    } else {
      console.log('La columna sale_price ya existe');
      db.close();
    }
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Error no manejado:', err);
  db.close();
  process.exit(1);
});