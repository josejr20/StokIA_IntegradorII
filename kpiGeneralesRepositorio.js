'use strict';

/**
 * US-34 · Consultas SQL de los KPIs generales. Solo lee datos; ningún cálculo de negocio.
 * `consultar(sql, replacements)` devuelve un arreglo de filas (se inyecta en las pruebas).
 *
 * Las fechas llegan como 'YYYY-MM-DD' (hora de Perú) y se convierten a instantes con -05:00.
 */

const inicioDeDia = (fecha) => `${fecha}T00:00:00-05:00`;

function crearRepositorio(consultar) {
  return {
    /** Primera fecha (Perú) con ventas o movimientos de inventario, o null si no hay datos. */
    async primerDato() {
      const [fila] = await consultar(`
        SELECT to_char(LEAST(
                 (SELECT MIN(fecha) FROM movimientos_inventario),
                 (SELECT MIN(fecha_venta) FROM ventas)
               ) AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS primero`);
      return fila?.primero ?? null;
    },

    /** Días distintos con ventas en [desde, hasta]. */
    async diasConVentas({ desde, hasta, finExclusivo }) {
      const [fila] = await consultar(`
        SELECT COUNT(DISTINCT (fecha_venta AT TIME ZONE 'America/Lima')::date) AS dias
          FROM ventas
         WHERE fecha_venta >= :ini AND fecha_venta < :fin AND cantidad > 0`,
      { ini: inicioDeDia(desde), fin: inicioDeDia(finExclusivo ?? hasta) });
      return Number(fila?.dias ?? 0);
    },

    /** Costo y unidades vendidas netas (ventas menos devoluciones/anulaciones) del kardex. */
    async ventasNetas({ desde, finExclusivo }) {
      const [fila] = await consultar(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo='salida'  AND origen='venta' THEN precio_total END),0)
        - COALESCE(SUM(CASE WHEN tipo='ingreso' AND origen IN ('devolucion','anulacion') THEN precio_total END),0) AS costo,
          COALESCE(SUM(CASE WHEN tipo='salida'  AND origen='venta' THEN cantidad END),0)
        - COALESCE(SUM(CASE WHEN tipo='ingreso' AND origen IN ('devolucion','anulacion') THEN cantidad END),0) AS unidades
          FROM movimientos_inventario
         WHERE fecha >= :ini AND fecha < :fin`,
      { ini: inicioDeDia(desde), fin: inicioDeDia(finExclusivo) });
      return { costo: Number(fila?.costo ?? 0), unidades: Number(fila?.unidades ?? 0) };
    },

    /**
     * Inventario total antes de `corte` (inicio de día). El kardex guarda un saldo corrido
     * por producto, así que se toma el último movimiento de cada producto anterior al corte.
     */
    async inventarioAl(corte) {
      const [fila] = await consultar(`
        SELECT COALESCE(SUM(s.saldo_valorizado),0) AS valor,
               COALESCE(SUM(s.saldo_cantidad),0)   AS unidades
          FROM (
            SELECT DISTINCT ON (l.producto_id) m.saldo_valorizado, m.saldo_cantidad
              FROM movimientos_inventario m
              JOIN lotes l ON l.id = m.lote_id
             WHERE m.fecha < :corte
             ORDER BY l.producto_id, m.fecha DESC, m.id DESC
          ) s`,
      { corte: inicioDeDia(corte) });
      return { valor: Number(fila?.valor ?? 0), unidades: Number(fila?.unidades ?? 0) };
    },

    /** Alertas de riesgo de vencimiento atendidas dentro del periodo. */
    alertasAtendidas({ desde, finExclusivo }) {
      return consultar(`
        SELECT id, lote_id, fecha_creacion, fecha_atendida, datos_origen
          FROM alertas
         WHERE tipo = 'riesgo_vencimiento' AND estado = 'atendida' AND lote_id IS NOT NULL
           AND fecha_atendida >= :ini AND fecha_atendida < :fin`,
      { ini: inicioDeDia(desde), fin: inicioDeDia(finExclusivo) });
    },

    async lotes(ids) {
      if (!ids.length) return [];
      return consultar(`SELECT id, to_char(fecha_vencimiento,'YYYY-MM-DD') AS fecha_vencimiento
                          FROM lotes WHERE id IN (:ids)`, { ids });
    },

    /** Salidas por venta de esos lotes desde `desdeInstante` (ISO). */
    async salidasPorVenta(ids, desdeInstante) {
      if (!ids.length) return [];
      return consultar(`
        SELECT lote_id, fecha, cantidad, precio_unitario
          FROM movimientos_inventario
         WHERE tipo = 'salida' AND origen = 'venta' AND lote_id IN (:ids) AND fecha >= :desde
         ORDER BY fecha, id`, { ids, desde: desdeInstante });
    },
  };
}

/** Repositorio real, atado a Sequelize (carga perezosa para no exigir BD en pruebas). */
function crearRepositorioSequelize() {
  const { sequelize } = require('../models');
  const { QueryTypes } = require('sequelize');
  return crearRepositorio((sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT }));
}

module.exports = { crearRepositorio, crearRepositorioSequelize };
