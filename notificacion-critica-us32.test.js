'use strict';

/**
 * HU-167 · QA-01 — Casos de prueba de la US-32 (TC-01 a TC-07):
 * notificar alertas críticas por correo electrónico.
 * Sin base de datos ni SMTP: repositorio en memoria + envío simulado.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const servicio = require('../src/services/notificacionCriticaService');
const reglas = require('../src/services/reglasNotificacionCritica');
const umbralVencimiento = require('../src/services/umbralVencimientoService');
const { sincronizarAlertasRiesgo } = require('../src/services/notificacionAlertaService');
const { ejecutarReintentos } = require('../src/services/notificacionReintentosCron');
const { escenarioBase } = require('./helpers/notificacionRepoMemoria');

const silencio = { info() {}, warn() {}, error() {} };
const T0 = new Date('2026-11-26T12:00:00Z');
const minutos = (n) => n * 60_000;

/** Config inicial que deja el SQL: almacén e inventario reciben ambos tipos. */
const CONFIG_INICIAL = [
  { rol_id: 2, tipo_alerta: 'riesgo_vencimiento', activo: true },
  { rol_id: 2, tipo_alerta: 'bajo_stock', activo: true },
  { rol_id: 3, tipo_alerta: 'riesgo_vencimiento', activo: true },
  { rol_id: 3, tipo_alerta: 'bajo_stock', activo: true },
];

function alertaStock(extra = {}) {
  return {
    id: 100,
    tipo: 'bajo_stock',
    producto_id: 4,
    lote_id: null,
    severidad: 'alta',
    estado: 'nueva',
    mensaje: 'Stock bajo de Leche Entera 1L: quedan 0 unidades; minimo 10.',
    fecha_creacion: T0,
    datos_origen: { origen: 'stock_minimo', codigo: 'P-004', nombre: 'Leche Entera 1L', stock_disponible: 0, stock_minimo: 10, faltante: 10 },
    ...extra,
  };
}

function alertaVencimiento(extra = {}) {
  return {
    id: 200,
    tipo: 'riesgo_vencimiento',
    producto_id: 4,
    lote_id: 12,
    severidad: 'critica',
    estado: 'nueva',
    mensaje: 'El lote L-12 de Leche Entera 1L venció hace 2 día(s) y aún tiene 20 unidades.',
    fecha_creacion: T0,
    datos_origen: { origen: 'umbral_vencimiento', dias_restantes: -2, fecha_vencimiento: '2026-11-24' },
    ...extra,
  };
}

/** Dependencias de prueba: reloj controlable y SMTP simulado (cada llamada se guarda en `envios`). */
function crearDeps(repo, { falla = false, maxIntentos = 5, ahora = () => T0 } = {}) {
  const ctx = { envios: [], falla };
  ctx.deps = {
    repo,
    logger: silencio,
    maxIntentos,
    minutosBase: 5,
    timeoutEnvioMs: 200,
    ahora: () => ahora(),
    enviarCorreo: async (destinatario, asunto, html) => {
      if (ctx.falla) throw new Error(typeof ctx.falla === 'string' ? ctx.falla : 'SMTP no disponible');
      ctx.envios.push({ destinatario, asunto, html });
      return true;
    },
  };
  return ctx;
}

// ===================================================================== TC-01 / TC-03

test('TC-01 y TC-03: una alerta crítica envía un correo a cada encargado configurado', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo);

  const resultado = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  assert.deepEqual(resultado, { destinatarios: 3, enviados: 3, fallidos: 0, omitidos: 0, motivo: null });
  assert.deepEqual(
    ctx.envios.map((e) => e.destinatario).sort(),
    ['almacen2@empresa.com', 'almacen@empresa.com', 'inventario@empresa.com'],
  );
  assert.ok(repo.estado.registros.every((r) => r.estado === 'enviado'));
});

