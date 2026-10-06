-- =========================================================
-- Carga inicial de stock
-- =========================================================
-- Toma el stock_actual de catalogo_presentaciones_Correcciones.xlsx
-- y lo sube como el primer lote de cada producto, registrado como
-- ingreso inicial en el kardex.
--
-- El match es por codigo (P-001 ... P-104), la clave que genero la
-- importacion masiva de productos.
--
-- Seguro para re-ejecutar: los productos que ya tengan un lote se
-- ignoran, asi que no duplica el stock.
--
-- El Excel no trae costo (solo precio de venta), por eso el kardex
-- arranca con precio_unitario 0. Para valorizar el inventario hay
-- que cargar el costo por separado.
-- =========================================================

BEGIN;

WITH stock AS (
  SELECT * FROM (VALUES
    ('P-001', 55),
    ('P-002', 185),
    ('P-003', 52),
    ('P-004', 93),
    ('P-005', 50),
    ('P-006', 50),
    ('P-007', 50),
    ('P-008', 130),
    ('P-009', 255),
    ('P-010', 150),
    ('P-011', 92),
    ('P-012', 93),
    ('P-013', 79),
    ('P-014', 50),
    ('P-015', 50),
    ('P-016', 249),
    ('P-017', 50),
    ('P-018', 52),
    ('P-019', 50),
    ('P-020', 290),
    ('P-021', 264),
    ('P-022', 150),
    ('P-023', 50),
    ('P-024', 50),
    ('P-025', 157),
    ('P-026', 79),
    ('P-027', 54),
    ('P-028', 62),
    ('P-029', 66),
    ('P-030', 57),
    ('P-031', 63),
    ('P-032', 57),
    ('P-033', 252),
    ('P-034', 112),
    ('P-035', 50),
    ('P-036', 97),
    ('P-037', 88),
    ('P-038', 96),
    ('P-039', 76),
    ('P-040', 50),
    ('P-041', 50),
    ('P-042', 52.5),
    ('P-043', 62),
    ('P-044', 50),
    ('P-045', 53.5),
    ('P-046', 50),
    ('P-047', 50),
    ('P-048', 56.5),
    ('P-049', 50),
    ('P-050', 50),
    ('P-051', 50),
    ('P-052', 50),
    ('P-053', 345.5),
    ('P-054', 82),
    ('P-055', 105),
    ('P-056', 50),
    ('P-057', 139),
    ('P-058', 201.5),
    ('P-059', 74),
    ('P-060', 50),
    ('P-061', 50),
    ('P-062', 107),
    ('P-063', 50),
    ('P-064', 143),
    ('P-065', 73),
    ('P-066', 147.5),
    ('P-067', 50),
    ('P-068', 131),
    ('P-069', 178.5),
    ('P-070', 86),
    ('P-071', 50),
    ('P-072', 60),
    ('P-073', 50),
    ('P-074', 50),
    ('P-075', 79.5),
    ('P-076', 84),
    ('P-077', 453.5),
    ('P-078', 50),
    ('P-079', 72),
    ('P-080', 81.5),
    ('P-081', 204),
    ('P-082', 50),
    ('P-083', 56),
    ('P-084', 50),
    ('P-085', 60),
    ('P-086', 50),
    ('P-087', 683),
    ('P-088', 50),
    ('P-089', 113),
    ('P-090', 50),
    ('P-091', 599),
    ('P-092', 472),
    ('P-093', 50),
    ('P-094', 72),
    ('P-095', 50),
    ('P-096', 957),
    ('P-097', 55),
    ('P-098', 53),
    ('P-099', 551),
    ('P-100', 310),
    ('P-101', 50),
    ('P-102', 187),
    ('P-103', 50),
    ('P-104', 138)
  ) AS t(codigo, cantidad)
),
nuevos_lotes AS (
  INSERT INTO lotes
    (producto_id, numero_lote, cantidad_inicial, cantidad_actual,
     fecha_ingreso, fecha_creacion)
  SELECT p.id, 'LT-000001', s.cantidad, s.cantidad, CURRENT_DATE, CURRENT_DATE
  FROM productos p
  JOIN stock s ON p.codigo = s.codigo
  WHERE NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id)
  RETURNING id, producto_id, cantidad_actual
)
INSERT INTO movimientos_inventario
  (lote_id, tipo, origen, cantidad, precio_unitario, precio_total,
   saldo_cantidad, saldo_precio_unitario, saldo_valorizado,
   motivo, usuario_id, fecha)
SELECT id, 'ingreso', 'inicial', cantidad_actual, 0, 0, cantidad_actual, 0, 0,
       'Ingreso inicial del lote', NULL, CURRENT_TIMESTAMP
FROM nuevos_lotes;

COMMIT;
