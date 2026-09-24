const DIAS_ALERTA_VENCIMIENTO = 30;

function normalizarFecha(dateLike, horaInicio = false) {
  const fecha = new Date(dateLike);
  if (Number.isNaN(fecha.getTime())) return null;
  if (horaInicio) fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function diasHastaVencimiento(fechaVencimiento, hoy = new Date()) {
  const fecha = normalizarFecha(fechaVencimiento, true);
  const fechaHoy = normalizarFecha(hoy, true);
  if (!fecha || !fechaHoy) return null;
  return Math.ceil((fecha - fechaHoy) / 86400000);
}

function generarCodigoLote(numero = 1) {
  const valor = Number.isFinite(Number(numero)) ? Number(numero) : 1;
  return `LT-${String(Math.max(1, valor)).padStart(6, '0')}`;
}

function validarLoteParaCreacion({ cantidad_inicial, fecha_vencimiento } = {}) {
  const cantidad = Number(cantidad_inicial);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad inicial del lote debe ser mayor a 0');
  }

  const fecha = normalizarFecha(fecha_vencimiento, true);
  if (!fecha) {
    throw new Error('La fecha de vencimiento es inválida');
  }

  const hoy = normalizarFecha(new Date(), true);
  if (fecha <= hoy) {
    throw new Error('La fecha de vencimiento debe ser posterior a hoy');
  }

  return {
    cantidad_inicial: cantidad,
    fecha_vencimiento: fecha,
  };
}

function calcularEstadoLote(lote = {}, hoy = new Date()) {
  const cantidadActual = Number(lote.cantidad_actual ?? 0);
  if (cantidadActual === 0) return 'AGOTADO';

  const diasRestantes = diasHastaVencimiento(lote.fecha_vencimiento, hoy);
  if (diasRestantes === null) return 'VIGENTE';
  if (diasRestantes < 0) return 'VENCIDO';

  const diasAlerta = Number(lote.dias_alerta_vencimiento ?? DIAS_ALERTA_VENCIMIENTO);
  if (diasRestantes <= diasAlerta) return 'POR_VENCER';

  return 'VIGENTE';
}

function seleccionarLotesFEFO(lotes = [], hoy = new Date()) {
  return [...lotes]
    .filter((lote) => Number(lote.cantidad_actual || 0) > 0)
    .filter((lote) => {
      const diasRestantes = diasHastaVencimiento(lote.fecha_vencimiento, hoy);
      return diasRestantes === null || diasRestantes >= 0;
    })
    .sort((a, b) => {
      const fechaA = normalizarFecha(a.fecha_vencimiento, true)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const fechaB = normalizarFecha(b.fecha_vencimiento, true)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return fechaA - fechaB || Number(a.id || 0) - Number(b.id || 0);
    });
}

module.exports = {
  DIAS_ALERTA_VENCIMIENTO,
  diasHastaVencimiento,
  generarCodigoLote,
  validarLoteParaCreacion,
  calcularEstadoLote,
  seleccionarLotesFEFO,
};