test('TC-03: aplica a vencimiento (crítica y alta) y a quiebre de stock (alta)', async () => {
  for (const alerta of [
    alertaVencimiento({ severidad: 'critica' }),
    alertaVencimiento({ id: 201, severidad: 'alta' }),
    alertaStock(),
  ]) {
    const ctx = crearDeps(escenarioBase({ configuracion: CONFIG_INICIAL }));
    const r = await servicio.notificarAlertaCritica(alerta, ctx.deps);
    assert.equal(r.enviados, 3, `${alerta.tipo}/${alerta.severidad}`);
  }
});

test('TC-03: las alertas no críticas, de otro tipo o ya atendidas NO envían correo', async () => {
  const casos = [
    [alertaStock({ severidad: 'media' }), 'no_critica'],
    [alertaVencimiento({ severidad: 'baja' }), 'no_critica'],
    [alertaStock({ tipo: 'anomalia' }), 'no_critica'],
    [alertaStock({ estado: 'atendida' }), 'no_abierta'],
    [alertaStock({ estado: 'descartada' }), 'no_abierta'],
    [alertaStock({ id: undefined }), 'alerta_sin_id'],
  ];
  for (const [alerta, motivo] of casos) {
    const ctx = crearDeps(escenarioBase({ configuracion: CONFIG_INICIAL }));
    const r = await servicio.notificarAlertaCritica(alerta, ctx.deps);
    assert.equal(r.motivo, motivo);
    assert.equal(ctx.envios.length, 0);
  }
});

test('TC-01: es idempotente — la misma alerta no se notifica dos veces al mismo destinatario', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  const segunda = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  assert.equal(segunda.motivo, 'ya_notificada');
  assert.equal(segunda.omitidos, 3);
  assert.equal(ctx.envios.length, 3);
  assert.equal(repo.estado.registros.length, 3);
});

test('TC-01: no envía a usuarios inactivos ni a correos inválidos, y no duplica correos repetidos', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  repo.estado.usuarios.push({ id: 99, email: 'ALMACEN@empresa.com', rol_id: 3 }); // mismo correo en otra mayúscula
  const ctx = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  const destinos = ctx.envios.map((e) => e.destinatario);

  assert.ok(!destinos.includes('baja@empresa.com'));
  assert.ok(!destinos.includes('sin-correo-valido'));
  assert.equal(destinos.filter((d) => d === 'almacen@empresa.com').length, 1);
});

test('TC-01: sin destinatarios configurados no envía nada ni falla', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL.map((f) => ({ ...f, activo: false })) });
  const ctx = crearDeps(repo);
  const r = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  assert.equal(r.motivo, 'sin_destinatarios');
  assert.equal(ctx.envios.length, 0);
});

// ===================================================================== TC-04

test('TC-04: el correo incluye producto, motivo y nivel de riesgo (quiebre de stock)', async () => {
  const ctx = crearDeps(escenarioBase({ configuracion: CONFIG_INICIAL }));
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  const { asunto, html } = ctx.envios[0];

  assert.match(asunto, /ALTO/);
  assert.match(asunto, /P-004 · Leche Entera 1L/);
  assert.match(html, /P-004 · Leche Entera 1L/); // producto
  assert.match(html, /Quiebre de stock: no quedan unidades disponibles/); // motivo
  assert.match(html, /Nivel de riesgo/);
  assert.match(html, /ALTO/); // nivel
});

test('TC-04: el correo de vencimiento incluye lote, fecha, motivo y nivel CRÍTICO', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaVencimiento(), ctx.deps);
  const { asunto, html } = ctx.envios[0];

  assert.match(asunto, /CRÍTICO/);
  assert.match(asunto, /lote L-12/);
  assert.match(html, /Leche Entera 1L/);
  assert.match(html, /venció hace 2 día/);
  assert.match(html, /CRÍTICO/);
  assert.match(html, /L-12/);
});

test('TC-04: el contenido dinámico se escapa (no se inyecta HTML en el correo)', () => {
  const correo = reglas.construirCorreoCritico(
    alertaStock({ mensaje: '<script>x</script>', datos_origen: { nombre: '<b>Malo</b>', codigo: 'X', stock_disponible: 3, stock_minimo: 9 } }),
  );
  assert.doesNotMatch(correo.html, /<script>|<b>Malo/);
  assert.match(correo.html, /&lt;b&gt;Malo&lt;\/b&gt;/);
});

