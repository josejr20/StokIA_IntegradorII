const { validationResult } = require('express-validator');
const { PreferenciaUsuario } = require('../models');
const { PreferenciaDto } = require('../dtos/preferenciaDto');

const obtenerUsuarioId = (req) => req.user?.id;

const validarPreferencia = (clave, valor) => {
  if (
    typeof clave !== 'string' ||
    clave.trim().length === 0 ||
    clave.length > 80
  ) {
    return 'La clave de la preferencia no es válida.';
  }

  if (
    valor === null ||
    typeof valor !== 'object' ||
    Array.isArray(valor)
  ) {
    return 'El valor de la preferencia debe ser un objeto válido.';
  }

  return null;
};

const listar = async (req, res, next) => {
  try {
    const usuarioId = obtenerUsuarioId(req);

    if (!usuarioId) {
      return res.status(401).json({
        error: 'Usuario no autenticado.'
      });
    }

    const preferencias = await PreferenciaUsuario.findAll({
      where: {
        usuario_id: usuarioId
      },
      order: [['fecha_actualizacion', 'DESC']]
    });

    return res.json({
      data: preferencias.map((preferencia) =>
        PreferenciaDto.fromModel(preferencia)
      )
    });

  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const usuarioId = obtenerUsuarioId(req);

    if (!usuarioId) {
      return res.status(401).json({
        error: 'Usuario no autenticado.'
      });
    }

    const preferencia = await PreferenciaUsuario.findOne({
      where: {
        usuario_id: usuarioId,
        clave: req.params.clave
      }
    });

    if (!preferencia) {
      return res.status(404).json({
        error: 'Preferencia no encontrada.'
      });
    }

    return res.json({
      data: PreferenciaDto.fromModel(preferencia)
    });

  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const usuarioId = obtenerUsuarioId(req);

    if (!usuarioId) {
      return res.status(401).json({
        error: 'Usuario no autenticado.'
      });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos inválidos.',
        details: errors.array()
      });
    }

    const { clave, valor } = req.body;

    const errorValidacion = validarPreferencia(clave, valor);

    if (errorValidacion) {
      return res.status(400).json({
        error: errorValidacion
      });
    }

    const data = PreferenciaDto.fromCreate({
      clave: clave.trim(),
      valor
    });

    data.usuario_id = usuarioId;
    data.fecha_actualizacion = new Date();

    await PreferenciaUsuario.upsert(data, {
      returning: true
    });

    const preferencia = await PreferenciaUsuario.findOne({
      where: {
        usuario_id: usuarioId,
        clave: clave.trim()
      }
    });

    return res.status(200).json({
      message: 'Preferencia guardada correctamente.',
      data: PreferenciaDto.fromModel(preferencia)
    });

  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const usuarioId = obtenerUsuarioId(req);

    if (!usuarioId) {
      return res.status(401).json({
        error: 'Usuario no autenticado.'
      });
    }

    const { valor } = req.body;

    const errorValidacion = validarPreferencia(
      req.params.clave,
      valor
    );

    if (errorValidacion) {
      return res.status(400).json({
        error: errorValidacion
      });
    }

    const preferencia = await PreferenciaUsuario.findOne({
      where: {
        usuario_id: usuarioId,
        clave: req.params.clave
      }
    });

    if (!preferencia) {
      return res.status(404).json({
        error: 'Preferencia no encontrada.'
      });
    }

    const data = PreferenciaDto.fromUpdate({ valor });

    data.fecha_actualizacion = new Date();

    await preferencia.update(data);

    return res.json({
      message: 'Preferencia actualizada correctamente.',
      data: PreferenciaDto.fromModel(preferencia)
    });

  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const preferencia = await PreferenciaUsuario.findOne({
      where: {
        usuario_id: req.user.id,
        clave: req.params.clave
      }
    });

    if (!preferencia) {
      return res.status(200).json({
        message: 'No existen preferencias personalizadas. Se utilizarán los valores predeterminados.'
      });
    }

    await preferencia.destroy();

    return res.status(200).json({
      message: 'Preferencias restablecidas correctamente.'
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};