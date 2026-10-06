const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const { Producto, ProductoPresentacion, Categoria, UnidadMedida, CatalogoMarca, tipoEnvase } = require('../models');
const { ProductoDto } = require('../dtos/productoDto');
const { Lote } = require('../models');
const { registrarMovimiento } = require('../services/kardexService');
const logger = require('../utils/logger');

// Carga masiva desde CSV/Excel. Tope de filas por peticion: el endpoint es
// todo-o-nada, asi que el limite evita que una sola llamada bloquee la base.
const MAXIMO_FILAS_IMPORTACION = 500;

function imagenGuardada(file) {
  return file ? `/upload/productos/${file.filename}` : null;
}

function parseCaracteristicas(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_error) { return {}; }
}

function parsePresentaciones(value) {
  if (!value) return [];
  const presentaciones = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(presentaciones)) return [];
  return presentaciones.map((presentacion, indice) => ({
    nivel: indice + 1,
    envase_id: Number(presentacion.envase_id),
    cantidad: Number(presentacion.cantidad),
  })).filter((presentacion) => (
    Number.isInteger(presentacion.envase_id) && presentacion.envase_id > 0 && presentacion.cantidad > 0
  ));
}

async function maximoNumeroCodigoProducto() {
  const productos = await Producto.findAll({
    attributes: ['codigo'],
    where: { codigo: { [Op.iLike]: 'P-%' } },
  });
  return productos.reduce((maximo, producto) => {
    const numero = Number(producto.codigo.match(/^P-(\d+)$/i)?.[1] || 0);
    return Math.max(maximo, numero);
  }, 0);
}

async function siguienteCodigoProducto() {
  return `P-${String((await maximoNumeroCodigoProducto()) + 1).padStart(3, '0')}`;
}

function codigosConsecutivos(desde, cantidad) {
  return Array.from({ length: cantidad }, (_v, indice) => `P-${String(desde + indice).padStart(3, '0')}`);
}

function eliminarImagenSiExiste(file) {
  if (file?.path) fs.rmSync(path.resolve(file.path), { force: true });
}