// ===================================================================== TC-05

test('TC-05: sin configuración guardada, solo el rol por defecto (Encargado de Almacén) recibe', async () => {
  const ctx = crearDeps(escenarioBase());
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  assert.deepEqual(ctx.envios.map((e) => e.destinatario).sort(), ['almacen2@empresa.com', 'almacen@empresa.com']);
});

test('TC-05: el administrador puede elegir qué roles reciben cada tipo y el cambio se aplica', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });

  // Jefe de Ventas recibe solo bajo_stock; Inventario deja de recibir vencimiento.
  const guardada = await servicio.guardarConfiguracion([
    { rol_id: 4, bajo_stock: true },
    { rol_id: 2, riesgo_vencimiento: false },
  ], { repo });
  const fila = (id) => guardada.data.find((r) => r.rol_id === id);
  assert.equal(fila(4).bajo_stock, true);
  assert.equal(fila(4).riesgo_vencimiento, false);
  assert.equal(fila(2).riesgo_vencimiento, false);
  assert.equal(fila(2).bajo_stock, true);

  const stock = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaStock({ id: 1 }), stock.deps);
  assert.ok(stock.envios.some((e) => e.destinatario === 'ventas@empresa.com'));

  const venc = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaVencimiento({ id: 2 }), venc.deps);
  const destinos = venc.envios.map((e) => e.destinatario);
  assert.ok(!destinos.includes('inventario@empresa.com'));
  assert.ok(!destinos.includes('ventas@empresa.com'));
  assert.ok(destinos.includes('almacen@empresa.com'));
});

test('TC-05: desactivar todos los roles de un tipo deja de enviar (no vuelve al valor por defecto)', async () => {
  const repo = escenarioBase();
  await servicio.guardarConfiguracion([{ rol_id: 3, bajo_stock: false }], { repo });
  const ctx = crearDeps(repo);
  const r = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  assert.equal(r.motivo, 'sin_destinatarios');
  // El otro tipo conserva su valor por defecto.
  const venc = crearDeps(repo);
  assert.equal((await servicio.notificarAlertaCritica(alertaVencimiento(), venc.deps)).enviados, 2);
});

test('TC-05: la consulta de configuración lista todos los roles con su estado por tipo', async () => {
  const conf = await servicio.obtenerConfiguracion({ repo: escenarioBase() });
  assert.deepEqual(conf.tipos, ['riesgo_vencimiento', 'bajo_stock']);
  assert.equal(conf.data.length, 4);
  const almacen = conf.data.find((r) => r.rol === 'Encargado de Almacén');
  assert.deepEqual([almacen.riesgo_vencimiento, almacen.bajo_stock], [true, true]);
  const ventas = conf.data.find((r) => r.rol === 'Jefe de Ventas');
  assert.deepEqual([ventas.riesgo_vencimiento, ventas.bajo_stock], [false, false]);
});

test('TC-05: rechaza configuraciones inválidas y no cambia nada', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const antes = JSON.stringify(repo.estado.configuracion);
  const invalidos = [
    [undefined, 400], [null, 400], [[], 400], ['texto', 400],
    [[{ rol_id: 999, bajo_stock: true }], 404],
    [[{ rol_id: 'x', bajo_stock: true }], 404],
    [[{ rol_id: 3, bajo_stock: 'si' }], 400],
    [[{ rol_id: 3, riesgo_vencimiento: 1 }], 400],
  ];
  for (const [entrada, status] of invalidos) {
    await assert.rejects(
      () => servicio.guardarConfiguracion(entrada, { repo }),
      (error) => error instanceof servicio.ErrorNotificacion && error.status === status,
    );
  }
  assert.equal(JSON.stringify(repo.estado.configuracion), antes);
});

// ===================================================================== TC-06

