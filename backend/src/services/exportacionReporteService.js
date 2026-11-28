
'use strict';

const PDFDocument = require('pdfkit');
const XLSX = require('xlsx-js-style');

const COLORES = {
  verde: '153E2C',
  verdeClaro: 'E7F1EB',
  texto: '1D2935',
  gris: '62717D',
  borde: 'DCE6E0',
  alterno: 'F5F9F6',
  blanco: 'FFFFFF'
};

const SECCIONES = [
  {
    nombre: 'Inventario',
    clave: 'inventario',
    columnas: [
      ['codigo', 'Código'],
      ['nombre', 'Producto'],
      ['categoria', 'Categoría'],
      ['stock_total', 'Stock total'],
      ['activo', 'Activo']
    ],
    anchosExcel: [21, 54, 28, 18, 15],
    proporcionesPDF: [0.17, 0.33, 0.20, 0.17, 0.13]
  },
  {
    nombre: 'Predicciones',
    clave: 'predicciones',
    columnas: [
      ['producto', 'Producto'],
      ['demanda_estimada', 'Demanda estimada'],
      ['tendencia', 'Tendencia'],
      ['confianza', 'Confianza']
    ],
    anchosExcel: [54, 24, 22, 20],
    proporcionesPDF: [0.42, 0.23, 0.18, 0.17]
  },
  {
    nombre: 'Alertas',
    clave: 'alertas',
    columnas: [
      ['tipo', 'Tipo'],
      ['severidad', 'Prioridad'],
      ['mensaje', 'Mensaje'],
      ['estado', 'Estado']
    ],
    anchosExcel: [27, 19, 72, 20],
    proporcionesPDF: [0.19, 0.16, 0.49, 0.16]
  }
];

function convertirValor(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : '';
  }
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function valorSeguroExcel(valor) {
  const dato = convertirValor(valor);

  if (
    typeof dato === 'string' &&
    /^\s*[=+\-@\t\r]/.test(dato)
  ) {
    return "'" + dato;
  }

  return dato;
}

function registrosDe(datos, clave) {
  return Array.isArray(datos?.[clave]) ? datos[clave] : [];
}

// El controlador envía un rango de referencia hacia atrás.
// Ese rango NO representa ventas históricas en este reporte:
// el inventario y las alertas son actuales, y la predicción es futura.
function obtenerInformacionTemporal(datos) {
  const periodo = datos?.periodo || {};
  const desde = String(periodo.desde || '');
  const hasta = String(periodo.hasta || '');
  const patronFecha = /^\d{4}-\d{2}-\d{2}$/;

  const fechaCorte = patronFecha.test(hasta)
    ? hasta
    : 'No indicada';

  let dias = null;

  if (patronFecha.test(desde) && patronFecha.test(hasta)) {
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    const fin = Date.parse(`${hasta}T00:00:00Z`);
    const diferencia = (fin - inicio) / 86400000;

    if (Number.isInteger(diferencia) && diferencia > 0) {
      dias = diferencia;
    }
  }

  return {
    fechaCorte,
    horizonte: dias
      ? `Próximos ${dias} días`
      : 'No indicado',
    detalle: 'Inventario actual, predicciones futuras y alertas vigentes'
  };
}

function estiloCelda(esEncabezado, esAlterna, campo) {
  const estilo = {
    font: {
      name: 'Arial',
      sz: esEncabezado ? 11 : 10,
      bold: esEncabezado,
      color: {
        rgb: esEncabezado ? COLORES.blanco : COLORES.texto
      }
    },
    fill: {
      patternType: 'solid',
      fgColor: {
        rgb: esEncabezado
          ? COLORES.verde
          : (esAlterna ? COLORES.alterno : COLORES.blanco)
      }
    },
    alignment: {
      vertical: 'center',
      horizontal: esEncabezado
        ? 'center'
        : (
            campo === 'stock_total' ||
            campo === 'demanda_estimada'
              ? 'right'
              : 'left'
          ),
      wrapText: true
    },
    border: {
      bottom: {
        style: 'thin',
        color: { rgb: COLORES.borde }
      }
    }
  };

  if (!esEncabezado && campo === 'demanda_estimada') {
    estilo.numFmt = '0.00';
  }

  if (!esEncabezado && campo === 'stock_total') {
    estilo.numFmt = '0';
  }

  return estilo;
}

