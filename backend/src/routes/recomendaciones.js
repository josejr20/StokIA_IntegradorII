const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar } = require('../controllers/recomendacionController');
const router = Router();

// US-21: consulta protegida y de solo lectura.
router.get('/', autenticar, verificarPermiso('ver_kpis'), listar);

module.exports = router;
