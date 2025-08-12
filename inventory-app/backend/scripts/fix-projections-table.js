const { getDb } = require('../dist/config/database-sqlite');

async function fixProjectionsTable() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    // Verificar si la tabla projections existe
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projections'"
    );
    
    if (tableExists) {
      console.log('📊 Tabla projections existe, verificando columnas...');
      
      // Verificar columnas existentes
      const columns = await db.all("PRAGMA table_info(projections)");
      console.log('Columnas actuales:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}`);
      });
      
      // Verificar si falta la columna user_id
      const hasUserId = columns.some(col => col.name === 'user_id');
      
      if (!hasUserId) {
        console.log('⚠️ Falta columna user_id, agregándola...');
        await db.run('ALTER TABLE projections ADD COLUMN user_id TEXT');
        console.log('✅ Columna user_id agregada exitosamente');
      } else {
        console.log('✅ Columna user_id ya existe');
      }
      
      // Verificar estructura final
      const finalColumns = await db.all("PRAGMA table_info(projections)");
      console.log('\n📊 Estructura final de la tabla projections:');
      finalColumns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'NULL'})`);
      });
      
    } else {
      console.log('⚠️ La tabla projections no existe, creándola...');
      
      // Crear la tabla con la estructura completa
      await db.run(`
        CREATE TABLE projections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          user_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      console.log('✅ Tabla projections creada con estructura completa');
    }
    
    // Verificar que las otras tablas relacionadas existan
    console.log('\n📊 Verificando tablas relacionadas...');
    
    // projection_recipes
    const recipesTableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projection_recipes'"
    );
    
    if (!recipesTableExists) {
      console.log('⚠️ Creando tabla projection_recipes...');
      await db.run(`
        CREATE TABLE projection_recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projection_id TEXT NOT NULL,
          recipe_id TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          FOREIGN KEY (projection_id) REFERENCES projections(id) ON DELETE CASCADE,
          FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        )
      `);
      console.log('✅ Tabla projection_recipes creada');
    } else {
      console.log('✅ Tabla projection_recipes ya existe');
    }
    
    // projection_requirements
    const requirementsTableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projection_requirements'"
    );
    
    if (!requirementsTableExists) {
      console.log('⚠️ Creando tabla projection_requirements...');
      await db.run(`
        CREATE TABLE projection_requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projection_id TEXT NOT NULL,
          component_id TEXT NOT NULL,
          required_quantity REAL NOT NULL DEFAULT 0,
          available_quantity REAL NOT NULL DEFAULT 0,
          shortage REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (projection_id) REFERENCES projections(id) ON DELETE CASCADE,
          FOREIGN KEY (component_id) REFERENCES components(id)
        )
      `);
      console.log('✅ Tabla projection_requirements creada');
    } else {
      console.log('✅ Tabla projection_requirements ya existe');
    }
    
    console.log('\n🎉 Estructura de tablas de proyecciones arreglada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar la función
fixProjectionsTable().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});