function agregarHojaInformacion(libro, datos) {
  const info = obtenerInformacionTemporal(datos);

  const filas = [
    ['STOCKIA | INFORMACIÓN DEL REPORTE', ''],
    ['Fecha de consulta (Perú)', info.fechaCorte],
    ['Inventario', 'Existencias actuales al momento de generar el reporte'],
    ['Predicciones', `Demanda estimada para los ${info.horizonte.toLowerCase()}`],
    ['Alertas', 'Alertas vigentes al momento de generar el reporte'],
    ['Importante', 'Las predicciones son futuras, no ventas históricas.'],
    ['', ''],
    ['REGISTROS INCLUIDOS', 'Cantidad'],
    ['Inventario', registrosDe(datos, 'inventario').length],
    ['Predicciones', registrosDe(datos, 'predicciones').length],
    ['Alertas', registrosDe(datos, 'alertas').length]
  ];

  const hoja = XLSX.utils.aoa_to_sheet(filas);

  hoja['!cols'] = [{ wch: 34 }, { wch: 75 }];
  hoja['!rows'] = filas.map((_, indice) => ({
    hpt: indice === 0 ? 34 : (indice === 5 ? 42 : 28)
  }));
  hoja['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
  ];

  for (let fila = 0; fila < filas.length; fila += 1) {
    for (let columna = 0; columna < 2; columna += 1) {
      const referencia = XLSX.utils.encode_cell({ r: fila, c: columna });
      const celda = hoja[referencia];
      if (!celda) continue;

      const esTitulo = fila === 0 || fila === 7;
      const esEtiqueta = columna === 0;

      celda.s = {
        font: {
          name: 'Arial',
          sz: esTitulo ? 12 : 10,
          bold: esTitulo || esEtiqueta,
          color: {
            rgb: esTitulo ? COLORES.blanco : COLORES.texto
          }
        },
        fill: {
          patternType: 'solid',
          fgColor: {
            rgb: esTitulo
              ? COLORES.verde
              : (fila % 2 === 0 ? COLORES.verdeClaro : COLORES.blanco)
          }
        },
        alignment: {
          vertical: 'center',
          horizontal: 'left',
          wrapText: true
        },
        border: {
          bottom: {
            style: 'thin',
            color: { rgb: COLORES.borde }
          }
        }
      };
    }
  }

  XLSX.utils.book_append_sheet(libro, hoja, 'Información');
}

function generarExcel(datos) {
  const libro = XLSX.utils.book_new();

  for (const seccion of SECCIONES) {
    const registros = registrosDe(datos, seccion.clave);

    const filas = [
      seccion.columnas.map(([, titulo]) => titulo)
    ];

    if (!registros.length) {
      filas.push([
        'No hay datos disponibles para esta sección.'
      ]);
    } else {
      for (const registro of registros) {
        filas.push(
          seccion.columnas.map(([campo]) =>
            valorSeguroExcel(registro?.[campo])
          )
        );
      }
    }

    const hoja = XLSX.utils.aoa_to_sheet(filas);

    hoja['!cols'] = seccion.anchosExcel.map((wch) => ({
      wch
    }));

    hoja['!rows'] = filas.map((fila, indice) => {
      if (indice === 0) return { hpt: 33 };

      const largo = Math.max(
        ...fila.map((valor) => String(valor ?? '').length)
      );

      return {
        hpt: Math.min(
          70,
          Math.max(25, 18 + Math.floor(largo / 55) * 15)
        )
      };
    });

    if (!registros.length) {
      hoja['!merges'] = [
        {
          s: { r: 1, c: 0 },
          e: {
            r: 1,
            c: seccion.columnas.length - 1
          }
        }
      ];
    } else {
      hoja['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: {
            r: registros.length,
            c: seccion.columnas.length - 1
          }
        })
      };
    }

    for (let fila = 0; fila < filas.length; fila += 1) {
      const columnas = fila === 1 && !registros.length
        ? 1
        : seccion.columnas.length;

      for (
        let columna = 0;
        columna < columnas;
        columna += 1
      ) {
        const referencia = XLSX.utils.encode_cell({
          r: fila,
          c: columna
        });

        if (!hoja[referencia]) continue;

        const campo = seccion.columnas[columna]?.[0];

        hoja[referencia].s = estiloCelda(
          fila === 0,
          fila % 2 === 0,
          campo
        );
      }
    }

    XLSX.utils.book_append_sheet(
      libro,
      hoja,
      seccion.nombre
    );
  }

  // La hoja adicional explica el periodo sin alterar las tres
  // hojas existentes ni sus filtros y encabezados.
  agregarHojaInformacion(libro, datos);

  return XLSX.write(libro, {
    bookType: 'xlsx',
    type: 'buffer'
  });
}

