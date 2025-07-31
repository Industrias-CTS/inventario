const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkDB() {
  const dbPath = path.join(__dirname, 'data', 'inventory.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  console.log('Checking users table...');
  const users = await db.all('SELECT id, username, email, role FROM users');
  console.log('Users:', users);
  
  console.log('\nChecking components table...');
  const components = await db.all('SELECT id, code, name FROM components LIMIT 5');
  console.log('Components (first 5):', components);
  
  console.log('\nChecking recipes table...');
  const recipes = await db.all('SELECT * FROM recipes');
  console.log('Recipes:', recipes);
  
  await db.close();
}

checkDB().catch(console.error);