const { listarComprobantesAgrupados, obtenerComprobanteAgrupado } = require('../services/comprobanteAgrupadoService');

const listarAgrupados = async (req, res, next) => {
  try {
    const { fecha, cliente_id } = req.query;
    const comprobantes = await listarComprobantesAgrupados({ fecha, cliente_id: cliente_id ? Number(cliente_id) : undefined });
    res.json({ data: comprobantes });
  } catch (error) {
    next(error);
  }
};

const obtenerAgrupado = async (req, res, next) => {
  try {
    const comprobante = await obtenerComprobanteAgrupado(req.params.id);
    if (!comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' });
    res.json({ data: comprobante });
  } catch (error) {
    next(error);
  }
};

module.exports = { listarAgrupados, obtenerAgrupado };
