const { v4: uuidv4 } = require('uuid');
const { Alerta } = require('../models');
const mlClient = require('../ml_client');
const config = require('../config');
const logger = require('../utils/logger');

const obtenerPrediccion = async (productoId, horizonteDias = 7) => {
  return mlClient.obtenerPrediccion(productoId, horizonteDias);
};

const obtenerRiesgo = async (productoId) => {
  return mlClient.obtenerRiesgo(productoId);
};

const obtenerRiesgosTodos = async () => {
  return mlClient.obtenerRiesgos_todos();
};

const obtenerAnomalias = async (estado = 'nueva') => {
  return mlClient.obtener_anomalias(estado);
};

const obtenerHistoricoComparacion = async (productoId) => {
  return mlClient.obtener_historico_comparacion(productoId);
};

const solicitarReentrenamiento = async (forzar = false) => {
  return mlClient.solicitar_reentrenamiento(forzar);
};

const sincronizarAlertasML = async () => {
  const anomalias = await obtenerAnomalias('nueva');
  if (!anomalias) return { procesadas: 0 };

  let procesadas = 0;
  for (const anomalia of anomalias) {
    await Alerta.create({
      tipo: 'anomalia',
      producto_id: anomalia.producto_id,
      mensaje: anomalia.descripcion,
      severidad: anomalia.severidad || 'media',
      datos_origen: { origen: 'ml', anomalia_id: anomalia.id },
      estado: 'nueva'
    });
    procesadas++;
  }

  logger.info(`Alertas ML sincronizadas: ${procesadas}`);
  return { procesadas };
};

module.exports = {
  obtenerPrediccion, obtenerRiesgo, obtenerRiesgosTodos,
  obtenerAnomalias, obtenerHistoricoComparacion, solicitarReentrenamiento,
  sincronizarAlertasML
};