const listar = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.categoria_id) where.categoria_id = Number(req.query.categoria_id);
    if (req.query.marca_id) where.marca_id = Number(req.query.marca_id);
    if (req.query.activo !== undefined) where.activo = req.query.activo === 'true';
    if (req.query.search) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${req.query.search}%` } },
        { codigo: { [Op.iLike]: `%${req.query.search}%` } },
      ];
    }
    const productos = await Producto.findAll({
      where,
      include: [
        { model: Producto.sequelize.models.Categoria, as: 'categoria' },
        { model: Producto.sequelize.models.UnidadMedida, as: 'unidadMedida' },
        { model: Producto.sequelize.models.Presentacion, as: 'presentacion' },
        { model: Producto.sequelize.models.CatalogoMarca, as: 'marca' },
        { model: Producto.sequelize.models.Lote, as: 'lotes' }
      ]
    });
    const data = productos.map(p => {
      const dto = ProductoDto.fromModel(p);
      dto.stock_total = (p.lotes || []).reduce((s, l) => s + Number(l.cantidad_actual || 0), 0);
      return dto;
    });
    res.json({ data });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: [
        { model: Producto.sequelize.models.Categoria, as: 'categoria' },
        { model: Producto.sequelize.models.UnidadMedida, as: 'unidadMedida' },
        { model: Producto.sequelize.models.Presentacion, as: 'presentacion' },
        { model: Producto.sequelize.models.CatalogoMarca, as: 'marca' },
        { model: Producto.sequelize.models.Lote, as: 'lotes' }
      ]
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const dto = ProductoDto.fromModel(producto);
    dto.stock_total = (producto.lotes || []).reduce((s, l) => s + Number(l.cantidad_actual || 0), 0);
    res.json({ data: dto });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  let transaction;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    transaction = await Producto.sequelize.transaction();
    const presentaciones = parsePresentaciones(req.body.presentaciones_niveles);
    const data = ProductoDto.fromCreate({
      ...req.body,
      caracteristicas: parseCaracteristicas(req.body.caracteristicas),
      imagen: imagenGuardada(req.file),
    });
    data.codigo = await siguienteCodigoProducto();
    const producto = await Producto.create(data, { transaction });
    if (presentaciones.length) {
      await ProductoPresentacion.bulkCreate(
        presentaciones.map((presentacion) => ({ ...presentacion, producto_id: producto.id })),
        { transaction }
      );
    }
    await transaction.commit();
    res.status(201).json({ data: ProductoDto.fromModel(producto) });
  } catch (error) {
    if (transaction) await transaction.rollback();
    eliminarImagenSiExiste(req.file);
    next(error);
  }
};

function textoOpcional(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function enteroOpcional(valor) {
  if (valor === undefined || valor === null || textoOpcional(valor) === null) return null;
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

function decimalOpcional(valor, campo, fila, errores) {
  if (valor === undefined || valor === null || textoOpcional(valor) === null) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    errores.push({ fila, msg: `${campo} no es un número válido` });
    return null;
  }
  return numero;
}

async function idsExistentes(Modelo, ids) {
  if (!ids.length) return new Set();
  const filas = await Modelo.findAll({ attributes: ['id'], where: { id: { [Op.in]: ids } } });
  return new Set(filas.map((fila) => fila.id));
}

/**
 * Normaliza y valida las filas que llegan del importador, sin tocar la base.
 * Devuelve los registros listos para `ProductoDto.fromCreate` junto con la
 * lista de errores por fila, para que el usuario sepa qué corregir.
 */
function prepararRegistros(productos) {
  const errores = [];
  const registros = productos.map((fila, indice) => {
    const numero = Number.isInteger(fila?.fila) ? fila.fila : indice + 2;
    const marcar = (msg) => errores.push({ fila: numero, msg });

    const nombre = textoOpcional(fila?.nombre);
    if (!nombre) marcar('Falta el nombre comercial');
    else if (nombre.length > 200) marcar('El nombre comercial supera los 200 caracteres');

    const categoria_id = enteroOpcional(fila?.categoria_id);
    if (categoria_id === null) marcar('La categoría del producto es obligatoria');

    const unidad_medida_id = enteroOpcional(fila?.unidad_medida_id);
    if (unidad_medida_id === null) marcar('La unidad de medida del producto es obligatoria');

    const marca_id = enteroOpcional(fila?.marca_id);

    const categoria_paquete_id = enteroOpcional(fila?.categoria_paquete_id);
    if (categoria_paquete_id === null) marcar('La categoría de paquete del producto es obligatoria');

    const contenido_valor = decimalOpcional(fila?.contenido_valor, 'contenido_valor', numero, errores);
    if (contenido_valor !== null && contenido_valor < 0) marcar('El contenido no puede ser negativo');

    const contenido_paquete_cantidad = decimalOpcional(
      fila?.contenido_paquete_cantidad, 'contenido_paquete_cantidad', numero, errores
    );
    const contenido_paquete_envase_id = enteroOpcional(fila?.contenido_paquete_envase_id);

    // Mismo emparejamiento que valida el formulario y que impone el CHECK
    // chk_producto_paquete_emparejado de la base.
    if ((contenido_paquete_cantidad === null) !== (contenido_paquete_envase_id === null)) {
      marcar('La cantidad del empaque y su envase deben venir juntos o ambos vacíos');
    }
    if (contenido_paquete_cantidad !== null && contenido_paquete_cantidad <= 0) {
      marcar('La cantidad del empaque debe ser mayor que cero');
    }

    const precio = decimalOpcional(fila?.precio_venta, 'precio_venta', numero, errores);
    if (precio !== null && precio < 0) marcar('El precio de venta no puede ser negativo');

    return {
      fila: numero,
      nombre,
      categoria_id,
      unidad_medida_id,
      marca_id,
      categoria_paquete_id,
      contenido_valor,
      contenido_paquete_cantidad,
      contenido_paquete_envase_id,
      precio_venta: precio === null ? null : precio.toFixed(2),
      descripcion: textoOpcional(fila?.descripcion),
    };
  });

  return { registros, errores };
}

/** Comprueba que cada id referenciado exista realmente en su catálogo. */
function validarReferencias(registros, existentes) {
  const errores = [];
  for (const registro of registros) {
    const marcar = (msg) => errores.push({ fila: registro.fila, msg });
    if (registro.categoria_id !== null && !existentes.categorias.has(registro.categoria_id)) {
      marcar('La categoría indicada no existe en el catálogo');
    }
    if (registro.unidad_medida_id !== null && !existentes.unidades.has(registro.unidad_medida_id)) {
      marcar('La unidad de medida indicada no existe en el catálogo');
    }
    if (registro.marca_id !== null && !existentes.marcas.has(registro.marca_id)) {
      marcar('La marca indicada no existe en el catálogo');
    }
    if (registro.categoria_paquete_id !== null && !existentes.tiposEnvase.has(registro.categoria_paquete_id)) {
      marcar('La categoría de paquete indicada no existe en el catálogo');
    }
    if (registro.contenido_paquete_envase_id !== null && !existentes.tiposEnvase.has(registro.contenido_paquete_envase_id)) {
      marcar('El envase del contenido indicado no existe en el catálogo');
    }
  }
  return errores;
}

function responderInvalido(res, mensaje) {
  return res.status(400).json({ error: mensaje });
}

/**
 * HU02: carga masiva desde CSV/Excel. El frontend ya valido el archivo y
 * resolvio los ids de catalogo, pero aqui se vuelve a validar todo antes de
 * escribir: la carga es todo-o-nada, asi que un solo dato invalido devuelve
 * 400 con el detalle por fila y no se inserta nada.
 */
const importar = async (req, res, next) => {
  let transaction;
  try {
    const productos = Array.isArray(req.body?.productos) ? req.body.productos : null;
    if (!productos || productos.length === 0) {
      return responderInvalido(res, 'No se recibió ningún producto para importar');
    }
    if (productos.length > MAXIMO_FILAS_IMPORTACION) {
      return responderInvalido(
        res,
        `Una importación admite hasta ${MAXIMO_FILAS_IMPORTACION} productos. Divide el archivo e inténtalo de nuevo.`
      );
    }

    const { registros, errores } = prepararRegistros(productos);

    const distintos = (valores) => [...new Set(valores.filter((valor) => valor !== null))];
    const [categorias, unidades, marcas, tiposEnvase] = await Promise.all([
      idsExistentes(Categoria, distintos(registros.map((r) => r.categoria_id))),
      idsExistentes(UnidadMedida, distintos(registros.map((r) => r.unidad_medida_id))),
      idsExistentes(CatalogoMarca, distintos(registros.map((r) => r.marca_id))),
      idsExistentes(tipoEnvase, [
        ...distintos(registros.map((r) => r.categoria_paquete_id)),
        ...distintos(registros.map((r) => r.contenido_paquete_envase_id)),
      ]),
    ]);

    errores.push(...validarReferencias(registros, { categorias, unidades, marcas, tiposEnvase }));

    if (errores.length) {
      return res.status(400).json({
        error: `No se importó ningún producto: hay ${errores.length} dato(s) inválido(s) en el archivo`,
        details: errores.slice(0, 50),
      });
    }

    transaction = await Producto.sequelize.transaction();
    const codigos = codigosConsecutivos((await maximoNumeroCodigoProducto()) + 1, registros.length);
    const creados = await Producto.bulkCreate(
      registros.map((registro, indice) => ProductoDto.fromCreate({ ...registro, codigo: codigos[indice] })),
      { transaction, returning: true }
    );
    await transaction.commit();

    logger.info(`Importacion de productos: ${creados.length} productos creados desde archivo`);
    res.status(201).json({ data: { creados: creados.length, codigos } });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const data = ProductoDto.fromUpdate({
      ...req.body,
      caracteristicas: parseCaracteristicas(req.body.caracteristicas),
      ...(req.file ? { imagen: imagenGuardada(req.file) } : {}),
    });
    await producto.update(data);
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const desactivar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const motivo = req.body.motivo_desactivacion;
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de desactivación' });
    producto.activo = false;
    producto.motivo_desactivacion = motivo;
    producto.motivo_desactivacion_detalle = req.body.motivo_desactivacion_detalle || '';
    producto.fecha_desactivacion = new Date();
    await producto.save();
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const activar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    producto.activo = true;
    producto.motivo_desactivacion = null;
    producto.motivo_desactivacion_detalle = null;
    producto.fecha_desactivacion = null;
    await producto.save();
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const ingreso = async (req, res, next) => {
  try {
    return res.status(400).json({
      error: 'El ingreso de stock debe hacerse creando un lote válido. Usa el flujo de registrar lote.',
    });
  } catch (error) { next(error); }
};

module.exports = {
  listar, obtener, crear, actualizar, importar, desactivar, activar, ingreso,
  // Exportados para las pruebas unitarias de la carga masiva.
  prepararRegistros, validarReferencias, codigosConsecutivos, MAXIMO_FILAS_IMPORTACION,
};
