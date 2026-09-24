const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const config = require('./index');

const routesDir = path.resolve(__dirname, '../routes');
const apiFiles = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.js'))
  .map(f => path.join(routesDir, f));

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'StockIA API',
      version: '1.0.0',
      description: 'API de gestión de inventario — Node.js + Express + Sequelize + PostgreSQL',
      contact: {
        name: 'StockIA Team'
      },
       license: {
        name: 'ISC'
      }
    },
    tags: [
      { name: 'Auth', description: 'Autenticación y gestión de tokens' },
      { name: 'Usuarios', description: 'Gestión de usuarios del sistema' },
      { name: 'Roles', description: 'Gestión de roles y permisos' },
      { name: 'Permisos', description: 'Gestión de permisos del sistema' },
      { name: 'Categorias', description: 'Gestión de categorías de productos' },
      { name: 'Productos', description: 'Gestión de productos e inventario' },
      { name: 'UnidadesMedida', description: 'Catálogo de unidades de medida' },
      { name: 'Presentaciones', description: 'Catálogo de presentaciones' },
      { name: 'CatalogoMarcas', description: 'Catálogo de marcas' },
      { name: 'CatalogoValores', description: 'Catálogo de valores (material, origen, etc.)' },
      { name: 'Lotes', description: 'Gestión de lotes y movimientos' },
      { name: 'Movimientos', description: 'Movimientos de inventario' },
      { name: 'Ventas', description: 'Gestión de ventas' },
      { name: 'ImportacionesVentas', description: 'Importación masiva de ventas' },
      { name: 'Umbrales', description: 'Configuración de umbrales de alerta' },
      { name: 'OrdenesReabastecimiento', description: 'Órdenes de reabastecimiento' },
      { name: 'Alertas', description: 'Sistema de alertas de inventario' },
      { name: 'Reportes', description: 'Generación de reportes y KPIs' },
      { name: 'Preferencias', description: 'Preferencias de usuario' },
      { name: 'Auditoria', description: 'Registros de auditoría' },
      { name: 'Precios', description: 'Historial de precios por producto' },
      { name: 'TiposEnvase', description: 'Catálogo de tipos de envase' },
      { name: 'ProductoPresentacion', description: 'Empaques de profundidad variable por producto' },
    ],
    servers: [
      {
        url: `http://localhost:${config.PORT || 3000}/api`,
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del endpoint POST /auth/login'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'No autorizado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        ForbiddenError: {
          description: 'Prohibido - Permisos insuficientes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        ErrorResponse: {
          description: 'Error de solicitud',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      },
      schemas: {
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Administrador' },
            email: { type: 'string', format: 'email', example: 'admin@stockia.local' },
            rol_id: { type: 'integer', example: 1 },
            activo: { type: 'boolean', example: true },
            fecha_creacion: { type: 'string', format: 'date-time', example: '2024-01-01T10:00:00Z' },
            is_staff: { type: 'boolean', example: false }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@stockia.local' },
            password: { type: 'string', format: 'password', example: 'admin123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            usuario: { $ref: '#/components/schemas/Usuario' },
            token: { type: 'string', description: 'JWT de acceso' },
            refreshToken: { type: 'string', description: 'JWT de refresco' }
          }
        },
        Categoria: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Bebidas' },
            descripcion: { type: 'string', example: 'Categoría de bebidas' },
            vida_util_dias: { type: 'integer', example: 365 },
            fecha_creacion: { type: 'string', format: 'date-time' }
          }
        },
        UnidadMedida: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Litro' },
            abreviatura: { type: 'string', example: 'L' },
            simbolo: { type: 'string', example: 'L' }
          }
        },
        Presentacion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Botella' },
            descripcion: { type: 'string', example: 'Botella de 1 litro' }
          }
        },
        CatalogoMarca: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Coca-Cola' }
          }
        },
        CatalogoValor: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            tipo: { type: 'string', example: 'material' },
            valor: { type: 'string', example: 'plastico' },
            etiqueta: { type: 'string', example: 'Plástico' }
          }
        },
        Producto: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            codigo: { type: 'string', example: 'PROD-001' },
            nombre: { type: 'string', example: 'Coca-Cola 1L' },
            categoria_id: { type: 'integer', nullable: true, example: 1 },
            categoria_nombre: { type: 'string', nullable: true, example: 'Bebidas' },
            categoria_vida_util_dias: { type: 'integer', nullable: true, example: 365 },
            unidad_medida_id: { type: 'integer', nullable: true, example: 1 },
            unidad_medida_nombre: { type: 'string', nullable: true, example: 'Litro' },
            unidad_medida_simbolo: { type: 'string', nullable: true, example: 'L' },
            presentacion_id: { type: 'integer', nullable: true, example: 1 },
            presentacion_nombre: { type: 'string', nullable: true, example: 'Botella' },
            marca_id: { type: 'integer', nullable: true, example: 1 },
            marca_nombre: { type: 'string', nullable: true, example: 'Coca-Cola' },
            contenido_valor: { type: 'number', format: 'decimal', nullable: true, example: 1000 },
            categoria_paquete_id: { type: 'integer', nullable: true, example: 8 },
            categoria_paquete_nombre: { type: 'string', nullable: true, example: 'UNIDAD' },
            contenido_paquete_cantidad: { type: 'number', format: 'decimal', nullable: true, example: 24 },
            contenido_paquete_envase_id: { type: 'integer', nullable: true, example: 3 },
            contenido_paquete_envase_nombre: { type: 'string', nullable: true, example: 'SOBRE' },
            precio_venta: { type: 'number', format: 'decimal', nullable: true, example: 1250.00 },
            caracteristicas: { type: 'object', additionalProperties: true, example: {} },
            imagen: { type: 'string', nullable: true, example: 'producto.jpg' },
            descripcion: { type: 'string', nullable: true, example: 'Bebida gaseosa' },
            activo: { type: 'boolean', default: true },
            es_bonificacion: { type: 'boolean', default: false },
            motivo_desactivacion: { type: 'string', nullable: true, maxLength: 20 },
            motivo_desactivacion_detalle: { type: 'string', nullable: true, maxLength: 255 },
            fecha_desactivacion: { type: 'string', format: 'date-time', nullable: true },
            stock_total: { type: 'number', example: 0 },
            fecha_creacion: { type: 'string', format: 'date-time' },
            fecha_actualizacion: { type: 'string', format: 'date-time' }
          }
        },
        Lote: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            producto_id: { type: 'integer', example: 1 },
            numero_lote: { type: 'string', example: 'LOT-2024-001' },
            cantidad_inicial: { type: 'number', format: 'decimal', example: 100.00 },
            cantidad_actual: { type: 'number', format: 'decimal', example: 80.00 },
            fecha_ingresso: { type: 'string', format: 'date', example: '2024-01-01' },
            fecha_vencimiento: { type: 'string', format: 'date', example: '2025-01-01' },
            fecha_creacion: { type: 'string', format: 'date-time' }
          }
        },
        MovimientoInventario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            lote_id: { type: 'integer', example: 1 },
            tipo: { type: 'string', enum: ['ingreso', 'salida', 'ajuste'], example: 'ingreso' },
            origen: { type: 'string', enum: ['compra', 'venta', 'inicial', 'ajuste', 'otro'], example: 'compra' },
            cantidad: { type: 'number', format: 'decimal', example: 50.00 },
            precio_unitario: { type: 'number', format: 'decimal', nullable: true, example: 1250.00 },
            precio_total: { type: 'number', format: 'decimal', nullable: true, example: 62500.00 },
            saldo_cantidad: { type: 'number', format: 'decimal', example: 50.00 },
            saldo_precio_unitario: { type: 'number', format: 'decimal', example: 1250.00 },
            saldo_valorizado: { type: 'number', format: 'decimal', example: 62500.00 },
            motivo: { type: 'string', nullable: true },
            usuario_id: { type: 'integer', nullable: true },
            fecha: { type: 'string', format: 'date-time' }
          }
        },
        Venta: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            producto_id: { type: 'integer', example: 1 },
            lote_id: { type: 'integer', nullable: true, example: 1 },
            cantidad: { type: 'number', format: 'decimal', example: 2.00 },
            precio_unitario: { type: 'number', format: 'decimal', example: 1250.00 },
            fecha_venta: { type: 'string', format: 'date', example: '2024-01-15' },
            origen: { type: 'string', enum: ['manual', 'importado'], example: 'manual' },
            usuario_id: { type: 'integer', nullable: true },
            fecha_creacion: { type: 'string', format: 'date-time' }
          }
        },
        ImportacionVenta: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            usuario_id: { type: 'integer', nullable: true },
            nombre_archivo: { type: 'string', example: 'ventas.xlsx' },
            filas_procesadas: { type: 'integer', example: 100 },
            filas_con_error: { type: 'integer', example: 2 },
            estado: { type: 'string', enum: ['procesando', 'completado', 'fallido'], example: 'completado' },
            fecha: { type: 'string', format: 'date-time' }
          }
        },
        UmbralConfiguracion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            tipo: { type: 'string', enum: ['dias_vencimiento', 'stock_minimo'], example: 'stock_minimo' },
            producto_id: { type: 'integer', nullable: true, example: 1 },
            valor: { type: 'number', format: 'decimal', example: 50.00 },
            usuario_id: { type: 'integer', nullable: true },
            fecha_actualizacion: { type: 'string', format: 'date-time' }
          }
        },
        OrdenReabastecimiento: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            producto_id: { type: 'integer', example: 1 },
            cantidad_sugerida: { type: 'number', format: 'decimal', example: 100.00 },
            cantidad_aprobada: { type: 'number', format: 'decimal', nullable: true, example: 100.00 },
            estado: { type: 'string', enum: ['pendiente', 'aprobada', 'rechazada', 'completada'], example: 'pendiente' },
            generado_por: { type: 'string', enum: ['automatico', 'manual'], example: 'automatico' },
            usuario_id: { type: 'integer', nullable: true },
            fecha_creacion: { type: 'string', format: 'date-time' },
            fecha_actualizacion: { type: 'string', format: 'date-time' }
          }
        },
        Alerta: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            tipo: { type: 'string', enum: ['riesgo_vencimiento', 'bajo_stock', 'anomalia'], example: 'bajo_stock' },
            producto_id: { type: 'integer', example: 1 },
            lote_id: { type: 'integer', nullable: true, example: 1 },
            mensaje: { type: 'string', example: 'El stock del producto está por debajo del mínimo' },
            severidad: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'], example: 'alta' },
            datos_origen: { type: 'object', additionalProperties: true, nullable: true },
            estado: { type: 'string', enum: ['nueva', 'vista', 'atendida', 'descartada'], example: 'nueva' },
            fecha_creacion: { type: 'string', format: 'date-time' },
            fecha_atendida: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        NotificacionCorreo: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            alerta_id: { type: 'integer', nullable: true, example: 1 },
            destinatario: { type: 'string', format: 'email', example: 'admin@stockia.local' },
            estado: { type: 'string', enum: ['pendiente', 'enviado', 'fallido'], example: 'enviado' },
            proveedor: { type: 'string', example: 'brevo' },
            fecha_envio: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        ReporteGenerado: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            usuario_id: { type: 'integer', nullable: true },
            tipo: { type: 'string', example: 'inventario' },
            formato: { type: 'string', enum: ['excel', 'pdf'], example: 'excel' },
            parametros: { type: 'object', additionalProperties: true, nullable: true },
            ruta_archivo: { type: 'string', nullable: true },
            fecha_generacion: { type: 'string', format: 'date-time' }
          }
        },
        PreferenciaUsuario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            usuario_id: { type: 'integer', example: 1 },
            clave: { type: 'string', example: 'theme' },
            valor: { type: 'object', additionalProperties: true, example: { mode: 'dark' } },
            fecha_actualizacion: { type: 'string', format: 'date-time' }
          }
        },
        Auditoria: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            usuario_id: { type: 'integer', nullable: true },
            accion: { type: 'string', example: 'crear' },
            entidad: { type: 'string', example: 'Producto' },
            entidad_id: { type: 'integer', nullable: true, example: 1 },
            detalle: { type: 'object', additionalProperties: true, nullable: true },
            fecha: { type: 'string', format: 'date-time' }
          }
        },
        Rol: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Administrador' },
            descripcion: { type: 'string', nullable: true, example: 'Acceso completo al sistema' },
            fecha_creacion: { type: 'string', format: 'date-time' }
          }
        },
        Permiso: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            codigo: { type: 'string', example: 'gestionar_productos' },
            descripcion: { type: 'string', nullable: true }
          }
        },
        TipoEnvase: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'SOBRE' },
            activo: { type: 'boolean', default: true },
            creado_en: { type: 'string', format: 'date-time' }
          }
        },
        ProductoPresentacion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            producto_id: { type: 'integer', example: 1 },
            nivel: { type: 'integer', minimum: 1, example: 1 },
            envase_id: { type: 'integer', example: 1 },
            cantidad: { type: 'number', format: 'decimal', minimum: 0.01, example: 10 },
            envase_nombre: { type: 'string', nullable: true, example: 'SOBRE' }
          }
        },
        Precio: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            producto_id: { type: 'integer', example: 1 },
            precioLista: { type: 'number', format: 'decimal', minimum: 0, example: 5.30 },
            precioDescuento: { type: 'number', format: 'decimal', nullable: true, minimum: 0, example: 4.90 },
            vigente_desde: { type: 'string', format: 'date', example: '2024-01-01' },
            creado_en: { type: 'string', format: 'date-time' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error interno del servidor' },
            stack: { type: 'string', example: 'Error: ...' }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] }
    ]
  },
  apis: apiFiles
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui-wrap .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true
    }
  }));
};

module.exports = { setupSwagger, specs };
