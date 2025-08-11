const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function verifyDatabase() {
  const dbPath = path.join(__dirname, 'data/inventory.db');
  console.log('🔍 Verificando base de datos:', dbPath);
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ Error al abrir la base de datos:', err.message);
        return reject(err);
      }
      console.log('✅ Base de datos abierta correctamente');
    });

    // Verificar tablas existentes
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
      if (err) {
        console.error('❌ Error al obtener tablas:', err.message);
        return reject(err);
      }
      
      console.log('\n📋 Tablas encontradas:');
      const tables = rows.map(row => row.name);
      tables.forEach(table => console.log(`  - ${table}`));
      
      // Verificar tablas críticas
      const criticalTables = ['users', 'components', 'movements', 'units', 'categories'];
      const missingTables = criticalTables.filter(table => !tables.includes(table));
      
      if (missingTables.length > 0) {
        console.log('\n⚠️  Tablas faltantes:');
        missingTables.forEach(table => console.log(`  - ${table}`));
      } else {
        console.log('\n✅ Todas las tablas críticas están presentes');
      }
      
      // Contar registros en tablas críticas
      let pendingQueries = 0;
      tables.forEach(table => {
        if (criticalTables.includes(table)) {
          pendingQueries++;
          db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
            if (err) {
              console.log(`❌ Error contando registros en ${table}:`, err.message);
            } else {
              console.log(`📊 ${table}: ${row.count} registros`);
            }
            pendingQueries--;
            if (pendingQueries === 0) {
              db.close();
              resolve(true);
            }
          });
        }
      });
      
      if (pendingQueries === 0) {
        db.close();
        resolve(true);
      }
    });
  });
}

// Ejecutar verificación
verifyDatabase()
  .then(() => {
    console.log('\n🎉 Verificación completada');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Error en verificación:', err.message);
    process.exit(1);
  });