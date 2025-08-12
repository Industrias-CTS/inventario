const { getDb } = require('../dist/config/database-sqlite');

async function recreateProjectionsTable() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    // Verificar estructura actual
    console.log('📊 Verificando estructura actual de projections...');
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projections'"
    );
    
    if (tableExists) {
      const columns = await db.all("PRAGMA table_info(projections)");
      console.log('Estructura actual (incorrecta):');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'NULL'}, default: ${col.dflt_value || 'none'})`);
      });
      
      // Hacer backup de datos si existen
      console.log('\n📦 Verificando si hay datos para respaldar...');
      const dataCount = await db.get('SELECT COUNT(*) as count FROM projections');
      
      if (dataCount.count > 0) {
        console.log(`⚠️ Hay ${dataCount.count} registros. Haciendo backup...`);
        
        // Crear tabla temporal con estructura correcta
        await db.run(`
          CREATE TABLE projections_backup (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        
        // Copiar solo las columnas que coinciden
        await db.run(`
          INSERT INTO projections_backup (id, name, description, user_id, created_at, updated_at)
          SELECT 
            id, 
            name, 
            COALESCE(description, '') as description,
            user_id,
            COALESCE(created_at, datetime('now')) as created_at,
            COALESCE(updated_at, datetime('now')) as updated_at
          FROM projections
        `);
        
        console.log('✅ Backup creado en projections_backup');
      }
      
      // Eliminar tablas relacionadas primero
      console.log('\n🗑️ Eliminando tablas existentes...');
      await db.run('DROP TABLE IF EXISTS projection_requirements');
      await db.run('DROP TABLE IF EXISTS projection_recipes');
      await db.run('DROP TABLE IF EXISTS projections');
      console.log('✅ Tablas eliminadas');
    }
    
    // Crear tablas con estructura correcta
    console.log('\n📝 Creando tablas con estructura correcta...');
    
    // Tabla principal de proyecciones
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
    console.log('✅ Tabla projections creada correctamente');
    
    // Tabla de recetas de proyección
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
    
    // Tabla de requerimientos
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
    
    // Restaurar datos si había backup
    const backupExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projections_backup'"
    );
    
    if (backupExists) {
      console.log('\n📦 Restaurando datos desde backup...');
      await db.run(`
        INSERT INTO projections (id, name, description, user_id, created_at, updated_at)
        SELECT id, name, description, user_id, created_at, updated_at
        FROM projections_backup
      `);
      
      const restored = await db.get('SELECT COUNT(*) as count FROM projections');
      console.log(`✅ ${restored.count} registros restaurados`);
      
      // Eliminar tabla de backup
      await db.run('DROP TABLE projections_backup');
      console.log('✅ Tabla de backup eliminada');
    }
    
    // Verificar estructura final
    console.log('\n📊 Estructura final de projections:');
    const finalColumns = await db.all("PRAGMA table_info(projections)");
    finalColumns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'NULL'})`);
    });
    
    console.log('\n🎉 Tablas de proyecciones recreadas exitosamente con estructura correcta');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Ejecutar la función
recreateProjectionsTable().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});