const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { importarKardex, previsualizarKardex, confirmarKardex, upload } = require('../controllers/importarKardexController');

const router = Router();
router.use(autenticar);

router.post('/kardex/previsualizar', verificarPermiso('gestionar_ventas'), upload.single('archivo'), previsualizarKardex);
router.post('/kardex/confirmar', verificarPermiso('gestionar_ventas'), confirmarKardex);
router.post('/kardex', verificarPermiso('gestionar_ventas'), upload.single('archivo'), importarKardex);

module.exports = router;