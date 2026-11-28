const senhaService = require('../services/senhaService');

async function emitir(req, res, next) {
  try {
    const senha = await senhaService.emitir(req.body || {});
    res.status(201).json(senha);
  } catch (err) {
    next(err);
  }
}

async function chamarProxima(req, res, next) {
  try {
    const senha = await senhaService.chamarProxima({
      guicheId: req.body?.guiche_id,
      atendenteId: req.usuario.id,
    });
    res.json(senha);
  } catch (err) {
    next(err);
  }
}

async function rechamar(req, res, next) {
  try {
    const senha = await senhaService.rechamar(req.params.id, req.usuario.id);
    res.json(senha);
  } catch (err) {
    next(err);
  }
}

async function iniciar(req, res, next) {
  try {
    const senha = await senhaService.iniciar(req.params.id, req.usuario.id);
    res.json(senha);
  } catch (err) {
    next(err);
  }
}

async function finalizar(req, res, next) {
  try {
    const senha = await senhaService.finalizar(req.params.id, req.usuario.id);
    res.json(senha);
  } catch (err) {
    next(err);
  }
}

async function naoCompareceu(req, res, next) {
  try {
    const senha = await senhaService.naoCompareceu(req.params.id, req.usuario.id);
    res.json(senha);
  } catch (err) {
    next(err);
  }
}

async function encerrarExpediente(req, res, next) {
  try {
    const resultado = await senhaService.encerrarExpediente(req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function painel(req, res, next) {
  try {
    const resultado = await senhaService.painel();
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  emitir,
  chamarProxima,
  rechamar,
  iniciar,
  finalizar,
  naoCompareceu,
  encerrarExpediente,
  painel,
};