test('TC-06: cada envío queda en el historial con destinatario, rol, asunto, estado e intentos', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  const { data, total } = await servicio.obtenerHistorial({}, { repo });
  assert.equal(total, 3);
  for (const registro of data) {
    assert.equal(registro.alerta_id, 100);
    assert.equal(registro.estado, 'enviado');
    assert.equal(registro.intentos, 1);
    assert.equal(registro.proximo_reintento, null);
    assert.ok(registro.rol);
    assert.match(registro.asunto, /P-004/);
    assert.ok(registro.fecha_envio instanceof Date);
  }
  assert.deepEqual(new Set(data.map((r) => r.rol)), new Set(['Encargado de Inventario', 'Encargado de Almacén']));
});

test('TC-06: el historial se filtra por estado, alerta y destinatario, y se pagina', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ok = crearDeps(repo);
  await servicio.notificarAlertaCritica(alertaStock({ id: 1 }), ok.deps);
  const mal = crearDeps(repo, { falla: true });
  await servicio.notificarAlertaCritica(alertaVencimiento({ id: 2 }), mal.deps);

  assert.equal((await servicio.obtenerHistorial({ estado: 'fallido' }, { repo })).total, 3);
  assert.equal((await servicio.obtenerHistorial({ estado: 'enviado' }, { repo })).total, 3);
  assert.equal((await servicio.obtenerHistorial({ alerta_id: '2' }, { repo })).total, 3);
  assert.equal((await servicio.obtenerHistorial({ destinatario: ' ALMACEN@empresa.com ' }, { repo })).total, 2);

  const pagina = await servicio.obtenerHistorial({ pagina: 2, limite: 4 }, { repo });
  assert.equal(pagina.total, 6);
  assert.equal(pagina.data.length, 2);
  assert.equal(pagina.pagina, 2);
  // Más recientes primero.
  const todos = await servicio.obtenerHistorial({ limite: 100 }, { repo });
  assert.deepEqual(todos.data.map((r) => r.id), [...todos.data.map((r) => r.id)].sort((a, b) => b - a));
});

test('TC-06: filtros inválidos se rechazan con 400', async () => {
  const repo = escenarioBase();
  for (const filtros of [{ estado: 'raro' }, { alerta_id: 'abc' }, { desde: 'no-es-fecha' }, { hasta: '32/13/2026' }]) {
    await assert.rejects(
      () => servicio.obtenerHistorial(filtros, { repo }),
      (error) => error instanceof servicio.ErrorNotificacion && error.status === 400,
    );
  }
});

// ===================================================================== TC-02

test('TC-02: si el correo falla, registra el error, programa el reintento y NO lanza ni bloquea', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo, { falla: 'connect ECONNREFUSED smtp.gmail.com:465' });

  const resultado = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  assert.deepEqual(resultado, { destinatarios: 3, enviados: 0, fallidos: 3, omitidos: 0, motivo: null });
  for (const registro of repo.estado.registros) {
    assert.equal(registro.estado, 'fallido');
    assert.equal(registro.intentos, 1);
    assert.match(registro.ultimo_error, /ECONNREFUSED/);
    assert.equal(registro.fecha_envio, null);
    assert.equal(registro.proximo_reintento.getTime(), T0.getTime() + minutos(5)); // reintento "más tarde"
  }
});

test('TC-02: un SMTP colgado se corta por tiempo de espera y se trata como fallo', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  const ctx = crearDeps(repo);
  ctx.deps.timeoutEnvioMs = 30;
  ctx.deps.enviarCorreo = () => new Promise(() => {}); // nunca responde
  const r = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  assert.equal(r.fallidos, 3);
  assert.match(repo.estado.registros[0].ultimo_error, /no respondió/);
});

test('TC-02: si el repositorio falla, notificarAlertaCritica devuelve error_interno sin lanzar', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  repo.rolesConfigurados = async () => { throw new Error('BD caída'); };
  const ctx = crearDeps(repo);
  const r = await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  assert.equal(r.motivo, 'error_interno');
});

