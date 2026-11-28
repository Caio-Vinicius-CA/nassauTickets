const express = require('express');
const senhasController = require('../controllers/senhasController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/emitir', senhasController.emitir);
router.post('/chamar-proxima', authMiddleware, senhasController.chamarProxima);
router.post('/encerrar-expediente', authMiddleware, senhasController.encerrarExpediente);
router.get('/painel', senhasController.painel);
router.post('/:id/rechamar', authMiddleware, senhasController.rechamar);
router.post('/:id/iniciar', authMiddleware, senhasController.iniciar);
router.post('/:id/finalizar', authMiddleware, senhasController.finalizar);
router.post('/:id/nao-compareceu', authMiddleware, senhasController.naoCompareceu);

module.exports = router;
