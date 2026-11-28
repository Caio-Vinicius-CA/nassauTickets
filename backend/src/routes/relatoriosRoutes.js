const express = require('express');
const relatoriosController = require('../controllers/relatoriosController');
const { authMiddleware, gestorMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, gestorMiddleware, relatoriosController.gerar);

module.exports = router;
