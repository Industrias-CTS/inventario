const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'inventory.db');
const db = new Database(dbPath);

console.log('🚀 Iniciando migración del módulo de remisiones...');

try {
  db.exec('BEGIN TRANSACTION');

  // Verificar si las tablas ya existen
  const tablesExist = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('deliveries', 'delivery_items')
  `).all();

  if (tablesExist.length > 0) {
    console.log('⚠️  Las tablas de remisiones ya existen. Omitiendo creación...');
  } else {
    console.log('📋 Creando tablas de remisiones...');

    // Crear tabla de remisiones
    db.exec(`
      CREATE TABLE deliveries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        delivery_number TEXT UNIQUE NOT NULL,
        recipient_name TEXT NOT NULL,
        recipient_company TEXT,
        recipient_id TEXT,
        delivery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        signature_data TEXT,
        delivery_address TEXT,
        phone TEXT,
        email TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de items de remisión
    db.exec(`
      CREATE TABLE delivery_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        delivery_id TEXT REFERENCES deliveries(id) ON DELETE CASCADE,
        component_id TEXT REFERENCES components(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL,
        serial_numbers TEXT,
        unit_price REAL DEFAULT 0,
        total_price REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tablas de remisiones creadas exitosamente');
  }

  // Crear índices
  console.log('📊 Creando índices...');
  const createIndexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_number ON deliveries(delivery_number);',
    'CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);',
    'CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);',
    'CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON deliveries(created_by);',
    'CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON delivery_items(delivery_id);',
    'CREATE INDEX IF NOT EXISTS idx_delivery_items_component_id ON delivery_items(component_id);'
  ];

  createIndexQueries.forEach(query => {
    db.exec(query);
  });

  console.log('✅ Índices creados exitosamente');

  // Agregar tipo de movimiento DELIVERY si no existe
  console.log('🔄 Agregando tipo de movimiento DELIVERY...');
  const deliveryTypeExists = db.prepare(`
    SELECT COUNT(*) as count FROM movement_types WHERE code = 'DELIVERY'
  `).get();

  if (deliveryTypeExists.count === 0) {
    db.prepare(`
      INSERT INTO movement_types (id, code, name, operation) 
      VALUES (lower(hex(randomblob(16))), 'DELIVERY', 'Remisión/Entrega', 'OUT')
    `).run();
    console.log('✅ Tipo de movimiento DELIVERY agregado');
  } else {
    console.log('⚠️  Tipo de movimiento DELIVERY ya existe');
  }

  // Crear triggers para updated_at (SQLite no tiene función automática)
  console.log('⚡ Creando triggers...');
  
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_deliveries_updated_at 
    AFTER UPDATE ON deliveries
    FOR EACH ROW
    BEGIN
      UPDATE deliveries SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  console.log('✅ Triggers creados exitosamente');

  // Crear función para generar números de remisión (simulada con SQLite)
  console.log('📝 Configurando generación de números de remisión...');

  db.exec('COMMIT');
  console.log('✅ Migración completada exitosamente!');

  // Mostrar estadísticas
  const deliveriesCount = db.prepare('SELECT COUNT(*) as count FROM deliveries').get();
  const deliveryItemsCount = db.prepare('SELECT COUNT(*) as count FROM delivery_items').get();
  
  console.log('\n📈 Estadísticas después de la migración:');
  console.log(`- Remisiones: ${deliveriesCount.count}`);
  console.log(`- Items de remisión: ${deliveryItemsCount.count}`);

  console.log('\n🎉 ¡El módulo de remisiones está listo para usar!');
  console.log('💡 Recuerda reiniciar el servidor backend para que los cambios tomen efecto');

} catch (error) {
  console.error('❌ Error durante la migración:', error.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}

// Función auxiliar para generar números de remisión
function generateDeliveryNumber() {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 9999) + 1;
  return `REM-${year}-${sequence.toString().padStart(4, '0')}`;
}

console.log('\n📄 Ejemplo de número de remisión que se generaría:', generateDeliveryNumber());