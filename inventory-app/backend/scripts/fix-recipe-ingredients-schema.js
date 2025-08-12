const { getDb } = require('../dist/config/database-sqlite');

async function fixRecipeIngredientsSchema() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    // Verificar estructura actual de recipe_ingredients
    console.log('📊 Verificando estructura de recipe_ingredients...');
    const tableInfo = await db.all(`PRAGMA table_info(recipe_ingredients)`);
    
    console.log('Columnas actuales:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value || 'NULL'})`);
    });
    
    // Verificar si las columnas necesarias existen
    const hasNotes = tableInfo.some(col => col.name === 'notes');
    const hasUnitSymbol = tableInfo.some(col => col.name === 'unit_symbol');
    const hasCostPrice = tableInfo.some(col => col.name === 'cost_price');
    
    if (!hasNotes) {
      console.log('📝 Agregando columna notes a recipe_ingredients...');
      await db.run(`ALTER TABLE recipe_ingredients ADD COLUMN notes TEXT`);
      console.log('✅ Columna notes agregada exitosamente');
    } else {
      console.log('ℹ️ La columna notes ya existe');
    }
    
    if (!hasUnitSymbol) {
      console.log('📝 Agregando columna unit_symbol a recipe_ingredients...');
      await db.run(`ALTER TABLE recipe_ingredients ADD COLUMN unit_symbol TEXT`);
      console.log('✅ Columna unit_symbol agregada exitosamente');
    } else {
      console.log('ℹ️ La columna unit_symbol ya existe');
    }
    
    if (!hasCostPrice) {
      console.log('📝 Agregando columna cost_price a recipe_ingredients...');
      await db.run(`ALTER TABLE recipe_ingredients ADD COLUMN cost_price REAL DEFAULT 0`);
      console.log('✅ Columna cost_price agregada exitosamente');
    } else {
      console.log('ℹ️ La columna cost_price ya existe');
    }
    
    // Mostrar estructura final
    const finalTableInfo = await db.all(`PRAGMA table_info(recipe_ingredients)`);
    console.log('📊 Estructura final de recipe_ingredients:');
    finalTableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value || 'NULL'})`);
    });
    
    // También verificar la tabla recipes
    console.log('\n📊 Verificando estructura de recipes...');
    const recipesTableInfo = await db.all(`PRAGMA table_info(recipes)`);
    
    const recipesColumns = ['code', 'output_component_id', 'output_quantity', 'production_time'];
    for (const column of recipesColumns) {
      const hasColumn = recipesTableInfo.some(col => col.name === column);
      if (!hasColumn) {
        let columnDef = 'TEXT';
        if (column === 'output_quantity' || column === 'production_time') {
          columnDef = column === 'production_time' ? 'INTEGER DEFAULT 0' : 'REAL DEFAULT 1';
        }
        
        console.log(`📝 Agregando columna ${column} a recipes...`);
        await db.run(`ALTER TABLE recipes ADD COLUMN ${column} ${columnDef}`);
        console.log(`✅ Columna ${column} agregada exitosamente`);
      }
    }
    
    console.log('🎉 Migración de esquemas completada exitosamente');
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  }
}

// Ejecutar la función
fixRecipeIngredientsSchema().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});