
'use strict';

const { Op } = require('sequelize');
const { Producto, Lote, Alerta } = require('../models');
const prediccionService = require('../services/prediccionDemandaService');

const {
  generarPDF,
  generarExcel
} = require('../services/exportacionReporteService');

// Obtener el periodo usando la fecha de Perú
function obtenerPeriodoAnterior(dias) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const obtener = (tipo) =>
    partes.find((parte) => parte.type === tipo).value;

  const anio = Number(obtener('year'));
  const mes = Number(obtener('month'));
  const dia = Number(obtener('day'));

  const hasta = [
    String(anio).padStart(4, '0'),
    String(mes).padStart(2, '0'),
    String(dia).padStart(2, '0')
  ].join('-');

  const inicio = new Date(Date.UTC(anio, mes - 1, dia));

  inicio.setUTCDate(inicio.getUTCDate() - dias);

  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta
  };
}

const exportarReporte = async (req, res, next) => {
  try {
    const formato = String(req.query.formato || '').toLowerCase();
    const dias = Number(req.query.dias || 7);

    // 1. Validar formato
    if (!['pdf', 'excel'].includes(formato)) {
      return res.status(400).json({
        error: 'Selecciona PDF o Excel.'
      });
    }

    // 2. Validar periodo
    if (![7, 14, 30].includes(dias)) {
      return res.status(400).json({
        error: 'Selecciona 7, 14 o 30 días.'
      });
    }

    // 3. Obtener inventario actual
    const productos = await Producto.findAll({
      where: { activo: true },
      include: [
        {
          model: Producto.sequelize.models.Categoria,
          as: 'categoria'
        },
        {
          model: Lote,
          as: 'lotes'
        }
      ]
    });

    const inventario = productos.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria?.nombre || '',
      stock_total: (p.lotes || []).reduce(
        (total, lote) =>
          total + Number(lote.cantidad_actual || 0),
        0
      ),
      activo: p.activo
    }));

    // 4. Obtener predicciones
    const ids = productos.map((p) => p.id);

    const resultadoPrediccion = ids.length
      ? await prediccionService.predecirProductos(
          ids,
          { horizonte: dias }
        )
      : { resultados: [] };

    const predicciones = (
      resultadoPrediccion.resultados || []
    )
      .filter((p) => p.estado === 'ok')
      .map((p) => ({
        producto: p.producto?.nombre || '',
        demanda_estimada: p.demanda_estimada,
        tendencia: p.tendencia,
        confianza: p.confianza
      }));

    // 5. Obtener alertas vigentes
    const registrosAlertas = await Alerta.findAll({
      where: {
        estado: {
          [Op.in]: ['nueva', 'vista']
        }
      },
      order: [['fecha_creacion', 'DESC']]
    });

    const alertas = registrosAlertas.map((a) => ({
      tipo: a.tipo,
      severidad: a.severidad,
      mensaje: a.mensaje,
      estado: a.estado
    }));

    // 6. Comprobar si existen datos
    if (
      inventario.length === 0 &&
      predicciones.length === 0 &&
      alertas.length === 0
    ) {
      return res.status(404).json({
        error: 'No hay datos disponibles para exportar.'
      });
    }

    // 7. Preparar el periodo hacia atrás
    const datos = {
      periodo: obtenerPeriodoAnterior(dias),
      inventario,
      predicciones,
      alertas
    };

    // 8. Generar PDF o Excel
    const esPDF = formato === 'pdf';

    const archivo = esPDF
      ? await generarPDF(datos)
      : generarExcel(datos);

    const nombre = esPDF
      ? 'reporte-stockia.pdf'
      : 'reporte-stockia.xlsx';

    // 9. Configurar la respuesta de descarga
    res.setHeader(
      'Content-Type',
      esPDF
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombre}"`
    );

    res.setHeader('Cache-Control', 'no-store');

    return res.send(archivo);

  } catch (error) {
    next(error);
  }
};

module.exports = { exportarReporte };
