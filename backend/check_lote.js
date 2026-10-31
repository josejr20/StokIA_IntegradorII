const { sequelize } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function run() {
  try {
    const lote = await sequelize.query(`SELECT * FROM lotes WHERE id = 3613`, { type: QueryTypes.SELECT });
    console.log(JSON.stringify(lote));
    if (lote[0]) {
      const prod = await sequelize.query(`SELECT id, codigo, nombre, vida_util_dias FROM productos WHERE id = ${lote[0].producto_id}`, { type: QueryTypes.SELECT });
      console.log('PROD:' + JSON.stringify(prod));
    }
    const movs = await sequelize.query(`SELECT * FROM movimientos_inventario WHERE lote_id = 3613`, { type: QueryTypes.SELECT });
    console.log('MOVS:' + JSON.stringify(movs));
  } catch (e) {
    console.error('ERR:' + e.message);
  } finally {
    await sequelize.close();
  }
}

run();
