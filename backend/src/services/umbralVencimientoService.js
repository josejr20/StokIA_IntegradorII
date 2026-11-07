'use strict';

/**
 * HU-118 (US-23) · BE-01 y BE-02 — Servicio del umbral de días para la alerta de vencimiento.
 *
 * Guarda el umbral en la tabla `configuraciones` (clave/valor) que ya existe en la base,
 * por lo que NO requiere migraciones:
 *   - `umbral_vencimiento_dias`                  → umbral general
 *   - `umbral_vencimiento_dias:categoria:<id>`   → umbral de una categoría (TC-06)
 *
 * Cada cálculo de riesgo lee la configuración al momento de ejecutarse, así que un cambio
 * guardado se aplica de inmediato en los siguientes cálculos (TC-01 / TC-04).
 *
 * El acceso a datos está separado (`repositorio`) para poder probar sin base de datos.
 */

const { diasHastaVencimiento, fechaEnLima } = require('./loteService');
const {
  DIAS_PREDETERMINADO,
  ErrorUmbralVencimiento,
  validarDiasVencimiento,
  diasValidosONull,
  resolverUmbral,
  evaluarLote,
} = require('./reglasUmbralVencimiento');

const CLAVE_GLOBAL = 'umbral_vencimiento_dias';
const PREFIJO_CATEGORIA = `${CLAVE_GLOBAL}:categoria:`;

const claveCategoria = (categoriaId) => `${PREFIJO_CATEGORIA}${categoriaId}`;

/** Lee un id positivo de la URL/cuerpo. */
function leerIdCategoria(valor) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new ErrorUmbralVencimiento('Seleccione una categoría válida.');
  }
  return numero;
}

// ---------------------------------------------------------------- acceso a datos

// Los modelos se cargan solo al usarse para que este archivo no abra la base al importarlo.
function repositorioPorDefecto() {
  const { Configuracion, Categoria, Lote, Producto, Alerta } = require('../models');
  const { Op } = require('sequelize');
  return {
    configuraciones: () => Configuracion.findAll({
      where: { [Op.or]: [{ clave: CLAVE_GLOBAL }, { clave: { [Op.like]: `${PREFIJO_CATEGORIA}%` } }] },
      raw: true,
    }),
    categorias: () => Categoria.findAll({ attributes: ['id', 'nombre'], order: [['nombre', 'ASC']], raw: true }),
    categoriaPorId: (id) => Categoria.findByPk(id, { attributes: ['id', 'nombre'], raw: true }),
    guardarClave: async (clave, valor) => {
      const ahora = new Date();
      const existente = await Configuracion.findOne({ where: { clave } });
      if (existente) {
        await existente.update({ valor: String(valor), fecha_actualizacion: ahora });
        return;
      }
      try {
        await Configuracion.create({ clave, valor: String(valor), fecha_actualizacion: ahora });
      } catch (error) {
        // Otro usuario pudo crear la misma clave unos milisegundos antes.
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        await Configuracion.update({ valor: String(valor), fecha_actualizacion: ahora }, { where: { clave } });
      }
    },
    borrarClave: (clave) => Configuracion.destroy({ where: { clave } }),
    lotesConStock: () => Lote.findAll({
      where: { cantidad_actual: { [Op.gt]: 0 }, fecha_vencimiento: { [Op.ne]: null } },
      include: [{ model: Producto, as: 'producto', attributes: ['id', 'codigo', 'nombre', 'categoria_id', 'activo'] }],
      order: [['fecha_vencimiento', 'ASC'], ['id', 'ASC']],
    }).then((filas) => filas.map((fila) => {
      const lote = fila.toJSON();
      return {
        id: lote.id,
        numero_lote: lote.numero_lote,
        producto_id: lote.producto_id,
        producto_codigo: lote.producto?.codigo ?? null,
        producto_nombre: lote.producto?.nombre ?? null,
        producto_activo: lote.producto?.activo !== false,
        categoria_id: lote.producto?.categoria_id ?? null,
        cantidad_actual: Number(lote.cantidad_actual),
        fecha_vencimiento: lote.fecha_vencimiento,
      };
    })),
    alertasAbiertas: async () => {
      const alertas = await Alerta.findAll({
        where: { tipo: 'riesgo_vencimiento', estado: { [Op.in]: ['nueva', 'vista'] } },
      });
      return alertas.filter((a) => a.datos_origen?.origen === 'umbral_vencimiento').map((a) => a.toJSON());
    },
    crearAlerta: (datos) => Alerta.create(datos),
    actualizarAlerta: (id, datos) => Alerta.update(datos, { where: { id } }),
  };
}

// ---------------------------------------------------------------- configuración

