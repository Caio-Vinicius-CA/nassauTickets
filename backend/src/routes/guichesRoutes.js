const express = require('express');
const guichesController = require('../controllers/guichesController');
const { authMiddleware, gestorMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware, gestorMiddleware);
router.get('/', guichesController.listar);
router.post('/', guichesController.criar);
router.patch('/:id', guichesController.atualizar);

module.exports = router;
