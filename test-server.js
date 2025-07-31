const express = require('express');
const app = express();
const PORT = 3003;

app.use(express.json());

// Test de eliminación simple
app.delete('/api/components/:id', (req, res) => {
  console.log('DELETE llamado para ID:', req.params.id);
  res.json({ message: 'Componente eliminado', id: req.params.id });
});

app.listen(PORT, () => {
  console.log(`Servidor de prueba corriendo en puerto ${PORT}`);
});