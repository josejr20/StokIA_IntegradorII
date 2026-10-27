const { listarRecomendaciones } = require('../services/recomendacionService');

async function listar(req, res, next) {
  try {
    return res.json(await listarRecomendaciones());
  } catch (error) {
    return next(error);
  }
}

module.exports = { listar };
