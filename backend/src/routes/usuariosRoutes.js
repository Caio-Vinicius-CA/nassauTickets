const express = require('express');
const usuariosController = require('../controllers/usuariosController');
const { authMiddleware, gestorMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware, gestorMiddleware);
router.get('/', usuariosController.listar);
router.post('/', usuariosController.criar);
router.patch('/:id', usuariosController.atualizar);

module.exports = router;
