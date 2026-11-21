const { validationResult } = require('express-validator');
const { Alerta } = require('../models');
const { NotificacionCorreo } = require('../models');
const { AlertaDto } = require('../dtos/alertaDto');
const alertaService = require('../services/alertaService');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const { tipo, severidad, estado, producto, pagina } = req.query;
    const where = {};

    if (tipo) where.tipo = tipo;
    if (severidad) where.severidad = severidad;
    if (estado) {
      const estados = String(estado).split(',').map(e => e.trim());
      where.estado = estados.length > 1
        ? { [require('sequelize').Op.in]: estados }
        : estados[0];
    }
    if (producto) where.producto_id = producto;

    // Mantener compatibilidad con las consultas existentes
    if (pagina === undefined) {
      const alertas = await Alerta.findAll({
        where,
        order: [['fecha_creacion', 'DESC']],
      });

      return res.json({
        data: alertas.map(a => AlertaDto.fromModel(a)),
      });
    }

    const paginaActual = Number(pagina);

    if (!Number.isSafeInteger(paginaActual) || paginaActual < 1) {
      return res.status(400).json({
        error: 'El número de página debe ser un entero positivo.',
      });
    }

    const limite = 10;
    const offset = (paginaActual - 1) * limite;

    const { count, rows } = await Alerta.findAndCountAll({
      where,
      limit: limite,
      offset,
      order: [
        [
          require('sequelize').literal(`
            CASE severidad
              WHEN 'critica' THEN 4
              WHEN 'alta' THEN 3
              WHEN 'media' THEN 2
              WHEN 'baja' THEN 1
              ELSE 0
            END
          `),
          'DESC',
        ],
        ['fecha_creacion', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return res.json({
      data: rows.map(a => AlertaDto.fromModel(a)),
      paginacion: {
        pagina: paginaActual,
        limite,
        total: count,
        totalPaginas: Math.ceil(count / limite),
      },
    });
  } catch (error) {
    next(error);
  }
};
const obtener = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = AlertaDto.fromCreate(req.body); const alerta = await Alerta.create(data);
    res.status(201).json({ data: AlertaDto.fromModel(alerta) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); const data = AlertaDto.fromUpdate(req.body); await alerta.update(data); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const marcarVista = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); alerta.estado = 'vista'; await alerta.save(); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const atender = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); alerta.estado = 'atendida'; alerta.fecha_atendida = new Date(); await alerta.save(); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const notificar = async (req, res, next) => {
  try {
    const alerta = await Alerta.findByPk(req.params.id);
    if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
    const { enviarCorreo } = require('../services/correoService');
    const destinatarios = req.body.destinatarios || [];
    for (const correo of destinatarios) {
      await enviarCorreo(
        correo,
        `Alerta ${alerta.severidad}: ${alerta.producto_id}`,
        alerta.mensaje
      );
      await NotificacionCorreo.create({
        alerta_id: alerta.id, destinatario: correo,
        estado: 'enviado',
        fecha_envio: new Date(),
        proveedor: 'smtp',
      });
    }
    res.json({ message: 'Notificaciones procesadas' });
  } catch (error) { next(error); }
};
const sincronizarML = async (req, res, next) => {
  try {
    const { procesadas } = await alertaService.sincronizarAlertasML();
    res.json({ data: { procesadas } });
  } catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, marcarVista, atender, notificar, sincronizarML };
