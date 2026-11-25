const { validationResult } = require('express-validator');
const { ReporteGenerado } = require('../models');
const { ReporteDto } = require('../dtos/reporteDto');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// EXPORTAR INVENTARIO
const exportarInventario = async (req, res, next) => {
  try {
    const { Producto, Lote } = require('../models');

    const productos = await Producto.findAll({
      include: [
        { model: Producto.sequelize.models.Categoria, as: 'categoria' },
        { model: Lote, as: 'lotes' }
      ]
    });

    let excel = 'Código,Producto,Categoría,Stock total,Activo\n';

    for (const p of productos) {
      const stock = (p.lotes || []).reduce(
        (s, l) => s + (l.cantidad_actual || 0), 0
      );

      const categoria = p.categoria ? p.categoria.nombre : '';

      excel += `${p.codigo},${p.nombre},${categoria},${stock},${p.activo ? 'Sí' : 'No'}\n`;
    }

    res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(excel);

    await ReporteGenerado.create({
      usuario_id: req.user.id,
      tipo: 'inventario',
      formato: 'excel'
    });

  } catch (error) {
    next(error);
  }
};

// INDICADORES DEL SISTEMA
const kpis = async (req, res, next) => {
  try {
    const { Producto, Venta, Alerta, OrdenReabastecimiento } = require('../models');

    const ahora = new Date();

    const productosActivos = await Producto.count({
      where: { activo: true }
    });

    const ventasMes = await Venta.sum('cantidad', {
      where: {
        fecha_venta: {
          [Op.gte]: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
          [Op.lt]: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
        }
      }
    }) || 0;

    const alertasActivas = await Alerta.count({
      where: {
        estado: { [Op.in]: ['nueva', 'vista'] }
      }
    });

    const alertasCriticas = await Alerta.count({
      where: {
        severidad: 'critica',
        estado: { [Op.in]: ['nueva', 'vista'] }
      }
    });

    const ordenesPendientes = await OrdenReabastecimiento.count({
      where: { estado: 'pendiente' }
    });

    // HU-157: productos con alerta de bajo stock activa (nueva o vista).
    const stockBajo = await Alerta.count({
      where: {
        tipo: 'bajo_stock',
        estado: { [Op.in]: ['nueva', 'vista'] }
      }
    });

    res.json({
      data: {
        productos_activos: productosActivos,
        ventas_mes_actual: ventasMes,
        alertas_activas: alertasActivas,
        alertas_criticas: alertasCriticas,
        stock_bajo: stockBajo,
        ordenes_pendientes: ordenesPendientes
      }
    });

  } catch (error) {
    next(error);
  }
};

// RESUMEN DE LA PANTALLA DE INICIO (HU-188)
// Lo puede ver cualquier usuario autenticado: el contenido se filtra según sus permisos.
const ESTADOS_ALERTA_ACTIVA = ['nueva', 'vista'];

async function obtenerPermisosUsuario(usuarioId) {
  const { Usuario } = require('../models');
  const usuario = await Usuario.findByPk(usuarioId, {
    include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }]
  });
  if (!usuario) return { todos: false, codigos: new Set() };
  if (usuario.is_staff || usuario.is_superuser) return { todos: true, codigos: new Set() };
  if (!usuario.rol) return { todos: false, codigos: new Set() };
  const permisos = await usuario.rol.getPermisos();
  return { todos: false, codigos: new Set(permisos.map((permiso) => permiso.codigo)) };
}

function crearRepositorioInicio() {
  const { Alerta, Producto, Venta, Lote, OrdenReabastecimiento } = require('../models');
  const { fn, col } = require('sequelize');
  return {
    contarProductosActivos: () => Producto.count({ where: { activo: true } }),
    ventasDelMes: async (ahora) => (await Venta.sum('cantidad', {
      where: {
        fecha_venta: {
          [Op.gte]: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
          [Op.lt]: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
        }
      }
    })) || 0,
    contarAlertasActivas: (filtro) => Alerta.count({
      where: { ...filtro, estado: { [Op.in]: ESTADOS_ALERTA_ACTIVA } }
    }),
    contarOrdenesPendientes: () => OrdenReabastecimiento.count({ where: { estado: 'pendiente' } }),
    alertasRecientes: (limite) => Alerta.findAll({
      attributes: ['id', 'tipo', 'severidad', 'mensaje', 'estado', 'fecha_creacion', 'producto_id', 'datos_origen'],
      where: { estado: { [Op.in]: ESTADOS_ALERTA_ACTIVA } },
      order: [['fecha_creacion', 'DESC']],
      limit: limite,
      raw: true
    }),
    productosMasVendidos: async (desde, limite) => {
      const filas = await Venta.findAll({
        attributes: ['producto_id', [fn('SUM', col('cantidad')), 'total']],
        where: { fecha_venta: { [Op.gte]: desde } },
        group: ['producto_id'],
        order: [[fn('SUM', col('cantidad')), 'DESC']],
        limit: limite,
        raw: true
      });
      return filas.filter((fila) => Number(fila.total) > 0).map((fila) => Number(fila.producto_id));
    },
    stockPorProducto: async (ids) => {
      const filas = await Lote.findAll({
        attributes: ['producto_id', [fn('SUM', col('cantidad_actual')), 'stock_disponible']],
        where: { producto_id: { [Op.in]: ids }, cantidad_actual: { [Op.gt]: 0 } },
        group: ['producto_id'],
        raw: true
      });
      return new Map(filas.map((fila) => [Number(fila.producto_id), Number(fila.stock_disponible)]));
    },
    predecir: (ids, horizonte) => require('../services/prediccionDemandaService').predecirProductos(ids, { horizonte })
  };
}

const resumenInicio = async (req, res, next) => {
  try {
    const { construirResumenInicio } = require('../services/resumenInicioService');
    const permisos = await obtenerPermisosUsuario(req.user.id);
    const data = await construirResumenInicio({
      permisos,
      repositorio: crearRepositorioInicio(),
      logger
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportarInventario,
  kpis,
  resumenInicio
};