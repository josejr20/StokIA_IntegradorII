const { Router } = require('express');
const { login, registrar, registrarGoogle, logout, refresh, me, google, forgotPassword, verifyResetCode, resetPassword } = require('../controllers/authController');
const { autenticar } = require('../middleware/authJwt');
const { authRateLimit } = require('../middleware/rateLimit');
const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica al usuario y devuelve token JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '401':
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/auth/refresh:
 *   post:
 *     summary: Refrescar token
 *     description: Genera un nuevo token de acceso usando el refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refrescar token (requiere autenticación)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/login', authRateLimit, login);
router.post('/register', authRateLimit, registrar);
router.post('/registro', authRateLimit, registrar);
router.post('/google', authRateLimit, google);
router.post('/google/register', authRateLimit, registrarGoogle);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/verify-reset-code', authRateLimit, verifyResetCode);
router.post('/reset-password', authRateLimit, resetPassword);
router.post('/refresh', refresh);
router.post('/refresh-token', autenticar, refresh);
router.get('/me', autenticar, me);
router.post('/logout', logout);
module.exports = router;