test('TC-02: el mensaje de error guardado no excede el límite ni contiene saltos de línea', () => {
  const texto = reglas.resumirError(new Error(`línea1\nlínea2 ${'x'.repeat(2000)}`));
  assert.ok(texto.length <= 500);
  assert.doesNotMatch(texto, /\n/);
  assert.equal(reglas.resumirError(undefined), 'Error desconocido');
});

// ===================================================================== TC-07

test('TC-07: la espera entre reintentos crece (5, 10, 20, 40, 60 min) y tiene tope', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => reglas.calcularMinutosReintento(n, 5)), [5, 10, 20, 40, 60, 60]);
});

test('TC-07: el reintento no se hace antes de tiempo y, al vencer, reenvía y marca como enviado', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  let reloj = T0;
  const ctx = crearDeps(repo, { falla: true, ahora: () => reloj });
  repo.estado.alertas.push(alertaStock());
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  // 1 minuto después: todavía no toca.
  reloj = new Date(T0.getTime() + minutos(1));
  let resumen = await servicio.procesarReintentos(ctx.deps);
  assert.equal(resumen.revisados, 0);

  // El servicio de correo vuelve; pasan 6 minutos.
  ctx.falla = false;
  reloj = new Date(T0.getTime() + minutos(6));
  resumen = await servicio.procesarReintentos(ctx.deps);
  assert.deepEqual(resumen, { revisados: 3, enviados: 3, fallidos: 0, cancelados: 0, omitidos: 0 });
  assert.equal(ctx.envios.length, 3);
  for (const registro of repo.estado.registros) {
    assert.equal(registro.estado, 'enviado');
    assert.equal(registro.intentos, 2);
    assert.equal(registro.ultimo_error, null);
    assert.equal(registro.proximo_reintento, null);
  }

  // Nada más que reintentar.
  assert.equal((await servicio.procesarReintentos(ctx.deps)).revisados, 0);
});

test('TC-07: si sigue fallando, el reintento espera más cada vez y se detiene al agotar los intentos', async () => {
  const repo = escenarioBase({ configuracion: [{ rol_id: 3, tipo_alerta: 'bajo_stock', activo: true }] });
  repo.estado.usuarios = repo.estado.usuarios.filter((u) => u.id === 12); // un solo destinatario
  let reloj = T0;
  const ctx = crearDeps(repo, { falla: true, maxIntentos: 3, ahora: () => reloj });
  repo.estado.alertas.push(alertaStock());
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);
  const registro = repo.estado.registros[0];
  assert.equal(registro.intentos, 1);
  assert.equal(registro.proximo_reintento.getTime(), T0.getTime() + minutos(5));

  reloj = new Date(registro.proximo_reintento.getTime());
  await servicio.procesarReintentos(ctx.deps);
  assert.equal(registro.intentos, 2);
  assert.equal(registro.proximo_reintento.getTime(), reloj.getTime() + minutos(10)); // espera creciente

  reloj = new Date(registro.proximo_reintento.getTime());
  await servicio.procesarReintentos(ctx.deps);
  assert.equal(registro.intentos, 3);
  assert.equal(registro.estado, 'fallido');
  assert.equal(registro.proximo_reintento, null); // agotado: no se vuelve a intentar

  reloj = new Date(reloj.getTime() + minutos(500));
  assert.equal((await servicio.procesarReintentos(ctx.deps)).revisados, 0);
  assert.equal(registro.intentos, 3);
});

test('TC-07: se cancela el reintento si la alerta ya fue atendida o dejó de ser crítica', async () => {
  const repo = escenarioBase({ configuracion: [{ rol_id: 3, tipo_alerta: 'bajo_stock', activo: true }] });
  repo.estado.usuarios = repo.estado.usuarios.filter((u) => u.id === 12);
  let reloj = T0;
  const ctx = crearDeps(repo, { falla: true, ahora: () => reloj });
  repo.estado.alertas.push(alertaStock());
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  repo.estado.alertas[0].estado = 'atendida';
  ctx.falla = false;
  reloj = new Date(T0.getTime() + minutos(6));
  const resumen = await servicio.procesarReintentos(ctx.deps);
  assert.equal(resumen.cancelados, 1);
  assert.equal(ctx.envios.length, 0);
  assert.equal(repo.estado.registros[0].proximo_reintento, null);
  assert.match(repo.estado.registros[0].ultimo_error, /Reintento cancelado/);
});

