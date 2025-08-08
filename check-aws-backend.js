const axios = require('axios');

const SERVER_URL = 'http://34.198.163.51';

async function checkBackend() {
  console.log('=== Verificando Backend en AWS ===\n');
  
  // 1. Check health endpoint
  console.log('1. Verificando endpoint de salud...');
  try {
    const health = await axios.get(`${SERVER_URL}/health`);
    console.log('✅ Health check OK:', health.data);
  } catch (error) {
    console.error('❌ Health check falló:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
  
  // 2. Check API root
  console.log('\n2. Verificando raíz de API...');
  try {
    const api = await axios.get(`${SERVER_URL}/api`);
    console.log('✅ API root OK:', api.data);
  } catch (error) {
    console.error('❌ API root falló:', error.message);
  }
  
  // 3. Check auth login endpoint
  console.log('\n3. Verificando endpoint de login...');
  try {
    const testLogin = await axios.post(`${SERVER_URL}/api/auth/login`, {
      username: 'test',
      password: 'test'
    });
    console.log('✅ Login endpoint responde');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Login endpoint OK (401 esperado para credenciales incorrectas)');
    } else if (error.response && error.response.status === 500) {
      console.error('❌ Error 500 en login:', error.response.data);
    } else {
      console.error('❌ Login endpoint error:', error.message);
    }
  }
  
  // 4. Check CORS headers
  console.log('\n4. Verificando CORS...');
  try {
    const options = await axios.options(`${SERVER_URL}/api/auth/login`, {
      headers: {
        'Origin': 'http://34.198.163.51',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ CORS headers presentes:', options.headers['access-control-allow-origin']);
  } catch (error) {
    console.error('❌ CORS check falló:', error.message);
  }
  
  // 5. Check database connection
  console.log('\n5. Verificando conexión a base de datos...');
  try {
    const categories = await axios.get(`${SERVER_URL}/api/categories`);
    console.log('✅ Base de datos conectada (categorías encontradas):', categories.data.categories?.length || 0);
  } catch (error) {
    console.error('❌ Error de base de datos:', error.response?.data || error.message);
  }
}

checkBackend().then(() => {
  console.log('\n=== Verificación completada ===');
}).catch(err => {
  console.error('Error general:', err);
});