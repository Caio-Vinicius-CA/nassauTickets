const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const resultado = await authService.login(req.body || {});
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
};
