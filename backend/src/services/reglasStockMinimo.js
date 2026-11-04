'use strict';

const VALOR_DEFAULT = 10; // Solo si no hay una configuracion global ni variable de entorno.

class ErrorStockMinimo extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorStockMinimo';
    this.status = status;
  }
}

function validarStockMinimo(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw new ErrorStockMinimo('El stock minimo debe ser un numero positivo.');
  }
  const texto = String(valor).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) {
    throw new ErrorStockMinimo('Ingrese un numero positivo con hasta dos decimales.');
  }
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 99999999.99) {
    throw new ErrorStockMinimo('El stock minimo debe ser mayor a cero y no superar 99999999.99.');
  }
  return numero;
}

function minimoPredeterminado() {
  try {
    return validarStockMinimo(process.env.STOCK_MINIMO_PREDETERMINADO || VALOR_DEFAULT);
  } catch {
    return VALOR_DEFAULT;
  }
}

function evaluarStock(stockDisponible, minimo) {
  const disponible = Number(stockDisponible);
  const limite = validarStockMinimo(minimo);
  if (!Number.isFinite(disponible) || disponible < 0) {
    throw new ErrorStockMinimo('El stock disponible no es valido.');
  }
  const bajoStock = disponible < limite;
  return {
    stock_disponible: Number(disponible.toFixed(2)),
    stock_minimo: limite,
    bajo_stock: bajoStock,
    faltante: bajoStock ? Number((limite - disponible).toFixed(2)) : 0
  };
}

module.exports = { VALOR_DEFAULT, ErrorStockMinimo, validarStockMinimo, minimoPredeterminado, evaluarStock };
