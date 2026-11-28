const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const senhasRoutes = require('./routes/senhasRoutes');
const relatoriosRoutes = require('./routes/relatoriosRoutes');
const guichesRoutes = require('./routes/guichesRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/senhas', senhasRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/guiches', guichesRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = Number(err.status) || 500;
  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    erro: status >= 500 ? 'Erro interno do servidor.' : err.message,
  });
});

module.exports = app;
