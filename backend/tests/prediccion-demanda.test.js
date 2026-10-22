// HU-72 · QA-01 — Casos de prueba de "Predecir demanda de productos" (TC-01 a TC-07).
// Usa datos simulados: no necesita base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');

const modelo = require('../src/services/prediccionDemandaModelo');
const { predecirProductos } = require('../src/services/prediccionDemandaService');
const { leerParametros, MAX_PRODUCTOS } = require('../src/controllers/prediccionController');

const AHORA = new Date('2026-10-21T15:00:00-05:00'); // miércoles; el último día completo es el 20/oct
const HASTA = '2026-10-20';

// Ventas diarias simuladas. `patron[d]` = unidades por día de la semana (0 = domingo).
function ventasSimuladas({ dias = 70, patron = [2, 10, 10, 10, 10, 14, 20], multiplicador = 1 } = {}) {
  const ventas = [];
  for (let i = 0; i < dias; i += 1) {
    const fecha = modelo.sumarDias(HASTA, -i);
    const cantidad = patron[modelo.diaSemana(fecha)] * multiplicador;
    if (cantidad > 0) ventas.push({ fecha_venta: `${fecha}T15:00:00-05:00`, cantidad: String(cantidad) });
  }
  return ventas;
}

const total = (resultado) => resultado.demanda_estimada;

test('TC-01: con historial suficiente muestra la demanda estimada del periodo siguiente', () => {
  const r = modelo.predecirDemanda(ventasSimuladas(), { horizonte: 7, hasta: HASTA });
  assert.equal(r.estado, 'ok');
  assert.ok(r.demanda_estimada > 0);
  assert.equal(r.proyeccion.length, 7);
  assert.equal(r.proyeccion[0].fecha, '2026-10-21');
  assert.ok(r.intervalo_inferior <= r.demanda_estimada && r.demanda_estimada <= r.intervalo_superior);
});

test('TC-02 y TC-07: sin historial suficiente informa que no hay datos para predecir', () => {
  const pocos = ventasSimuladas({ dias: 70 }).slice(0, 3); // solo 3 días con ventas
  const r = modelo.predecirDemanda(pocos, { horizonte: 7, hasta: HASTA });
  assert.equal(r.estado, 'datos_insuficientes');
  assert.equal(r.motivo, 'pocos_dias_con_ventas');
  assert.match(r.mensaje, /no hay datos suficientes/i);
  assert.equal(r.historial.dias_con_ventas, 3);
  assert.equal(r.demanda_estimada, undefined);

  const ninguno = modelo.predecirDemanda([], { horizonte: 7, hasta: HASTA });
  assert.equal(ninguno.estado, 'datos_insuficientes');
  assert.equal(ninguno.motivo, 'sin_ventas');
});

test('TC-02: ventas que cubren menos de 14 días tampoco bastan', () => {
  const r = modelo.predecirDemanda(ventasSimuladas({ dias: 10 }), { horizonte: 7, hasta: HASTA });
  assert.equal(r.estado, 'datos_insuficientes');
  assert.equal(r.motivo, 'historial_corto');
});

test('TC-04: la estimación depende del historial de ventas (el doble de ventas, el doble de demanda)', () => {
  const base = modelo.predecirDemanda(ventasSimuladas(), { horizonte: 7, hasta: HASTA });
  const doble = modelo.predecirDemanda(ventasSimuladas({ multiplicador: 2 }), { horizonte: 7, hasta: HASTA });
  const razon = total(doble) / total(base);
  assert.ok(razon > 1.9 && razon < 2.1, `razón ${razon}`);
});

test('TC-04: las ventas del día en curso no se cuentan (el día aún no termina)', () => {
  const conHoy = [...ventasSimuladas(), { fecha_venta: '2026-10-21T10:00:00-05:00', cantidad: '500' }];
  const a = modelo.predecirDemanda(ventasSimuladas(), { horizonte: 7, hasta: HASTA });
  const b = modelo.predecirDemanda(conHoy, { horizonte: 7, hasta: HASTA });
  assert.equal(total(a), total(b));
});

test('TC-04: una venta de noche en Lima cuenta en su día local, no en el día UTC siguiente', () => {
  const noche = [{ fecha_venta: '2026-10-20T22:30:00-05:00', cantidad: '9' }]; // 03:30 UTC del 21/oct
  const { serie } = modelo.construirSerie(noche, HASTA);
  assert.equal(serie.at(-1).fecha, '2026-10-20');
  assert.equal(serie.at(-1).cantidad, 9);
});

