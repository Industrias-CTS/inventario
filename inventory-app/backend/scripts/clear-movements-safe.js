const path = require('path');
const { getDb } = require('../dist/config/database-sqlite');

async function clearMovements() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    // Verificar si la tabla existe
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='movements'"
    );
    
    if (!tableExists) {
      console.log('⚠️ La tabla movements no existe. Puede que la base de datos esté vacía.');
      return;
    }
    
    // Contar movimientos actuales
    const countBefore = await db.get('SELECT COUNT(*) as count FROM movements');
    console.log(`📊 Movimientos actuales: ${countBefore.count}`);
    
    if (countBefore.count === 0) {
      console.log('ℹ️ No hay movimientos para eliminar');
      return;
    }
    
    // Eliminar todos los movimientos
    const result = await db.run('DELETE FROM movements');
    console.log(`✅ ${result.changes || 0} movimientos eliminados`);
    
    // Verificar que se eliminaron
    const countAfter = await db.get('SELECT COUNT(*) as count FROM movements');
    console.log(`📊 Movimientos restantes: ${countAfter.count}`);
    
    console.log('🎉 Limpieza completada exitosamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar la función
clearMovements().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});