const { getDb } = require('../dist/config/database-sqlite');

async function addProductionTimeColumn() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    // Verificar si la columna ya existe
    const tableInfo = await db.all(`PRAGMA table_info(recipes)`);
    const hasProductionTime = tableInfo.some(col => col.name === 'production_time');
    
    if (!hasProductionTime) {
      console.log('📝 Agregando columna production_time a la tabla recipes...');
      await db.run(`ALTER TABLE recipes ADD COLUMN production_time INTEGER DEFAULT 0`);
      console.log('✅ Columna production_time agregada exitosamente');
    } else {
      console.log('ℹ️ La columna production_time ya existe');
    }
    
    // Verificar otras columnas que podrían faltar
    const hasCode = tableInfo.some(col => col.name === 'code');
    const hasOutputComponentId = tableInfo.some(col => col.name === 'output_component_id');
    const hasOutputQuantity = tableInfo.some(col => col.name === 'output_quantity');
    
    if (!hasCode) {
      console.log('📝 Agregando columna code a la tabla recipes...');
      await db.run(`ALTER TABLE recipes ADD COLUMN code TEXT`);
      console.log('✅ Columna code agregada exitosamente');
    }
    
    if (!hasOutputComponentId) {
      console.log('📝 Agregando columna output_component_id a la tabla recipes...');
      await db.run(`ALTER TABLE recipes ADD COLUMN output_component_id TEXT`);
      console.log('✅ Columna output_component_id agregada exitosamente');
    }
    
    if (!hasOutputQuantity) {
      console.log('📝 Agregando columna output_quantity a la tabla recipes...');
      await db.run(`ALTER TABLE recipes ADD COLUMN output_quantity REAL DEFAULT 1`);
      console.log('✅ Columna output_quantity agregada exitosamente');
    }
    
    // Mostrar estructura final de la tabla
    const finalTableInfo = await db.all(`PRAGMA table_info(recipes)`);
    console.log('📊 Estructura final de la tabla recipes:');
    finalTableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value || 'NULL'})`);
    });
    
    console.log('🎉 Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  }
}

// Ejecutar la función
addProductionTimeColumn().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});