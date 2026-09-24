const { validationResult } = require('express-validator');
const { ReporteGenerado } = require('../models');
const { ReporteDto } = require('../dtos/reporteDto');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const exportarInventario = async (req, res) => {
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
      const stock = (p.lotes || []).reduce((s, l) => s + (l.cantidad_actual || 0), 0);
      const categoria = p.categoria ? p.categoria.nombre : '';
      excel += `${p.codigo},${p.nombre},${categoria},${stock},${p.activo ? 'Sí' : 'No'}\n`;
    }
    res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(excel);
    await ReporteGenerado.create({ usuario_id: req.user.id, tipo: 'inventario', formato: 'excel' });
  } catch (error) { next(error); }
};

const kpis = async (req, res, next) => {
  try {
    const { Producto, Venta, Alerta, OrdenReabastecimiento } = require('../models');
    const ahora = new Date();
    const productosActivos = await Producto.count({ where: { activo: true } });
    const ventasMes = await Venta.sum('cantidad', {
      where: { fecha_venta: { [Op.gte]: new Date(ahora.getFullYear(), ahora.getMonth(), 1), [Op.lt]: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1) } }
    }) || 0;
    const alertasActivas = await Alerta.count({ where: { estado: { [Op.in]: ['nueva', 'vista'] } } });
    const alertasCriticas = await Alerta.count({ where: { severidad: 'critica', estado: { [Op.in]: ['nueva', 'vista'] } } });
    const ordenesPendientes = await OrdenReabastecimiento.count({ where: { estado: 'pendiente' } });
    res.json({ data: { productos_activos: productosActivos, ventas_mes_actual: ventasMes, alertas_activas: alertasActivas, alertas_criticas: alertasCriticas, ordenes_pendientes: ordenesPendientes } });
  } catch (error) { next(error); }
};

const resumenInicio = async (req, res, next) => {
  try {
    const { Alerta, Producto, Venta, OrdenReabastecimiento } = require('../models');
    const { Op } = require('sequelize');
    const alertas = await Alerta.findAll({ where: { estado: { [Op.in]: ['nueva', 'vista'] } }, order: [['fecha_creacion', 'DESC']], limit: 5 });
    const ahora = new Date();
    const ventasMes = await Venta.sum('cantidad', { where: { fecha_venta: { [Op.gte]: new Date(ahora.getFullYear(), ahora.getMonth(), 1), [Op.lt]: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1) } } }) || 0;
    const alertasActivas = await Alerta.count({ where: { estado: { [Op.in]: ['nueva', 'vista'] } } });
    const alertasCriticas = await Alerta.count({ where: { severidad: 'critica', estado: { [Op.in]: ['nueva', 'vista'] } } });
    const ordenesPendientes = await OrdenReabastecimiento.count({ where: { estado: 'pendiente' } });
    res.json({ data: { alertas_recientes: alertas, kpis: { productos_activos: await Producto.count({ where: { activo: true } }), ventas_mes_actual: ventasMes, alertas_activas, alertas_criticas, ordenes_pendientes } } });
  } catch (error) { next(error); }
};
module.exports = { exportarInventario, kpis, resumenInicio };
