/**
 * Configuración de campos dinámicos por familia (categoría).
 *
 * Extraído del análisis detallado del Excel `catalogo_presentaciones.xlsx`
 * (349 registros, 25 familias). Cada familia define:
 *  - fields: lista de campos a renderizar
 *  - toggles: checkboxes que activan sub-secciones anidadas (Tapa, Obsequio)
 *
 * Las familias con toggle "tapa" incluyen campos con keys prefixados `tapa_`
 * que se muestran solo cuando el checkbox está activado. La marca del tapa
 * se auto-completa desde la marca del producto principal.
 *
 * El nombre comercial se reconstruye concatenando:
 *   <tipo> <capacidad/medida> <material> <color> <marca> X<cant> <und> /<empaque> X<cant_emp> <und_emp> +TAPA ...
 */

export type FieldType = 'number' | 'select' | 'text'

export interface FamilyField {
  /** Clave única del campo dentro de caracteristicas */
  key: string
  /** Etiqueta mostrada en el formulario */
  label: string
  /** Tipo de input */
  type: FieldType
  /** Opciones para type="select" */
  options?: readonly string[]
  /** Si el campo pertenece a una sub-sección anidada (tapa, obsequio) */
  group?: string
  /** Si el campo es opcional */
  optional?: boolean
}

export interface FamilyToggle {
  /** Clave del checkbox (ej. 'tapa_activo') */
  key: string
  /** Label del checkbox */
  label: string
  /** Nombre del grupo a mostrar/ocultar (ej. 'tapa') */
  group: string
}

export interface FamilyConfig {
  fields: FamilyField[]
  toggles?: FamilyToggle[]
}