/** Lee la configuración guardada y la deja lista para resolver umbrales. */
async function cargarConfiguracion(repo) {
  const filas = await repo.configuraciones();
  const config = { global: null, porCategoria: new Map(), fechas: new Map() };
  for (const fila of filas) {
    const dias = diasValidosONull(fila.valor);
    if (dias === null) continue; // un valor dañado no debe romper los cálculos: se ignora
    if (fila.clave === CLAVE_GLOBAL) {
      config.global = dias;
      config.fechas.set('global', fila.fecha_actualizacion ?? null);
    } else if (fila.clave.startsWith(PREFIJO_CATEGORIA)) {
      const id = Number(fila.clave.slice(PREFIJO_CATEGORIA.length));
      if (Number.isSafeInteger(id) && id > 0) {
        config.porCategoria.set(id, dias);
        config.fechas.set(id, fila.fecha_actualizacion ?? null);
      }
    }
  }
  return config;
}

/** Devuelve una función `(categoriaId) => { dias, origen }` con la configuración vigente. */
async function obtenerResolvedor(repo = repositorioPorDefecto()) {
  const config = await cargarConfiguracion(repo);
  return (categoriaId) => resolverUmbral(categoriaId, config);
}

/** TC-03: vista completa de la configuración para la pantalla del administrador. */
async function obtenerConfiguracion(repo = repositorioPorDefecto()) {
  const [config, categorias] = await Promise.all([cargarConfiguracion(repo), repo.categorias()]);
  const general = config.global === null
    ? { dias: DIAS_PREDETERMINADO, configurado: false, origen: 'predeterminado', fecha_actualizacion: null }
    : { dias: config.global, configurado: true, origen: 'global', fecha_actualizacion: config.fechas.get('global') };

  const filas = categorias.map((categoria) => {
    const propio = config.porCategoria.get(Number(categoria.id));
    const resuelto = resolverUmbral(categoria.id, config);
    return {
      categoria_id: Number(categoria.id),
      nombre: categoria.nombre,
      dias: resuelto.dias,
      configurado: propio !== undefined,
      origen: resuelto.origen,
      fecha_actualizacion: propio !== undefined ? config.fechas.get(Number(categoria.id)) : null,
    };
  });
  return { general, categorias: filas, dias_predeterminado: DIAS_PREDETERMINADO };
}

/**
 * TC-01 / TC-03 / TC-06: guarda el umbral general (categoriaId = null) o el de una categoría.
 * TC-02 / TC-05: valida ANTES de tocar la base; si el valor es inválido no se cambia nada.
 */
async function guardarUmbral({ categoriaId = null, dias }, repo = repositorioPorDefecto()) {
  const valor = validarDiasVencimiento(dias);

  if (categoriaId === null || categoriaId === undefined) {
    const anterior = (await cargarConfiguracion(repo)).global;
    await repo.guardarClave(CLAVE_GLOBAL, valor);
    return {
      alcance: 'general', categoria_id: null, categoria_nombre: null,
      dias: valor, dias_anterior: anterior ?? DIAS_PREDETERMINADO,
    };
  }

  const id = leerIdCategoria(categoriaId);
  const categoria = await repo.categoriaPorId(id);
  if (!categoria) throw new ErrorUmbralVencimiento('Categoría no encontrada.', 404);
  const config = await cargarConfiguracion(repo);
  const anterior = resolverUmbral(id, config).dias;
  await repo.guardarClave(claveCategoria(id), valor);
  return {
    alcance: 'categoria', categoria_id: id, categoria_nombre: categoria.nombre,
    dias: valor, dias_anterior: anterior,
  };
}

/** TC-06: la categoría vuelve a usar el umbral general. */
async function restablecerUmbralCategoria(categoriaId, repo = repositorioPorDefecto()) {
  const id = leerIdCategoria(categoriaId);
  const categoria = await repo.categoriaPorId(id);
  if (!categoria) throw new ErrorUmbralVencimiento('Categoría no encontrada.', 404);
  const eliminados = await repo.borrarClave(claveCategoria(id));
  if (!eliminados) throw new ErrorUmbralVencimiento('La categoría ya usaba el umbral general.', 404);
  const config = await cargarConfiguracion(repo);
  return { categoria_id: id, categoria_nombre: categoria.nombre, dias: resolverUmbral(id, config).dias };
}

/** Mensaje de confirmación (TC-07) que el backend entrega junto con el cambio. */
function mensajeConfirmacion(resultado) {
  const unidad = resultado.dias === 1 ? 'día' : 'días';
  return resultado.alcance === 'general'
    ? `Umbral general guardado: se alertará ${resultado.dias} ${unidad} antes del vencimiento.`
    : `Umbral de la categoría «${resultado.categoria_nombre}» guardado: se alertará ${resultado.dias} ${unidad} antes del vencimiento.`;
}

