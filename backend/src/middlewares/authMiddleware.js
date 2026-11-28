const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = {
      id: payload.id,
      nome: payload.nome,
      perfil: payload.perfil,
    };
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function gestorMiddleware(req, res, next) {
  if (req.usuario?.perfil !== 'GESTOR') {
    return res.status(403).json({ erro: 'Acesso restrito ao perfil GESTOR.' });
  }
  return next();
}

module.exports = {
  authMiddleware,
  gestorMiddleware,
};