test('TC-07: dos ejecuciones simultáneas (cron + botón) no envían el mismo correo dos veces', async () => {
  const repo = escenarioBase({ configuracion: CONFIG_INICIAL });
  let reloj = T0;
  const ctx = crearDeps(repo, { falla: true, ahora: () => reloj });
  repo.estado.alertas.push(alertaStock());
  await servicio.notificarAlertaCritica(alertaStock(), ctx.deps);

  ctx.falla = false;
  reloj = new Date(T0.getTime() + minutos(6));
  const [a, b] = await Promise.all([servicio.procesarReintentos(ctx.deps), servicio.procesarReintentos(ctx.deps)]);
  assert.equal(a.enviados + b.enviados, 3);
  assert.equal(ctx.envios.length, 3);
});

test('TC-07: un envío "en curso" que quedó colgado (proceso caído) lo retoma el worker pasada la reserva', async () => {
  const repo = escenarioBase({ configuracion: [{ rol_id: 3, tipo_alerta: 'bajo_stock', activo: true }] });
  repo.estado.usuarios = repo.estado.usuarios.filter((u) => u.id === 12);
  repo.estado.alertas.push(alertaStock());
  // Registro "pendiente" creado justo antes de caerse el proceso (sin llegar a enviar).
  await repo.crearRegistro({
    alerta_id: 100, destinatario: 'almacen@empresa.com', rol: 'Encargado de Almacén', estado: 'pendiente',
    intentos: 0, proximo_reintento: new Date(T0.getTime() + servicio.MINUTOS_RESERVA * 60_000),
  });
  const ctx = crearDeps(repo, { ahora: () => new Date(T0.getTime() + minutos(servicio.MINUTOS_RESERVA + 1)) });
  const resumen = await servicio.procesarReintentos(ctx.deps);
  assert.equal(resumen.enviados, 1);
  assert.equal(repo.estado.registros[0].estado, 'enviado');
});

test('TC-07: el worker programado no lanza aunque falle el reintento', async () => {
  let llamado = false;
  const r = await ejecutarReintentos({
    procesar: async () => { llamado = true; throw new Error('BD caída'); },
    log: silencio,
  });
  assert.equal(llamado, true);
  assert.equal(r, null);
});

// ===================================================================== Integración con los generadores de alertas

test('TC-01: el generador de vencimiento notifica al crear una alerta crítica y cuando una existente pasa a crítica', async () => {
  const lote = (id, fecha) => ({
    id, numero_lote: `L-${id}`, producto_id: 4, producto_codigo: 'P-004', producto_nombre: 'Leche',
    producto_activo: true, categoria_id: 1, cantidad_actual: 10, fecha_vencimiento: fecha,
  });
  const alertasBD = [];
  let seq = 0;
  const repo = {
    configuraciones: async () => [],
    categorias: async () => [{ id: 1, nombre: 'Lácteos' }],
    categoriaPorId: async () => ({ id: 1, nombre: 'Lácteos' }),
    lotesConStock: async () => [lote(1, '2026-11-20'), lote(2, '2026-12-04')], // 1 vencido; 2 vence en 8 días (severidad media)
    // Copias, como el repositorio real (toJSON): la alerta leída conserva su severidad anterior.
    alertasAbiertas: async () => alertasBD.filter((a) => ['nueva', 'vista'].includes(a.estado)).map((a) => ({ ...a })),
    crearAlerta: async (datos) => { const a = { id: ++seq, ...datos }; alertasBD.push(a); return a; },
    actualizarAlerta: async (id, datos) => Object.assign(alertasBD.find((a) => a.id === id), datos),
  };
  const notificadas = [];
  const notificar = async (alerta) => { notificadas.push({ id: alerta.id, lote: alerta.lote_id, sev: alerta.severidad }); };

  await umbralVencimiento.generarAlertasVencimiento({ repo, hoy: new Date('2026-11-26T15:00:00Z'), notificar });
  // El generador la entrega al notificador, que decide por severidad (aquí se ven todas las nuevas).
  assert.equal(notificadas.length, 2);
  assert.equal(notificadas.find((n) => n.lote === 1).sev, 'critica');

  // Segunda pasada el mismo día: nada cambia de severidad → no se vuelve a notificar.
  notificadas.length = 0;
  await umbralVencimiento.generarAlertasVencimiento({ repo, hoy: new Date('2026-11-26T15:00:00Z'), notificar });
  assert.equal(notificadas.length, 0);

  // Cuatro días después al lote 2 le quedan 3 días: su alerta existente sube de 'media' a 'alta'
  // (crítica) → se notifica. El lote 1 ya era crítico y ya se notificó → no se repite.
  await umbralVencimiento.generarAlertasVencimiento({ repo, hoy: new Date('2026-12-01T15:00:00Z'), notificar });
  assert.deepEqual(notificadas.map((n) => [n.lote, n.sev]), [[2, 'alta']]);
});