test('TC-05: el modelo aprende el patrón semanal (sábado alto, domingo bajo)', () => {
  const r = modelo.predecirDemanda(ventasSimuladas(), { horizonte: 7, hasta: HASTA });
  const porFecha = Object.fromEntries(r.proyeccion.map((p) => [p.fecha, p.cantidad]));
  const sabado = porFecha['2026-10-24'];
  const domingo = porFecha['2026-10-25'];
  const lunes = porFecha['2026-10-26'];
  assert.ok(sabado > lunes && lunes > domingo, `sáb ${sabado}, lun ${lunes}, dom ${domingo}`);
});

test('TC-05: detecta tendencia al alza cuando las ventas recientes crecen', () => {
  const creciente = [];
  for (let i = 0; i < 56; i += 1) {
    const fecha = modelo.sumarDias(HASTA, -i);
    creciente.push({ fecha_venta: `${fecha}T12:00:00-05:00`, cantidad: String(5 + (56 - i) * 0.5) });
  }
  const r = modelo.predecirDemanda(creciente, { horizonte: 7, hasta: HASTA });
  assert.equal(r.tendencia, 'sube');
});

test('TC-06: el resultado trae todo lo necesario para mostrarlo de forma comprensible', () => {
  const r = modelo.predecirDemanda(ventasSimuladas(), { horizonte: 14, hasta: HASTA });
  assert.match(r.mensaje, /Se estima una demanda de .* unidades para los próximos 14 días/);
  assert.ok(['sube', 'baja', 'estable'].includes(r.tendencia));
  assert.ok(['alta', 'media', 'baja'].includes(r.confianza));
  assert.equal(r.nivel_intervalo, 80);
  assert.ok(r.serie_historica.length > 0 && r.proyeccion.length === 14);
  assert.ok(r.modelo.nombre && r.modelo.version);
  assert.ok(r.promedio_diario > 0);
});

test('TC-03: se pueden analizar varios productos a la vez, en el orden pedido', async () => {
  const ventas = [
    ...ventasSimuladas().map((v) => ({ ...v, producto_id: 2 })),
    ...ventasSimuladas({ multiplicador: 3 }).map((v) => ({ ...v, producto_id: 3 })),
    ...ventasSimuladas().slice(0, 2).map((v) => ({ ...v, producto_id: 4 })),
  ];
  let consultas = 0;
  let argumentos;
  const repositorio = {
    productos: async () => [
      { id: 2, codigo: 'P-002', nombre: 'Producto A', activo: true },
      { id: 3, codigo: 'P-003', nombre: 'Producto B', activo: true },
      { id: 4, codigo: 'P-004', nombre: 'Producto C', activo: true },
    ],
    ventas: async (...args) => {
      consultas += 1;
      argumentos = args;
      return ventas;
    },
  };

  const r = await predecirProductos([3, 2, 4, 99], { horizonte: 7, ahora: AHORA, repositorio });

  assert.deepEqual(r.resultados.map((x) => x.producto_id), [3, 2, 4, 99]);
  assert.deepEqual(r.resultados.map((x) => x.estado), ['ok', 'ok', 'datos_insuficientes', 'no_encontrado']);
  assert.ok(total(r.resultados[0]) > total(r.resultados[1])); // el producto 3 vende el triple
  assert.equal(r.resultados[0].producto.codigo, 'P-003');
  assert.equal(r.ultimo_dia_analizado, HASTA);
  assert.equal(consultas, 1); // una sola consulta de ventas para todos los productos
  assert.deepEqual(argumentos[0], [3, 2, 4, 99]);
});

test('TC-03: valida la selección de productos y el horizonte', () => {
  assert.deepEqual(leerParametros({ producto_ids: '2,3,3', horizonte_dias: '14' }), { ids: [2, 3], horizonte: 14 });
  assert.equal(leerParametros({ producto_ids: '5' }).horizonte, 7); // horizonte por defecto
  assert.throws(() => leerParametros({}), /al menos un producto/);
  assert.throws(() => leerParametros({ producto_ids: 'abc' }), /no son válidos/);
  assert.throws(() => leerParametros({ producto_ids: '-1' }), /no son válidos/);
  assert.throws(() => leerParametros({ producto_ids: '1', horizonte_dias: '0' }), /entre 1 y 30/);
  assert.throws(() => leerParametros({ producto_ids: '1', horizonte_dias: '31' }), /entre 1 y 30/);
  const demasiados = Array.from({ length: MAX_PRODUCTOS + 1 }, (_, i) => i + 1).join(',');
  assert.throws(() => leerParametros({ producto_ids: demasiados }), /hasta 10 productos/);
});
