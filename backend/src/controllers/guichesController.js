const guicheService = require('../services/guicheService');

async function listar(req, res, next) {
  try {
    res.json(await guicheService.listar());
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const guiche = await guicheService.criar(req.body || {});
    res.status(201).json(guiche);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const guiche = await guicheService.atualizar(req.params.id, req.body || {});
    res.json(guiche);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
};
