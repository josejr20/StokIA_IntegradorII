const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function run() {
  try {
    const [resultados] = await sequelize.query(`
      UPDATE lotes l
      SET fecha_vencimiento = (l.fecha_ingreso::date) + (p.vida_util_dias * interval '1 day')
      FROM productos p
      WHERE l.producto_id = p.id
        AND l.fecha_vencimiento IS NULL
        AND p.vida_util_dias IS NOT NULL
        AND p.vida_util_dias > 0
        AND EXISTS (
          SELECT 1
          FROM movimientos_inventario m
          WHERE m.lote_id = l.id
            AND m.tipo = 'ingreso'
        )
      RETURNING l.id, l.numero_lote, l.fecha_vencimiento
    `, { type: QueryTypes.SELECT });
    console.log('actualizados:', resultados.length);
    console.log(resultados);
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await sequelize.close();
  }
}

run();
