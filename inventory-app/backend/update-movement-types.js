const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function updateMovementTypes() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  try {
    console.log('Actualizando tipos de movimiento...');
    
    // 1. Cambiar "Venta" por "Salida"
    await db.run(
      'UPDATE movement_types SET name = ? WHERE code = ?',
      ['Salida', 'SALE']
    );
    console.log('✅ Cambiado "Venta" por "Salida"');
    
    // 2. Cambiar "Apartado" por "Reserva"
    await db.run(
      'UPDATE movement_types SET name = ? WHERE code = ?',
      ['Reserva', 'RESERVATION']
    );
    console.log('✅ Cambiado "Apartado" por "Reserva"');
    
    // 3. Eliminar "Ajuste de entrada" (pero primero verificar si tiene movimientos asociados)
    const movementsWithAdjustment = await db.get(
      'SELECT COUNT(*) as count FROM movements WHERE movement_type_id = ?',
      ['vazjkzc14']
    );
    
    if (movementsWithAdjustment.count > 0) {
      console.log(`⚠️  No se puede eliminar "Ajuste de entrada" porque tiene ${movementsWithAdjustment.count} movimientos asociados`);
      // Solo marcarlo como inactivo
      await db.run(
        'UPDATE movement_types SET name = ?, is_active = ? WHERE code = ?',
        ['Ajuste de entrada (Inactivo)', 0, 'ADJUSTMENT_IN']
      );
      console.log('✅ Marcado "Ajuste de entrada" como inactivo');
    } else {
      await db.run('DELETE FROM movement_types WHERE code = ?', ['ADJUSTMENT_IN']);
      console.log('✅ Eliminado "Ajuste de entrada"');
    }
    
    // Mostrar tipos de movimiento actuales
    console.log('\n--- Tipos de movimiento actualizados ---');
    const types = await db.all('SELECT * FROM movement_types WHERE is_active = 1 OR is_active IS NULL ORDER BY name');
    types.forEach(type => {
      console.log(`- ${type.name} (${type.code}) - ${type.operation}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

updateMovementTypes().catch(console.error);