function encabezadoPDF(pdf) {
  const anchoPagina = pdf.page.width;

  pdf.rect(
    0,
    0,
    anchoPagina,
    75
  ).fill('#' + COLORES.verde);

  pdf
    .fillColor('#' + COLORES.blanco)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(
      'STOCKIA  |  REPORTE GENERAL',
      42,
      20,
      { width: anchoPagina - 84 }
    );

  pdf
    .font('Helvetica')
    .fontSize(9)
    .text(
      'Inventario, predicciones y alertas vigentes',
      42,
      46,
      { width: anchoPagina - 84 }
    );

  pdf.x = 42;
  pdf.y = 98;
}

function nuevaPagina(pdf) {
  pdf.addPage();
  encabezadoPDF(pdf);
}

function asegurarEspacio(pdf, alto) {
  if (pdf.y + alto > pdf.page.height - 92) {
    nuevaPagina(pdf);
  }
}

function dibujarEncabezadoTabla(pdf, seccion, anchos) {
  const y = pdf.y;
  let x = 42;
  const alto = 27;

  pdf
    .rect(
      x,
      y,
      anchos.reduce((a, b) => a + b, 0),
      alto
    )
    .fill('#' + COLORES.verdeClaro);

  seccion.columnas.forEach(([, titulo], indice) => {
    pdf
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#' + COLORES.verde)
      .text(
        titulo,
        x + 7,
        y + 7,
        {
          width: anchos[indice] - 14,
          height: 18,
          ellipsis: true
        }
      );

    x += anchos[indice];
  });

  pdf.y = y + alto;
}

function dibujarFilaPDF(
  pdf,
  seccion,
  registro,
  anchos,
  indice
) {
  const valores = seccion.columnas.map(([campo]) =>
    String(convertirValor(registro?.[campo]))
  );

  pdf.font('Helvetica').fontSize(8);

  const alturas = valores.map((valor, columna) =>
    pdf.heightOfString(
      valor || ' ',
      {
        width: anchos[columna] - 14,
        lineGap: 1
      }
    )
  );

  const alto = Math.max(
    29,
    Math.min(190, Math.max(...alturas) + 15)
  );

  if (pdf.y + alto > pdf.page.height - 92) {
    nuevaPagina(pdf);

    pdf
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#' + COLORES.verde)
      .text(
        `${seccion.nombre} (continuación)`,
        42,
        pdf.y
      );

    pdf.y += 10;

    dibujarEncabezadoTabla(
      pdf,
      seccion,
      anchos
    );
  }

  const y = pdf.y;

  const total = anchos.reduce(
    (a, b) => a + b,
    0
  );

  pdf
    .rect(42, y, total, alto)
    .fill(
      '#' + (
        indice % 2
          ? COLORES.alterno
          : COLORES.blanco
      )
    );

  pdf
    .moveTo(42, y + alto)
    .lineTo(42 + total, y + alto)
    .lineWidth(0.5)
    .strokeColor('#' + COLORES.borde)
    .stroke();

  let x = 42;

  valores.forEach((valor, columna) => {
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#' + COLORES.texto)
      .text(
        valor,
        x + 7,
        y + 7,
        {
          width: anchos[columna] - 14,
          height: alto - 12,
          ellipsis: true,
          lineGap: 1
        }
      );

    x += anchos[columna];
  });

  pdf.y = y + alto;
}

