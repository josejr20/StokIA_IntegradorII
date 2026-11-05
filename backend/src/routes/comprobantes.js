const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listarAgrupados, obtenerAgrupado } = require('../controllers/comprobanteAgrupadoController');

const router = Router();
router.use(autenticar);

router.get('/', verificarPermiso('gestionar_ventas'), listarAgrupados);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtenerAgrupado);

module.exports = router;
