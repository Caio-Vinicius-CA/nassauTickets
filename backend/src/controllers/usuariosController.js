const usuarioService = require('../services/usuarioService');

async function listar(req, res, next) {
  try {
    res.json(await usuarioService.listar());
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const usuario = await usuarioService.criar(req.body || {});
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const usuario = await usuarioService.atualizar(req.params.id, req.body || {});
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
};
