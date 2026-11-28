const relatorioService = require('../services/relatorioService');

async function gerar(req, res, next) {
  try {
    const relatorio = await relatorioService.gerar({
      periodo: req.query.periodo,
      data: req.query.data,
    });
    res.json(relatorio);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  gerar,
};
