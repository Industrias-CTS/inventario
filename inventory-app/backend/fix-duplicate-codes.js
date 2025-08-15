const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'data', 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando códigos duplicados en la base de datos...\n');

// Promisify para usar async/await
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runCommand = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

async function checkAndFixDuplicates() {
  try {
    // 1. Buscar códigos duplicados exactos
    console.log('1. Buscando códigos duplicados exactos...');
    const exactDuplicates = await runQuery(`
      SELECT code, COUNT(*) as count 
      FROM components 
      GROUP BY code 
      HAVING count > 1
    `);
    
    if (exactDuplicates.length > 0) {
      console.log('   ⚠️  Códigos duplicados encontrados:');
      for (const dup of exactDuplicates) {
        console.log(`      - "${dup.code}" (${dup.count} veces)`);
        
        // Mostrar todos los componentes con ese código
        const components = await runQuery(
          'SELECT id, code, name FROM components WHERE code = ?',
          [dup.code]
        );
        
        components.forEach(comp => {
          console.log(`        • ID: ${comp.id}, Nombre: ${comp.name}`);
        });
      }
    } else {
      console.log('   ✅ No se encontraron códigos duplicados exactos');
    }
    
    // 2. Buscar códigos con espacios o variaciones
    console.log('\n2. Buscando códigos con espacios o mayúsculas...');
    const problematicCodes = await runQuery(`
      SELECT id, code, name,
        CASE 
          WHEN code != TRIM(code) THEN 'tiene espacios'
          WHEN code != LOWER(code) THEN 'tiene mayúsculas'
          ELSE 'ok'
        END as issue
      FROM components 
      WHERE code != TRIM(code) OR code != LOWER(code)
    `);
    
    if (problematicCodes.length > 0) {
      console.log('   ⚠️  Códigos problemáticos encontrados:');
      for (const comp of problematicCodes) {
        console.log(`      - "${comp.code}" (${comp.name}) - ${comp.issue}`);
      }
    } else {
      console.log('   ✅ No se encontraron códigos con espacios o mayúsculas');
    }
    
    // 3. Buscar posibles duplicados considerando trim y lowercase
    console.log('\n3. Buscando duplicados considerando espacios y mayúsculas...');
    const normalizedDuplicates = await runQuery(`
      SELECT LOWER(TRIM(code)) as normalized_code, COUNT(*) as count
      FROM components
      GROUP BY LOWER(TRIM(code))
      HAVING count > 1
    `);
    
    if (normalizedDuplicates.length > 0) {
      console.log('   ⚠️  Códigos que serían duplicados al normalizar:');
      for (const dup of normalizedDuplicates) {
        console.log(`\n      Código normalizado: "${dup.normalized_code}" (${dup.count} variaciones)`);
        
        // Mostrar las variaciones
        const variations = await runQuery(
          'SELECT id, code, name FROM components WHERE LOWER(TRIM(code)) = ?',
          [dup.normalized_code]
        );
        
        variations.forEach(comp => {
          console.log(`        • "${comp.code}" - ${comp.name} (ID: ${comp.id})`);
        });
      }
      
      // Preguntar si se quiere arreglar
      console.log('\n⚠️  IMPORTANTE: Se encontraron códigos que podrían ser duplicados.');
      console.log('   Para arreglar esto automáticamente, ejecute:');
      console.log('   node fix-duplicate-codes.js --fix\n');
      
      if (process.argv.includes('--fix')) {
        console.log('📝 Aplicando correcciones...\n');
        
        for (const dup of normalizedDuplicates) {
          const variations = await runQuery(
            'SELECT id, code, name FROM components WHERE LOWER(TRIM(code)) = ? ORDER BY created_at',
            [dup.normalized_code]
          );
          
          // Mantener el primero, actualizar los demás
          const original = variations[0];
          console.log(`   Manteniendo: "${original.code}" (${original.name})`);
          
          for (let i = 1; i < variations.length; i++) {
            const newCode = `${variations[i].code}_${i}`;
            console.log(`   Cambiando "${variations[i].code}" a "${newCode}"`);
            
            await runCommand(
              'UPDATE components SET code = ? WHERE id = ?',
              [newCode, variations[i].id]
            );
          }
        }
        
        console.log('\n✅ Correcciones aplicadas');
      }
    } else {
      console.log('   ✅ No se encontraron duplicados al normalizar');
    }
    
    // 4. Verificar integridad de constraint UNIQUE
    console.log('\n4. Verificando integridad del constraint UNIQUE...');
    const indexInfo = await runQuery(`
      SELECT sql FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = 'components' AND sql LIKE '%code%'
    `);
    
    if (indexInfo.length > 0) {
      console.log('   ✅ Índice UNIQUE en campo code está presente');
    } else {
      console.log('   ⚠️  No se encontró índice UNIQUE para el campo code');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    db.close();
    console.log('\n🏁 Verificación completada');
  }
}

// Ejecutar
checkAndFixDuplicates();