// ---------------------------------------------------------------- riesgo (TC-04)

/**
 * Evalúa los lotes con stock y fecha de vencimiento aplicando el umbral de su categoría.
 * No escribe nada: devuelve solo los lotes vencidos o en riesgo, del más urgente al menos.
 */
async function evaluarRiesgoVencimiento({ repo = repositorioPorDefecto(), hoy = new Date() } = {}) {
  const [resolver, lotes] = await Promise.all([obtenerResolvedor(repo), repo.lotesConStock()]);
  const fechaHoy = fechaEnLima(hoy);
  const filas = [];
  let evaluados = 0;
  for (const lote of lotes) {
    if (lote.producto_activo === false) continue;
    evaluados += 1;
    const dias = diasHastaVencimiento(lote.fecha_vencimiento, hoy);
    const umbral = resolver(lote.categoria_id);
    const resultado = evaluarLote(dias, umbral.dias);
    if (!resultado.en_riesgo) continue;
    filas.push({
      lote_id: lote.id,
      numero_lote: lote.numero_lote,
      producto_id: lote.producto_id,
      producto_codigo: lote.producto_codigo,
      producto_nombre: lote.producto_nombre,
      categoria_id: lote.categoria_id,
      cantidad_actual: lote.cantidad_actual,
      fecha_vencimiento: lote.fecha_vencimiento,
      dias_restantes: dias,
      umbral_dias: umbral.dias,
      origen_umbral: umbral.origen,
      estado: resultado.estado,
      severidad: resultado.severidad,
    });
  }
  filas.sort((a, b) => a.dias_restantes - b.dias_restantes || a.lote_id - b.lote_id);
  return { fecha_calculo: fechaHoy, lotes_evaluados: evaluados, total_en_riesgo: filas.length, data: filas };
}

function mensajeAlerta(fila) {
  const nombre = fila.producto_nombre ?? `producto ${fila.producto_id}`;
  if (fila.estado === 'vencido') {
    return `El lote ${fila.numero_lote} de ${nombre} venció hace ${Math.abs(fila.dias_restantes)} día(s) y aún tiene ${fila.cantidad_actual} unidades.`;
  }
  return `El lote ${fila.numero_lote} de ${nombre} vence en ${fila.dias_restantes} día(s) (umbral: ${fila.umbral_dias}) y tiene ${fila.cantidad_actual} unidades.`;
}

/**
 * Crea/actualiza las alertas `riesgo_vencimiento` según el umbral vigente y marca como atendidas
 * las que ya no están en riesgo (p. ej. porque el administrador subió o bajó el umbral).
 */
async function generarAlertasVencimiento({ repo = repositorioPorDefecto(), hoy = new Date() } = {}) {
  const riesgo = await evaluarRiesgoVencimiento({ repo, hoy });
  const abiertas = await repo.alertasAbiertas();
  const porLote = new Map(abiertas.map((alerta) => [Number(alerta.lote_id), alerta]));
  const enRiesgo = new Set();
  let creadas = 0;
  let actualizadas = 0;
  let resueltas = 0;

  for (const fila of riesgo.data) {
    enRiesgo.add(Number(fila.lote_id));
    const datos = {
      mensaje: mensajeAlerta(fila),
      severidad: fila.severidad,
      datos_origen: {
        origen: 'umbral_vencimiento',
        umbral_dias: fila.umbral_dias,
        origen_umbral: fila.origen_umbral,
        dias_restantes: fila.dias_restantes,
        fecha_vencimiento: fila.fecha_vencimiento,
      },
    };
    const existente = porLote.get(Number(fila.lote_id));
    if (existente) {
      await repo.actualizarAlerta(existente.id, datos);
      actualizadas += 1;
    } else {
      await repo.crearAlerta({
        tipo: 'riesgo_vencimiento', producto_id: fila.producto_id, lote_id: fila.lote_id, estado: 'nueva', ...datos,
      });
      creadas += 1;
    }
  }
  for (const alerta of abiertas) {
    if (enRiesgo.has(Number(alerta.lote_id))) continue;
    await repo.actualizarAlerta(alerta.id, { estado: 'atendida', fecha_atendida: new Date() });
    resueltas += 1;
  }
  return { creadas, actualizadas, resueltas, lotes_evaluados: riesgo.lotes_evaluados, total_en_riesgo: riesgo.total_en_riesgo };
}

module.exports = {
  CLAVE_GLOBAL,
  PREFIJO_CATEGORIA,
  obtenerResolvedor,
  obtenerConfiguracion,
  guardarUmbral,
  restablecerUmbralCategoria,
  mensajeConfirmacion,
  evaluarRiesgoVencimiento,
  generarAlertasVencimiento,
};
