const { getDb } = require('../dist/config/database-sqlite');

async function createProjectionsTables() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const db = await getDb();
    
    console.log('📝 Creando tablas de proyecciones...');
    
    // Crear tabla projections
    await db.run(`
      CREATE TABLE IF NOT EXISTS projections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Tabla projections creada');
    
    // Crear tabla projection_recipes
    await db.run(`
      CREATE TABLE IF NOT EXISTS projection_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projection_id TEXT NOT NULL,
        recipe_id TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        FOREIGN KEY (projection_id) REFERENCES projections(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
      )
    `);
    console.log('✅ Tabla projection_recipes creada');
    
    // Crear tabla projection_requirements
    await db.run(`
      CREATE TABLE IF NOT EXISTS projection_requirements (
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
    
    // Verificar las tablas creadas
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'projection%'"
    );
    
    console.log('📊 Tablas de proyecciones disponibles:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    console.log('🎉 Tablas de proyecciones creadas exitosamente');
  } catch (error) {
    console.error('❌ Error al crear tablas:', error.message);
    throw error;
  }
}

// Ejecutar la función
createProjectionsTables().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});