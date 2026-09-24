const { v4: uuidv4 } = require('uuid');
const mlClient = {
  obtenerPrediccion: async (productoId, horizonteDias = 7) => {
    return null;
  },
  obtenerRiesgo: async (productoId) => {
    return null;
  },
  obtenerRiesgos_todos: async () => {
    return null;
  },
  obtener_anomalias: async (estado = 'nueva') => {
    return null;
  },
  obtener_historico_comparacion: async (productoId) => {
    return null;
  },
  solicitar_reentrenamiento: async (forzar = false) => {
    return null;
  }
};

module.exports = mlClient;
