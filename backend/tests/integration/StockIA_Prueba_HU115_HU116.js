'use strict';

/**
 * StockIA | HU-115 y HU-116 | Prueba de integración LOCAL.
 * Ubicación prevista: backend/tests/integration/StockIA_Prueba_HU115_HU116.js
 * Ejecutar desde la raíz del proyecto:
 *   node --env-file=backend/.env.test --test backend/tests/integration/StockIA_Prueba_HU115_HU116.js
 *
 * SEGURIDAD: conexión creada exclusivamente mediante TEST_DB_*; verifica
 * servidor/usuario/base reales; jamás ejecuta sync(), force o alter.
 * Los registros se crean dentro de una transacción y se revierten al final.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { buildTestSequelize, assertIsolated } = require('../helpers/testDb');
const { evaluarAnomalias, ORIGEN_INTERNO } = require('../../src/services/anomaliasRegistroService');
const { predecirProductos } = require('../../src/services/prediccionDemandaService');
const modeloDemanda = require('../../src/services/prediccionDemandaModelo');

const BASE = 'stockia_test';
const USUARIO = 'stockia_test';
const HOSTS = new Set(['localhost', '127.0.0.1']);

function comprobarVariables() {
  assertIsolated();
  const p = process.env;
  assert.equal(p.NODE_ENV, 'test', 'NODE_ENV debe ser test');
  assert.ok(HOSTS.has(p.TEST_DB_HOST), 'Solo se permite PostgreSQL local');
  assert.equal(p.TEST_DB_NAME, BASE, 'Base no autorizada');
  assert.equal(p.TEST_DB_USER, USUARIO, 'Usuario no autorizado');
  assert.equal(Number(p.TEST_DB_PORT || 5432), 5432, 'Puerto no autorizado');
  assert.ok(p.TEST_DB_PASSWORD, 'Falta TEST_DB_PASSWORD');
}

async function comprobarServidor(sequelize) {
  const config = sequelize.config;
  assert.ok(HOSTS.has(config.host), 'Host de Sequelize no autorizado');
  assert.equal(config.database, BASE);
  assert.equal(config.username, USUARIO);
  assert.equal(Number(config.port || 5432), 5432);
  assert.equal(sequelize.getDialect(), 'postgres');

  const [filas] = await sequelize.query(`
    SELECT current_database() AS base,
           current_user AS usuario,
           inet_server_addr()::text AS ip,
           inet_server_port() AS puerto
  `);
  const conexion = filas[0];
  const ip = String(conexion.ip || '').split('/')[0];
  assert.equal(conexion.base, BASE);
  assert.equal(conexion.usuario, USUARIO);
  assert.ok(['127.0.0.1', '::1'].includes(ip), 'El servidor real no es local');
  assert.equal(Number(conexion.puerto), 5432);
}

function modelosDePrueba(sequelize) {
  // Modelos originales asociados a la instancia aislada, nunca al singleton de Supabase.
  const Producto = require('../../src/models/Producto')(sequelize);
  const Venta = require('../../src/models/Venta')(sequelize);
  const Alerta = require('../../src/models/Alerta')(sequelize);
  const MovimientoInventario = require('../../src/models/MovimientoInventario')(sequelize);
  const Lote = require('../../src/models/Lote')(sequelize);
  return { Producto, Venta, Alerta, MovimientoInventario, Lote };
}

function repositorioDeteccion(modelos, transaction) {
  const { Venta, Alerta, MovimientoInventario, Lote } = modelos;
  return {
    Op,
    Venta: { findAll: (opciones) => Venta.findAll({ ...opciones, transaction }) },
    MovimientoInventario: {
      findAll: (opciones) => MovimientoInventario.findAll({ ...opciones, transaction }),
    },
    Lote: { findAll: (opciones) => Lote.findAll({ ...opciones, transaction }) },
    Alerta: {
      findOne: (opciones) => Alerta.findOne({ ...opciones, transaction }),
      create: (datos) => Alerta.create(datos, { transaction }),
    },
  };
}

function repositorioPrediccion(modelos, transaction) {
  const { Producto, Venta, Alerta } = modelos;
  return {
    productos: (ids) => Producto.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'codigo', 'nombre', 'activo'], raw: true, transaction,
    }),
    ventas: (ids, desde, hastaExclusivo) => Venta.findAll({
      where: {
        producto_id: { [Op.in]: ids },
        origen: { [Op.in]: ['manual', 'importado'] },
        fecha_venta: { [Op.gte]: desde, [Op.lt]: hastaExclusivo },
      },
      attributes: ['id', 'producto_id', 'cantidad', 'fecha_venta'],
      raw: true, transaction,
    }),
    alertas: (ids) => Alerta.findAll({
      where: {
        tipo: 'anomalia',
        estado: { [Op.in]: ['nueva', 'vista', 'atendida'] },
        producto_id: { [Op.in]: ids },
        datos_origen: {
          [Op.contains]: { origen: ORIGEN_INTERNO, fuente: 'venta' },
        },
      },
      attributes: ['tipo', 'estado', 'producto_id', 'datos_origen'],
      raw: true, transaction,
    }),
  };
}

test('HU-115 y HU-116: integración REAL con PostgreSQL local y rollback', async (t) => {
  comprobarVariables();
  const sequelize = buildTestSequelize();
  let transaction;
  try {
    await sequelize.authenticate();
    await comprobarServidor(sequelize);
    t.diagnostic('Conexión verificada: stockia_test, usuario stockia_test, servidor local');

    // No se requiere modificar datos preexistentes ni ejecutar migraciones.
    const [existentes] = await sequelize.query(`
      SELECT (SELECT COUNT(*)::integer FROM public.productos) AS productos,
             (SELECT COUNT(*)::integer FROM public.ventas) AS ventas,
             (SELECT COUNT(*)::integer FROM public.alertas) AS alertas,
             (SELECT COUNT(*)::integer FROM public.movimientos_inventario) AS movimientos
    `);
    for (const [tabla, cantidad] of Object.entries(existentes[0])) {
      assert.equal(Number(cantidad), 0,
        `Se detuvo la prueba: la tabla ${tabla} ya contiene datos`);
    }

    const modelos = modelosDePrueba(sequelize);
    transaction = await sequelize.transaction();
    const { Producto, Venta, Alerta } = modelos;

    // Ventas de referencia: cantidad 10 durante 55 días; una venta muy alta.
    // IMPORTANTE: HU-72 usa el último día CERRADO en hora de Lima (UTC-5),
    // no el día anterior en UTC. Generar los datos en el día correcto evita
    // falsos errores al ejecutar la prueba por la tarde o por la noche.
    const ahora = new Date();
    const ultimoDiaLima = modeloDemanda.ultimoDiaCompleto(ahora);
    const fechaAncla = new Date(`${ultimoDiaLima}T12:00:00-05:00`);
    const ventana = modeloDemanda.rangoConsultaUtc(ultimoDiaLima);
    assert.ok(fechaAncla >= ventana.desde && fechaAncla < ventana.hasta,
      'La fecha de la venta anómala debe estar en la ventana de predicción');
    t.diagnostic(`Último día completo de Lima: ${ultimoDiaLima}`);
    const producto = await Producto.create({
      codigo: 'TEST-HU115-116', nombre: 'Producto de prueba HU-115/HU-116',
      activo: true,
    }, { transaction });
    for (let diasAtras = 56; diasAtras >= 2; diasAtras -= 1) {
      await Venta.create({
        producto_id: producto.id, cantidad: 10, precio_unitario: 1,
        origen: 'manual', fecha_venta: new Date(fechaAncla.getTime() - diasAtras * 86400000),
      }, { transaction });
    }
    const ventaAtipica = await Venta.create({
      producto_id: producto.id, cantidad: 300, precio_unitario: 1,
      origen: 'manual', fecha_venta: fechaAncla,
    }, { transaction });
    const ventaId = String(ventaAtipica.id);

    const repoPred = repositorioPrediccion(modelos, transaction);
    const ids = [Number(producto.id)];
    const ventasEnVentana = await repoPred.ventas(ids, ventana.desde, ventana.hasta);
    assert.ok(ventasEnVentana.some((venta) => String(venta.id) === ventaId),
      'La venta anómala no aparece en las ventas del período de predicción');
    t.diagnostic(`Venta anómala incluida en la ventana: ${fechaAncla.toISOString()}`);
    const antes = await predecirProductos([Number(producto.id)], {
      horizonte: 7, ahora, repositorio: repoPred,
    });
    assert.equal(antes.calidad_datos.total_ventas_anomalas_excluidas, 0);
    t.diagnostic('Sin alertas: ninguna venta excluida');

    const deps = repositorioDeteccion(modelos, transaction);
    const opciones = { diasHistorial: 180, limiteNuevas: 50, ahora };
    const vista = await evaluarAnomalias({ ...opciones, guardar: false }, deps);
    assert.ok(vista.anomalias_encontradas >= 1, 'Detector no encontró anomalías');
    assert.equal(await Alerta.count({ transaction }), 0, 'La vista previa no debe registrar alertas');
    t.diagnostic(`Vista previa: ${vista.anomalias_encontradas} anomalía(s), sin escrituras de alertas`);

    const registro = await evaluarAnomalias({ ...opciones, guardar: true }, deps);
    assert.ok(registro.alertas_creadas >= 1, 'No se guardaron alertas');
    const alerta = await Alerta.findOne({
      where: {
        tipo: 'anomalia', producto_id: producto.id,
        datos_origen: { [Op.contains]: {
          origen: ORIGEN_INTERNO, fuente: 'venta', registro_id: ventaId,
        } },
      }, transaction,
    });
    assert.ok(alerta, 'No se registró alerta para la venta atípica');
    assert.equal(alerta.estado, 'nueva');
    t.diagnostic('HU-115: alerta de venta atípica guardada en PostgreSQL');

    const cuentaAntes = await Alerta.count({ transaction });
    const segunda = await evaluarAnomalias({ ...opciones, guardar: true }, deps);
    const cuentaDespues = await Alerta.count({ transaction });
    assert.equal(segunda.alertas_creadas, 0, 'La segunda ejecución duplicó alertas');
    assert.equal(cuentaDespues, cuentaAntes);
    t.diagnostic('HU-115: no se duplicaron alertas en ejecución secuencial');

    // Distinguir un fallo de consulta de alertas de un fallo en el filtro.
    const alertasParaPrediccion = await repoPred.alertas(ids);
    assert.ok(alertasParaPrediccion.some((a) =>
      String(a.datos_origen?.registro_id) === ventaId),
      'La alerta registrada no se recuperó en la consulta de predicción');

    const conAlerta = await predecirProductos([Number(producto.id)], {
      horizonte: 7, ahora, repositorio: repoPred,
    });
    const excluidas = conAlerta.calidad_datos.total_ventas_anomalas_excluidas;
    assert.ok(excluidas >= 1, 'HU-116 no excluyó ventas marcadas');
    t.diagnostic(`HU-116: ${excluidas} venta(s) excluida(s) al predecir`);

    await alerta.update({ estado: 'descartada' }, { transaction });
    const descartada = await predecirProductos([Number(producto.id)], {
      horizonte: 7, ahora, repositorio: repoPred,
    });
    assert.equal(descartada.calidad_datos.total_ventas_anomalas_excluidas, excluidas - 1,
      'Al descartar la alerta, la venta debía volver a considerarse');
    assert.ok(await Venta.findByPk(ventaAtipica.id, { transaction }),
      'La venta original no debe eliminarse');
    t.diagnostic('HU-116: al descartar la alerta, la venta vuelve a incluirse');
  } finally {
    // Dejar la base de pruebas tal como estaba, aunque la prueba falle.
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
        t.diagnostic('ROLLBACK realizado: registros de prueba revertidos');
      }
    } finally {
      await sequelize.close();
    }
  }
});
