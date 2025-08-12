import { getDb } from '../config/database-sqlite';

async function addSalePriceColumn() {
  try {
    const db = await getDb();
    
    // Verificar si la columna ya existe
    const tableInfo = await db.all(`PRAGMA table_info(components)`);
    const hasSalePrice = tableInfo.some((col: any) => col.name === 'sale_price');
    
    if (!hasSalePrice) {
      console.log('Agregando columna sale_price a la tabla components...');
      await db.run(`ALTER TABLE components ADD COLUMN sale_price REAL DEFAULT 0`);
      console.log('Columna sale_price agregada exitosamente');
      
      // Actualizar valores existentes con un valor por defecto basado en cost_price
      await db.run(`UPDATE components SET sale_price = cost_price * 2 WHERE sale_price = 0 OR sale_price IS NULL`);
      console.log('Valores de sale_price actualizados');
    } else {
      console.log('La columna sale_price ya existe');
    }
  } catch (error) {
    console.error('Error al agregar columna sale_price:', error);
    throw error;
  }
}

// Ejecutar migración si se ejecuta directamente
if (require.main === module) {
  addSalePriceColumn()
    .then(() => {
      console.log('Migración completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error en la migración:', error);
      process.exit(1);
    });
}

export default addSalePriceColumn;