function dibujarSeccionPDF(pdf, seccion, datos) {
  const registros = registrosDe(
    datos,
    seccion.clave
  );

  asegurarEspacio(pdf, 92);

  pdf
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#' + COLORES.verde)
    .text(
      `${seccion.nombre} (${registros.length})`,
      42,
      pdf.y,
      { width: pdf.page.width - 84 }
    );

  pdf.y += 12;

  const disponible = pdf.page.width - 84;

  const anchos = seccion.proporcionesPDF.map(
    (peso) => disponible * peso
  );

  dibujarEncabezadoTabla(
    pdf,
    seccion,
    anchos
  );

  if (!registros.length) {
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#' + COLORES.gris)
      .text(
        'No hay datos disponibles para esta sección.',
        50,
        pdf.y + 9,
        { width: disponible - 16 }
      );

    pdf.y += 24;
  } else {
    registros.forEach((registro, indice) => {
      dibujarFilaPDF(
        pdf,
        seccion,
        registro,
        anchos,
        indice
      );
    });
  }

  pdf.y += 26;
}

function generarPDF(datos) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margin: 42,
      bufferPages: true,
      info: {
        Title: 'StockIA - Reporte general',
        Author: 'StockIA'
      }
    });

    const partes = [];

    pdf.on('data', (parte) => {
      partes.push(parte);
    });

    pdf.on('error', reject);

    pdf.on('end', () => {
      resolve(Buffer.concat(partes));
    });

    try {
      encabezadoPDF(pdf);

      const info = obtenerInformacionTemporal(datos);

      pdf
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#' + COLORES.gris)
        .text(
          `Fecha de consulta (Perú): ${info.fechaCorte}`,
          42,
          pdf.y,
          { width: pdf.page.width - 84 }
        );

      pdf.moveDown(0.5);

      pdf
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#' + COLORES.verde)
        .text(
          `Horizonte de predicción: ${info.horizonte}`,
          42,
          pdf.y,
          { width: pdf.page.width - 84 }
        );

      pdf.moveDown(0.4);

      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#' + COLORES.gris)
        .text(
          info.detalle,
          42,
          pdf.y,
          { width: pdf.page.width - 84 }
        );

      pdf.y += 16;

      const resumen = SECCIONES.map((seccion) =>
        `${seccion.nombre}: ${
          registrosDe(datos, seccion.clave).length
        }`
      ).join('    |    ');

      pdf
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#' + COLORES.texto)
        .text(
          resumen,
          42,
          pdf.y,
          { width: pdf.page.width - 84 }
        );

      pdf.y += 28;

      for (const seccion of SECCIONES) {
        dibujarSeccionPDF(
          pdf,
          seccion,
          datos
        );
      }

      const paginas = pdf.bufferedPageRange();

      for (
        let indice = paginas.start;
        indice < paginas.start + paginas.count;
        indice += 1
      ) {
        pdf.switchToPage(indice);

        const pieY = pdf.page.height - 65;

        pdf
          .moveTo(42, pieY - 10)
          .lineTo(pdf.page.width - 42, pieY - 10)
          .lineWidth(0.5)
          .strokeColor('#' + COLORES.borde)
          .stroke();

        pdf
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#' + COLORES.gris)
          .text(
            'StockIA | Reporte de información',
            42,
            pieY,
            { width: pdf.page.width - 84 }
          );

        pdf.text(
          `Página ${
            indice - paginas.start + 1
          } de ${paginas.count}`,
          42,
          pieY,
          {
            width: pdf.page.width - 84,
            align: 'right'
          }
        );
      }

      pdf.end();

    } catch (error) {
      pdf.destroy();
      reject(error);
    }
  });
}

module.exports = {
  generarPDF,
  generarExcel
};
