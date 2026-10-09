const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { importarKardex, upload } = require('../controllers/importarKardexController');

const router = Router();
router.use(autenticar);

router.post('/kardex', verificarPermiso('gestionar_ventas'), upload.single('archivo'), importarKardex);

module.exports = router;