test('TC-01: sin notificador inyectado y con repositorio de prueba, el generador de vencimiento no envía correos', async () => {
  const repo = {
    configuraciones: async () => [],
    categorias: async () => [],
    categoriaPorId: async () => null,
    lotesConStock: async () => [],
    alertasAbiertas: async () => [],
    crearAlerta: async () => { throw new Error('no debería crear'); },
    actualizarAlerta: async () => {},
  };
  const r = await umbralVencimiento.generarAlertasVencimiento({ repo, hoy: T0 });
  assert.equal(r.creadas, 0);
});

test('TC-01: el sincronizador de riesgo de vencimiento notifica cada alerta nueva una sola vez', async () => {
  const alertas = [];
  const Alerta = {
    findAll: async () => alertas.filter((a) => ['nueva', 'vista'].includes(a.estado)),
    create: async (datos) => {
      const a = { id: alertas.length + 1, ...datos, update: async function update(c) { Object.assign(this, c); } };
      alertas.push(a);
      return a;
    },
  };
  const productos = [{
    producto_id: 4,
    producto: { codigo: 'P-004', nombre: 'Leche' },
    lotes: [{
      lote_id: 12, numero_lote: 'L-12', fecha_vencimiento: '2026-12-01', dias_para_vencer: 5, stock: 20,
      estado: 'ok', nivel: 'alto', mensaje: 'Riesgo alto', unidades_en_riesgo: 15, porcentaje_en_riesgo: 75,
      demanda_hasta_vencimiento: 5, factores: [],
    }],
  }];
  const criticas = [];
  const opciones = {
    Alerta, usuarioId: 7, logger: silencio,
    notificarAlerta: async () => {},
    notificarCritica: async (alerta) => { criticas.push(alerta.id); },
  };
  await sincronizarAlertasRiesgo(productos, opciones);
  await sincronizarAlertasRiesgo(productos, opciones);
  assert.deepEqual(criticas, [1]);
});

// ===================================================================== Reglas de criticidad

test('TC-03: reglas de criticidad — qué alertas se consideran críticas', () => {
  assert.equal(reglas.esAlertaCritica({ tipo: 'bajo_stock', severidad: 'alta' }), true);
  assert.equal(reglas.esAlertaCritica({ tipo: 'riesgo_vencimiento', severidad: 'critica' }), true);
  assert.equal(reglas.esAlertaCritica({ tipo: 'riesgo_vencimiento', severidad: 'media' }), false);
  assert.equal(reglas.esAlertaCritica({ tipo: 'anomalia', severidad: 'alta' }), false);
  assert.equal(reglas.esAlertaCritica(null), false);
  assert.equal(reglas.normalizarEmail('  Ana@Correo.COM '), 'ana@correo.com');
  assert.equal(reglas.normalizarEmail('no-es-correo'), null);
});
