const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'inventory.db');

try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Base de datos eliminada exitosamente');
  }
  console.log('Ahora reinicia el servidor para crear la nueva base de datos con usuarios');
} catch (error) {
  console.error('Error:', error.message);
  console.log('Por favor detén el servidor backend primero y ejecuta este script nuevamente');
}