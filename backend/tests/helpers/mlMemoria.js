// Ayudas compartidas por las pruebas de HU-82: datos de ventas simulados (deterministas) y un repositorio en memoria
// con la misma forma que las tablas ml.* (ml.modelos, ml.entrenamientos_log, ml.preparaciones_log, ml.configuracion).
const demanda = require('../../src/services/prediccionDemandaModelo');
const { ALGORITMO } = require('../../src/services/mlModeloRepositorio');

const AHORA = new Date('2026-10-23T10:00:00-05:00'); // el último día completo es el 22/oct
const HASTA = '2026-10-22';

// ---- datos simulados (deterministas)
function generador(semilla) {
  let valor = semilla;
  const aleatorio = () => {
    valor = (valor * 1664525 + 1013904223) % 4294967296;
    return valor / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(aleatorio() + 1e-12)) * Math.cos(2 * Math.PI * aleatorio());
  return { aleatorio, gauss };
}

const PATRON_SEMANAL = [0.5, 0.95, 1, 1.05, 1.1, 1.4, 1.5]; // domingo ... sábado

function ventasSimuladas({ productos = 12, dias: cantidadDias = 84, hasta = HASTA, ruido = 0.2, semilla = 7, cambio = null } = {}) {
  const { aleatorio, gauss } = generador(semilla);
  const ventas = [];
  for (let producto = 1; producto <= productos; producto += 1) {
    const base = 5 + aleatorio() * 35;
    for (let i = cantidadDias - 1; i >= 0; i -= 1) {
      const fecha = demanda.sumarDias(hasta, -i);
      let media = base * PATRON_SEMANAL[demanda.diaSemana(fecha)];
      if (cambio && i < cambio.ultimosDias) media *= cambio.factor; // cambio brusco de demanda
      const cantidad = Math.max(0, Math.round(media + gauss() * media * ruido));
      if (cantidad > 0) ventas.push({ producto_id: producto, cantidad: String(cantidad), fecha_venta: `${fecha}T12:00:00-05:00` });
    }
  }
  return ventas;
}

// ---- tablas ml.* en memoria (mismas reglas que mlModeloRepositorio)
function crearRepositorio({ ventas = [], minimoFilas = 50 } = {}) {
  const memoria = { modelos: [], entrenamientos: [], preparaciones: [], ventas, reloj: 0 };
  const reloj = () => new Date(Date.parse('2026-10-23T15:00:00Z') + (memoria.reloj += 1000));
  const copiar = (valor) => (valor ? structuredClone(valor) : null);
  const nuestros = () => memoria.modelos.filter((modelo) => modelo.algoritmo === ALGORITMO);
  return {
    memoria,
    obtenerModeloActivo: async () => {
      const activo = nuestros().filter((m) => m.activo).sort((a, b) => b.version - a.version)[0];
      return activo ? { ...copiar(activo), parametros: activo.metadata.parametros ?? null } : null;
    },
    obtenerModeloActivoOtro: async () => copiar(memoria.modelos.find((m) => m.activo && m.algoritmo !== ALGORITMO) ?? null),
    obtenerModelo: async (id) => copiar(memoria.modelos.find((modelo) => modelo.id === id)),
    listarModelos: async () => nuestros().sort((a, b) => b.version - a.version).map(copiar),
    registrarModelo: async ({ metadata, mae, rmse, filas_entrenamiento: filas, notas, activar }) => {
      const version = Math.max(0, ...memoria.modelos.map((m) => m.version)) + 1; // el mayor de TODA la tabla + 1
      // índice único de ml.modelos: UN solo modelo activo en toda la tabla; si otro algoritmo lo tiene, no se le quita
      const otro = memoria.modelos.find((m) => m.activo && m.algoritmo !== ALGORITMO);
      const bloqueadoPor = activar === true && otro ? { version: otro.version, algoritmo: otro.algoritmo } : null;
      const activarAhora = activar === true && !otro;
      if (activarAhora) nuestros().forEach((m) => { m.activo = false; });
      const modelo = {
        id: memoria.modelos.length + 1, version, algoritmo: ALGORITMO, activo: activarAhora, mae, rmse,
        filas_entrenamiento: filas, ruta_artefacto: 'metadata:parametros', metadata: structuredClone(metadata),
        fecha_creacion: reloj(), notas,
      };
      memoria.modelos.push(modelo);
      return { ...copiar(modelo), bloqueado_por: bloqueadoPor };
    },
    activarModelo: async (id, parche) => {
      const previo = memoria.modelos.find((m) => m.activo && m.id !== id);
      const desactivado = previo ? { version: previo.version, algoritmo: previo.algoritmo } : null;
      memoria.modelos.forEach((m) => { if (m.id !== id) m.activo = false; }); // la activación manual libera el lugar
      const modelo = memoria.modelos.find((m) => m.id === id);
      modelo.activo = true;
      modelo.metadata = { ...modelo.metadata, ...parche };
      return { ...copiar(modelo), desactivado };
    },
    actualizarMetadata: async (id, parche) => {
      const modelo = memoria.modelos.find((m) => m.id === id);
      modelo.metadata = { ...modelo.metadata, ...parche };
    },
    registrarEntrenamiento: async ({ modeloId = null, disparadoPor, resultado, promovido, mensaje, duracionMs = null, iniciadoEn = null, finalizadoEn = null }) => {
      memoria.entrenamientos.push({
        id: memoria.entrenamientos.length + 1, modelo_id: modeloId, disparado_por: disparadoPor, resultado, promovido, mensaje, fecha: reloj(),
        duracion_ms: duracionMs, iniciado_en: iniciadoEn, finalizado_en: finalizadoEn,
      });
    },
    listarEntrenamientos: async (limite) => [...memoria.entrenamientos].reverse().slice(0, limite).map(copiar),
    registrarPreparacion: async (datos) => { memoria.preparaciones.push(copiar(datos)); },
    minimoFilasEntrenamiento: async () => minimoFilas,
    ventas: async (desde, hastaExclusivo) =>
      memoria.ventas.filter((venta) => {
        const fecha = new Date(venta.fecha_venta);
        return fecha >= desde && fecha < hastaExclusivo;
      }),
  };
}

module.exports = { AHORA, HASTA, ventasSimuladas, crearRepositorio };