/** Opciones globales extraídas del Excel (lenguaje comercial de la empresa) */
export const GLOBAL_OPTIONS = {
  unidad_contenido: ['GR', 'KG', 'LT', 'ML', 'OZ', 'G', 'GSM', 'HOJA', 'HOJAS', 'CM', 'IN', 'YARDAS', 'KILOS'],
  material: ['PP', 'PET', 'PS', 'ACRILICO', 'KRAF', 'KRAFT', 'POLIPAPEL', 'PLASTICO', 'POLYBOARD', 'FIBRA', 'CARTON', 'BAGAZO', 'P.E.', 'BIOFORM'],
  color: ['BLANCO', 'NEGRO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 'ROSADO', 'NARANJA', 'TRANSPARENTE', 'VERDE/BLANCO'],
  color_acabado: ['BL', 'TR', 'BLANCO', 'NEGRO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 'ROSADO', 'NARANJA', 'TRANSPARENTE', 'VERDE/BLANCO', 'C/T', 'KRAFT'],
  etiqueta_color: ['ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'NARANJA'],
  unidad_cantidad: [
    'UND', 'UN', 'UNA', 'SOBRES', 'SOBRE', 'PAQ', 'PAQUETES', 'TIRA(S)', 'TIRA',
    'DISPLAY', 'PLANCHA', 'BAGAZO', 'CAJA', 'SACHET', 'BOLSAS', 'KILOS', 'HOJAS', 'HOJA',
    'YARDAS/CJ', 'PAREJAS', 'SOB', 'UND/CJ', 'UND/BLS', 'UND/FAR', 'UND/CAJA',
    'UND/CJ-BLS', 'UND/PLANCHA',
  ],
  empaque: ['FAR', 'FARD', 'CJ', 'BLS', 'SACO', 'CAJA', 'PAQ', 'PAQUETES', 'DISPLAY', 'PLANCHA', 'PLANCH', 'BAGAZO', 'BOLSA', 'CJ-BLS', 'BL', 'GRANEL'],
  unidad_empaque: ['PAQ', 'UND', 'SOBRES', 'BOLSAS', 'BAGAZO', 'CAJA', 'YARDAS', 'SQFT', 'PQT', 'HOJAS'],
  tipo_borde: ['S/T', 'C/T'],
  puntas: ['1 PUNTA', '2 PUNTAS'],
  divisiones: ['1 DIVISION', '2 DIVISIONES', '3 DIVISIONES'],
  color_tapa: ['TR', 'BL', 'BLANCO', 'NEGRO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 'ROSADO', 'NARANJA'],
} as const

/** Prefija todas las claves de un arreglo de campos (para secciones anidadas). */
function prefixFields(prefix: string, fields: FamilyField[]): FamilyField[] {
  return fields.map((f) => ({ ...f, key: `${prefix}_${f.key}` }))
}

/** Campos de presentación comunes a todas las familias. */
const PRESENTACION_BASE: FamilyField[] = [
  { key: 'cantidad', label: 'Cant. presentación', type: 'number' },
  { key: 'unidad_cantidad', label: 'Unidad', type: 'select', options: GLOBAL_OPTIONS.unidad_cantidad },
]

/** Campos de empaque mayor comunes. */
const EMPAQUE_BASE: FamilyField[] = [
  { key: 'empaque', label: 'Tipo de empaque', type: 'select', options: GLOBAL_OPTIONS.empaque },
  { key: 'cantidad_empaque', label: 'Cant. empaque mayor', type: 'number', optional: true },
  { key: 'unidad_empaque', label: 'Unidad empaque', type: 'select', options: GLOBAL_OPTIONS.unidad_empaque, optional: true },
]

/** Campos comunes de la sección "tapa" (prefijados con tapa_). */
const TAPA_COMUN_FIELDS: FamilyField[] = [
  ...prefixFields('tapa', PRESENTACION_BASE),
  ...prefixFields('tapa', EMPAQUE_BASE),
  { key: 'tapa_material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
  { key: 'tapa_color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_tapa },
  { key: 'tapa_marca', label: 'Marca (automática)', type: 'text' },
  { key: 'tapa_tipo', label: 'Tipo de tapa', type: 'text', optional: true },
  { key: 'tapa_capacidad', label: 'Capacidad', type: 'number', optional: true },
  { key: 'tapa_unidad_contenido', label: 'Unidad de capacidad', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido, optional: true },
  { key: 'tapa_medida', label: 'Medida / Tamaño', type: 'text', optional: true },
]

/** Campos comunes de la sección "obsequio" (prefijados con obsequio_). */
const OBSEQUIO_FIELDS: FamilyField[] = [
  { key: 'obsequio_producto', label: 'Producto obsequio', type: 'select', options: ['VINAGRE TINTO', 'VINAGRE', 'BOTELLA', 'SACHET', 'BOT', 'OTRO'] },
  { key: 'obsequio_cantidad', label: 'Cant. obsequio', type: 'number' },
  { key: 'obsequio_presentacion', label: 'Presentación obsequio', type: 'text' },
]

/**
 * Definición de campos por familia.
 * La clave es el nombre exacto de la categoría tal como aparece en el Excel.
 */
export const FAMILY_FIELDS: Record<string, FamilyConfig> = {
  // ── 1. AJICEROS ── Cuerpo + tapa
  'AJICEROS': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['AJICERO'] },
      { key: 'onzas', label: 'Onzas', type: 'select', options: ['0.5 OZ', '1 OZ', '2 OZ', '3 OZ', '4 OZ', '8 OZ', '12 OZ'] },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_tapa },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      { key: 'tapa_onzas', label: 'Onzas (tapa)', type: 'select', options: ['0.5 OZ', '1 OZ', '2 OZ', '3 OZ'] },
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },

  // ── 2. BANDEJAS - ESTUCHES ──
  'BANDEJAS - ESTUCHES': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['BANDEJA', 'ESTUCHE', 'PB1', 'PB2', 'SALCHIFIRME'] },
      { key: 'modelo', label: 'Modelo / Número', type: 'text' },
      { key: 'dimension', label: 'Dimensión (L×A)', type: 'text' },
      { key: 'altura', label: 'Altura (H)', type: 'text', optional: true },
      { key: 'diametro', label: 'Diámetro (D)', type: 'text', optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 3. BOLSA ── Medida L×H o Capacidad (140 LT)
  'BOLSA': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['BOLSA'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text', optional: true },
      { key: 'capacidad', label: 'Capacidad (ej. 140 LT)', type: 'text', optional: true },
      { key: 'color', label: 'Color', type: 'select', options: [...GLOBAL_OPTIONS.color, 'VERDE/BLANCO'] },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 4. CELOFAN ──
  'CELOFAN': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['CELOFAN'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text' },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color, optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 5. CHEQUERA ──
  'CHEQUERA': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['C/T', 'S/T'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text' },
      { key: 'color', label: 'Color', type: 'select', options: [...GLOBAL_OPTIONS.color, 'VERDE/BLANCO'] },
      { key: 'diseño', label: 'Diseño / Temporada', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 6. CINTAS ── EMBALAJE vs FILM
  'CINTAS': {
    fields: [
      { key: 'tipo', label: 'Tipo de cinta', type: 'select', options: ['EMBALAJE', 'FILM'] },
      { key: 'ancho', label: 'Ancho', type: 'text', optional: true },
      { key: 'longitud', label: 'Longitud', type: 'text' },
      { key: 'unidad_longitud', label: 'Unidad de longitud', type: 'select', options: ['YARDAS', 'IN', 'CM', 'M', 'SQFT'], optional: true },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color, optional: true },
      { key: 'equivalencia', label: 'Equivalencia (ej. 30.4 CM × 30.4 M)', type: 'text', optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material, optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 7. CONDIMENTOS ── Simple, sin cantidades ni empaques
  'CONDIMENTOS': {
    fields: [
      { key: 'tipo', label: 'Tipo de producto', type: 'select', options: ['COMINO', 'PIMIENTA', 'ROMERO'] },
      { key: 'presentacion', label: 'Presentación', type: 'select', options: ['A GRANEL'] },
    ],
  },

  // ── 8. CONOS ──
  'CONOS': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['MULTIUSO', 'P.E', 'ROCA', 'LUZ'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text' },
      { key: 'material', label: 'Material', type: 'select', options: [...GLOBAL_OPTIONS.material, 'P.E.'] },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 9. CONTENEDORES TERMICOS ── Complejo + tapa
  'CONTENEDORES TERMICOS': {
    fields: [
      { key: 'tipo', label: 'Tipo / Modelo', type: 'select', options: ['CONTENEDOR', 'CT1', 'CT3', 'CT4', 'CT5'] },
      { key: 'capacidad', label: 'Capacidad', type: 'number' },
      { key: 'unidad_contenido', label: 'Unidad de capacidad', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido },
      { key: 'divisiones', label: 'Divisiones', type: 'select', options: GLOBAL_OPTIONS.divisiones, optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'caracteristica', label: 'Característica', type: 'select', options: ['BIODEGRADABLE', 'REUTILIZABLE'], optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },

  // ── 10. CRISTAL ──
  'CRISTAL': {
    fields: [
      { key: 'tipo', label: 'Tipo / Modelo', type: 'select', options: ['CRISTAL', 'ENV. ROJO', 'ENV. AZUL', 'ENV. VERDE'], optional: true },
      { key: 'medida', label: 'Medida (L×H)', type: 'text', optional: true },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color, optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 11. CUCHARAS ──
  'CUCHARAS': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['CUCHARAS', 'OBSEQUIO-PORTACUBIERTOS'] },
      { key: 'numero', label: 'Número', type: 'select', options: ['N° 04', 'N° 05', 'N° 06', 'N° 10'] },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'etiqueta_color', label: 'Color etiqueta', type: 'select', options: [...GLOBAL_OPTIONS.etiqueta_color, 'Sin etiqueta'], optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 12. DARNEL ── + tapa
  'DARNEL': {
    fields: [
      { key: 'tipo', label: 'Tipo de producto', type: 'select', options: ['COPA VENECIANA', 'ENVASE BISAGRA', 'ENVASE DELI', 'ENVASE HELADO', 'TAPA DOMO'] },
      { key: 'capacidad', label: 'Capacidad / Contenido', type: 'number', optional: true },
      { key: 'unidad_contenido', label: 'Unidad de contenido', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido, optional: true },
      { key: 'medida', label: 'Medida', type: 'text', optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'accesorios', label: 'Accesorios', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },

  // ── 13. ENVASE BISAGRA/BASE DUPLO/DOMO ── + tapa
  'ENVASE BISAGRA/BASE DUPLO/DOMO': {
    fields: [
      { key: 'tipo', label: 'Tipo de envase', type: 'select', options: ['ENVASE BISAGRA', 'ENVASE CLAMSHELL', 'ENVASE DELI', 'ENVASE DELI BISAGRA', 'ENVASE HELADO', 'TAPA DOMO', 'KIT POLLERO'] },
      { key: 'capacidad', label: 'Capacidad / Contenido', type: 'number' },
      { key: 'unidad_contenido', label: 'Unidad de contenido', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido },
      { key: 'dimension', label: 'Dimensión / Medida', type: 'text', optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'tipo_cierre', label: 'Tipo de cierre', type: 'select', options: ['BISAGRA', 'DOMO', 'S/T'], optional: true },
      { key: 'accesorios', label: 'Accesorios', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },

  // ── 14. ESPECERIAS-AJINOMOTO ──
  'ESPECERIAS-AJINOMOTO': {
    fields: [
      { key: 'tipo', label: 'Producto / Línea', type: 'select', options: ['AJI-NO-MEN', 'AJI-NO-MIX', 'AJI-NO-MOTO', 'AJI-NO-SILLAO', 'GLUTAMATO MONOSÍDICO', 'GMS MAX SABOR', 'BONIFICACION', 'CHUÑO', 'KETCHUP', 'MAYONESA', 'MOSTAZA', 'VINAGRE', 'OBSEQUIO'] },
      { key: 'subtipo', label: 'Sabor / Presentación', type: 'text', optional: true },
      { key: 'contenido', label: 'Contenido', type: 'number' },
      { key: 'unidad_contenido', label: 'Unidad de contenido', type: 'select', options: ['GR', 'KG', 'ML', 'LT'] },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 15. LIGAS-SORBETES-ESPONJA ── 3 tipos
  'LIGAS-SORBETES-ESPONJA': {
    fields: [
      { key: 'tipo', label: 'Tipo de producto', type: 'select', options: ['LIGAS', 'SORBETE', 'SOPORTE DECORATIVO', 'ESPONJA'] },
      { key: 'caracteristica', label: 'Característica', type: 'select', options: ['FLEXIBLE', 'CLINICO', 'COMPOSTABLE'], optional: true },
      { key: 'color', label: 'Color', type: 'select', options: ['BLANCO', 'NEGRO', 'COLORES'], optional: true },
      { key: 'peso', label: 'Peso', type: 'number', optional: true },
      { key: 'unidad_peso', label: 'Unidad de peso', type: 'select', options: ['LIBRA', 'KILOS'], optional: true },
      { key: 'medida', label: 'Medida (L×A)', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 16. MONDADIENTES PICADOR ──
  'MONDADIENTES PICADOR': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['MONDADIENTE'] },
      { key: 'material', label: 'Material', type: 'select', options: ['MADERA', 'MADERA NATURAL'] },
      { key: 'puntas', label: 'Puntas', type: 'select', options: GLOBAL_OPTIONS.puntas },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 17. PAPEL ── 3 tipos
  'PAPEL': {
    fields: [
      { key: 'tipo', label: 'Tipo de papel', type: 'select', options: ['PAPEL ALUMINIO', 'PAPEL CORTADO', 'PAPEL HIGIÉNICO'] },
      { key: 'ancho', label: 'Ancho', type: 'text', optional: true },
      { key: 'formato', label: 'Tamaño / Formato', type: 'text', optional: true },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color, optional: true },
      { key: 'numero_hojas', label: 'Número de hojas / unidad', type: 'number', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 18. PLATOS TECKNOPOR - PISOS ──
  'PLATOS TECKNOPOR - PISOS': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['PLATO', 'PLATO HONDO', 'PISO DE TORTA', 'CHAROLA', 'BOMBAONERA'] },
      { key: 'numero', label: 'Número / Modelo', type: 'text', optional: true },
      { key: 'capacidad', label: 'Capacidad', type: 'number', optional: true },
      { key: 'unidad_contenido', label: 'Unidad de capacidad', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido, optional: true },
      { key: 'dimension', label: 'Dimensión (L×A)', type: 'text', optional: true },
      { key: 'diametro', label: 'Diámetro', type: 'text', optional: true },
      { key: 'divisiones', label: 'Divisiones', type: 'select', options: GLOBAL_OPTIONS.divisiones, optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'diseno', label: 'Diseño', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 19. SANGUCHERA ──
  'SANGUCHERA': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['C/T', 'S/T'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text' },
      { key: 'color', label: 'Color', type: 'select', options: ['BLANCO'] },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 20. SERVILLENA ──
  'SERVILLENA': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['CORTADA', 'DOBLADA', 'ROLLO/FAR', 'UNA HOJA', 'SERVILLETERO'] },
      { key: 'subtipo', label: 'Subtipo', type: 'select', options: ['CORTADA', 'DOBLADA', 'ROLLO/FAR', 'UNA HOJA'], optional: true },
      { key: 'cantidad_hojas', label: 'Hojas por unidad', type: 'number' },
      { key: 'color', label: 'Color', type: 'select', options: ['BLANCO', 'VERDE', 'ROSADO'] },
      { key: 'etiqueta_color', label: 'Color etiqueta', type: 'select', options: GLOBAL_OPTIONS.etiqueta_color, optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 21. SIBARITA ── Complejo + obsequio
  'SIBARITA': {
    fields: [
      { key: 'producto', label: 'Producto', type: 'select', options: ['AJI', 'COMINO', 'OREGANO', 'PALILLO', 'PIMIENTA', 'SAZONADOR', 'TUCO TALLARIN', 'VINAGRE', 'VINAGRE TINTO', 'BOTELLA', 'SACHET', 'BOT'] },
      { key: 'presentacion', label: 'Presentación', type: 'select', options: ['ECON', 'GIG'] },
      { key: 'cantidad_sobres', label: 'Cant. de sobres', type: 'number' },
      { key: 'peso', label: 'Peso total / por presentación', type: 'number' },
      { key: 'unidad_peso', label: 'Unidad de peso', type: 'select', options: ['GR', 'KG', 'ML', 'LT'] },
      { key: 'cantidad_paquetes', label: 'Cant. de paquetes', type: 'number' },
      { key: 'cantidad_display', label: 'Cant. de display', type: 'number', optional: true },
      ...EMPAQUE_BASE,
      ...OBSEQUIO_FIELDS,
    ],
    toggles: [{ key: 'obsequio_activo', label: '¿Tiene obsequio?', group: 'obsequio' }],
  },

  // ── 22. TAPER-BOLWS ── Complejo + tapa
  'TAPER-BOLWS': {
    fields: [
      { key: 'tipo', label: 'Tipo de producto', type: 'select', options: ['AJICERO', 'BOMBONERA', 'BOWL', 'ENV CIRC'] },
      { key: 'capacidad', label: 'Capacidad', type: 'number' },
      { key: 'unidad_contenido', label: 'Unidad de capacidad', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido },
      { key: 'numero', label: 'Número / Modelo', type: 'text', optional: true },
      { key: 'medida', label: 'Medida / Altura', type: 'text', optional: true },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'tipo_cierre', label: 'Tipo de cierre', type: 'select', options: ['BISAGRA', 'DOMO'], optional: true },
      { key: 'diseno', label: 'Diseño', type: 'text', optional: true },
      { key: 'accesorios', label: 'Accesorios', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },

  // ── 23. TALONERAS ──
  'TALONERAS': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['TALONERA'] },
      { key: 'medida', label: 'Medida (L×H)', type: 'text' },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 24. TENEDORES ──
  'TENEDORES': {
    fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['TENEDOR', 'TENEDORES', 'OBSEQUIO-PORTACUBIERTOS'] },
      { key: 'numero', label: 'Número', type: 'select', options: ['N° 05', 'N° 06', 'N° 10'] },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color', label: 'Color', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'etiqueta_color', label: 'Color etiqueta', type: 'select', options: [...GLOBAL_OPTIONS.etiqueta_color, 'Sin etiqueta'], optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
    ],
  },

  // ── 25. VASOS - BOT ── Tipo selector + tapa
  'VASOS - BOT': {
    fields: [
      { key: 'tipo', label: 'Tipo de producto', type: 'select', options: ['VASO', 'BOTELLA', 'TAPA DOMO', 'TAPA'] },
      { key: 'capacidad', label: 'Capacidad', type: 'number' },
      { key: 'unidad_contenido', label: 'Unidad de capacidad', type: 'select', options: ['OZ', 'ML', 'GR', 'KG', 'LT'] },
      { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material },
      { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado },
      { key: 'tipo_vaso', label: 'Tipo de vaso', type: 'select', options: ['POLIPAPEL', 'PLÁSTICO', 'PAPEL', 'CARTÓN'], optional: true },
      { key: 'diseno', label: 'Diseño', type: 'text', optional: true },
      ...PRESENTACION_BASE,
      ...EMPAQUE_BASE,
      ...TAPA_COMUN_FIELDS,
    ],
    toggles: [{ key: 'tapa_activo', label: '¿Tiene tapa?', group: 'tapa' }],
  },
}

/** Campos base que siempre aparecen (no dependen de la familia). */
export const FAMILY_BASE_FIELDS: FamilyField[] = [
  { key: 'nombre', label: 'Nombre comercial', type: 'text' },
  { key: 'codigo', label: 'Código', type: 'text', optional: true },
  { key: 'precio_venta', label: 'Precio de venta (S/.)', type: 'number', optional: true },
  { key: 'descripcion', label: 'Descripción', type: 'text', optional: true },
]

/** Campos de fallback cuando la familia no está en FAMILY_FIELDS. */
export const DEFAULT_FAMILY_FIELDS: FamilyField[] = [
  { key: 'tipo', label: 'Tipo', type: 'select', options: [] },
  { key: 'capacidad', label: 'Capacidad / Contenido', type: 'number', optional: true },
  { key: 'unidad_contenido', label: 'Unidad de contenido', type: 'select', options: GLOBAL_OPTIONS.unidad_contenido, optional: true },
  { key: 'material', label: 'Material', type: 'select', options: GLOBAL_OPTIONS.material, optional: true },
  { key: 'color_acabado', label: 'Color / Acabado', type: 'select', options: GLOBAL_OPTIONS.color_acabado, optional: true },
  ...PRESENTACION_BASE,
  ...EMPAQUE_BASE,
]

/** Campos excluidos del render de familia (se manejan en sección común). */
export const CAMPO_EXCLUIR_DE_FAMILIA = ['nombre', 'codigo', 'precio_venta', 'descripcion'] as const

/** Devuelve la configuración (campos + toggles) para una familia dada. */
export function getFieldsForFamily(familia: string): FamilyConfig {
  return FAMILY_FIELDS[familia] ?? { fields: DEFAULT_FAMILY_FIELDS }
}

/** Devuelve los campos de un grupo específico (ej. 'tapa', 'obsequio'). */
export function getGroupFields(config: FamilyConfig, group: string): FamilyField[] {
  return config.fields.filter((f) => f.key.startsWith(`${group}_`))
}
