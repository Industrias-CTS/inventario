const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a la base de datos
const dbPath = path.join(__dirname, '..', 'inventory.db');

console.log('🔄 Conectando a la base de datos...');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🗑️ Eliminando todos los movimientos...');
  
  // Eliminar todos los movimientos
  db.run('DELETE FROM movements', function(err) {
    if (err) {
      console.error('❌ Error al eliminar movimientos:', err);
    } else {
      console.log(`✅ ${this.changes} movimientos eliminados`);
    }
  });

  // Opcional: Resetear el autoincrement si usas uno
  db.run("DELETE FROM sqlite_sequence WHERE name='movements'", (err) => {
    if (err) {
      console.log('ℹ️ No hay secuencia para resetear o error:', err);
    } else {
      console.log('✅ Secuencia de movimientos reseteada');
    }
  });

  // Verificar cuántos movimientos quedan
  db.get('SELECT COUNT(*) as count FROM movements', (err, row) => {
    if (err) {
      console.error('❌ Error al verificar:', err);
    } else {
      console.log(`📊 Movimientos restantes: ${row.count}`);
    }
    
    // Cerrar la base de datos
    db.close((err) => {
      if (err) {
        console.error('❌ Error al cerrar la base de datos:', err);
      } else {
        console.log('✅ Base de datos cerrada correctamente');
        console.log('🎉 Limpieza completada');
      }
    });
  });
});