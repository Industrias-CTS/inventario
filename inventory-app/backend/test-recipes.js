const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3008;

app.use(cors());
app.use(express.json());

// Middleware simple de autenticación
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  req.user = { role: 'admin' }; // Simulamos admin
  next();
};

// Ruta de prueba para recetas
app.get('/api/recipes', authenticate, (req, res) => {
  console.log('GET /api/recipes llamado');
  res.json({ 
    recipes: [
      {
        id: '1',
        code: 'REC001',
        name: 'Receta de Prueba',
        total_cost: 100,
        unit_cost: 10
      }
    ] 
  });
});

app.post('/api/recipes', authenticate, (req, res) => {
  console.log('POST /api/recipes llamado');
  console.log('Body:', req.body);
  res.status(201).json({ 
    message: 'Receta creada',
    recipe: { 
      id: '2', 
      ...req.body,
      total_cost: 50,
      unit_cost: 5
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor de prueba de recetas en puerto ${PORT}`);
});