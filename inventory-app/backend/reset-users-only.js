const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Ruta a la base de datos
const dbPath = path.join(__dirname, 'data/inventory.db');
const db = new sqlite3.Database(dbPath);

async function resetUsersOnly() {
  console.log('👥 Eliminando todos los usuarios excepto el administrador...');
  
  try {
    // Eliminar todos los usuarios que no sean admin
    const result = await new Promise((resolve, reject) => {
      db.run("DELETE FROM users WHERE username != 'admin'", function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
    
    console.log(`✅ ${result} usuarios eliminados (mantenido el admin)`);
    
    // Verificar que el admin existe y está correctamente configurado
    const admin = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (admin) {
      console.log('✅ Usuario administrador verificado:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Nombre: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Rol: ${admin.role}`);
      console.log(`   Activo: ${admin.is_active ? 'Sí' : 'No'}`);
    } else {
      console.log('❌ No se encontró el usuario administrador');
      
      // Crear usuario admin si no existe
      console.log('🔧 Creando usuario administrador...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminId = Math.random().toString(36).substr(2, 9);
      
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [adminId, 'admin', 'admin@empresa.com', hashedPassword, 'Administrador', 'Sistema', 'admin', 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('✅ Usuario administrador creado');
    }
    
    // Mostrar conteo total de usuarios
    const userCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    console.log(`📊 Total de usuarios en la base de datos: ${userCount}`);
    console.log('🎉 Limpieza de usuarios completada!');
    console.log('📋 Credenciales del administrador:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
  } finally {
    db.close();
  }
}

resetUsersOnly().catch(console.error);