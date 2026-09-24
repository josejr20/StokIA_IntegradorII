const { sequelize } = require('../config/database');

const Models = {};

// ====================
// MODELOS
// ====================

Models.Usuario = require('./Usuario')(sequelize);
Models.Rol = require('./Rol')(sequelize);
Models.Permiso = require('./Permiso')(sequelize);
Models.RolPermiso = require('./RolPermiso')(sequelize);
Models.TokenRecuperacion = require('./TokenRecuperacion')(sequelize);
Models.Categoria = require('./Categoria')(sequelize);
Models.UnidadMedida = require('./UnidadMedida')(sequelize);
Models.Presentacion = require('./Presentacion')(sequelize);
Models.CatalogoMarca = require('./CatalogoMarca')(sequelize);
Models.CatalogoValor = require('./CatalogoValor')(sequelize);
    Models.Producto = require('./Producto')(sequelize);
    Models.Lote = require('./Lote')(sequelize);
    Models.MovimientoInventario = require('./MovimientoInventario')(sequelize);
    Models.Venta = require('./Venta')(sequelize);
    Models.ImportacionVenta = require('./ImportacionVenta')(sequelize);
    Models.UmbralConfiguracion = require('./UmbralConfiguracion')(sequelize);
    Models.OrdenReabastecimiento = require('./OrdenReabastecimiento')(sequelize);
    Models.Alerta = require('./Alerta')(sequelize);
    Models.NotificacionCorreo = require('./NotificacionCorreo')(sequelize);
    Models.ReporteGenerado = require('./ReporteGenerado')(sequelize);
    Models.PreferenciaUsuario = require('./PreferenciaUsuario')(sequelize);
    Models.Auditoria = require('./Auditoria')(sequelize);
    Models.tipoEnvase = require('./TipoEnvase')(sequelize);
    Models.ProductoPresentacion = require('./ProductoPresentacion')(sequelize);
    Models.Precio = require('./Precio')(sequelize);

// Exportar la instancia de Sequelize
Models.sequelize = sequelize;

// ====================
// ASOCIACIONES
// ====================

// Rol <-> Usuario
Models.Rol.hasMany(Models.Usuario, {
  foreignKey: 'rol_id',
  as: 'usuarios'
});

Models.Usuario.belongsTo(Models.Rol, {
  foreignKey: 'rol_id',
  as: 'rol'
});

// Rol <-> Permiso
Models.Rol.belongsToMany(Models.Permiso, {
  through: Models.RolPermiso,
  foreignKey: 'rol_id',
  as: 'permisos'
});

Models.Permiso.belongsToMany(Models.Rol, {
  through: Models.RolPermiso,
  foreignKey: 'permiso_id',
  as: 'roles'
});

// Usuario <-> TokenRecuperacion
Models.Usuario.hasMany(Models.TokenRecuperacion, {
  foreignKey: 'usuario_id',
  as: 'tokens'
});

Models.TokenRecuperacion.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Categoria <-> Producto
Models.Categoria.hasMany(Models.Producto, {
  foreignKey: 'categoria_id',
  as: 'productos'
});

Models.Producto.belongsTo(Models.Categoria, {
  foreignKey: 'categoria_id',
  as: 'categoria'
});

// UnidadMedida <-> Producto
Models.UnidadMedida.hasMany(Models.Producto, {
  foreignKey: 'unidad_medida_id',
  as: 'productos'
});

Models.Producto.belongsTo(Models.UnidadMedida, {
  foreignKey: 'unidad_medida_id',
  as: 'unidadMedida'
});

// Presentacion <-> Producto
Models.Presentacion.hasMany(Models.Producto, {
  foreignKey: 'presentacion_id',
  as: 'productos'
});

Models.Producto.belongsTo(Models.Presentacion, {
  foreignKey: 'presentacion_id',
  as: 'presentacion'
});

// CatalogoMarca <-> Producto
Models.CatalogoMarca.hasMany(Models.Producto, {
  foreignKey: 'marca_id',
  as: 'productos'
});

Models.Producto.belongsTo(Models.CatalogoMarca, {
  foreignKey: 'marca_id',
  as: 'marca'
});

// Producto <-> Lote
Models.Producto.hasMany(Models.Lote, {
  foreignKey: 'producto_id',
  as: 'lotes'
});

Models.Lote.belongsTo(Models.Producto, {
  foreignKey: 'producto_id',
  as: 'producto'
});

// Lote <-> MovimientoInventario
Models.Lote.hasMany(Models.MovimientoInventario, {
  foreignKey: 'lote_id',
  as: 'movimientos'
});

Models.MovimientoInventario.belongsTo(Models.Lote, {
  foreignKey: 'lote_id',
  as: 'lote'
});

// Lote <-> Venta
Models.Lote.hasMany(Models.Venta, {
  foreignKey: 'lote_id',
  as: 'ventas'
});

Models.Venta.belongsTo(Models.Lote, {
  foreignKey: 'lote_id',
  as: 'lote'
});

// Producto <-> Venta
Models.Producto.hasMany(Models.Venta, {
  foreignKey: 'producto_id',
  as: 'ventas'
});

Models.Venta.belongsTo(Models.Producto, {
  foreignKey: 'producto_id',
  as: 'producto'
});

// Usuario <-> Venta
Models.Usuario.hasMany(Models.Venta, {
  foreignKey: 'usuario_id',
  as: 'ventas'
});

Models.Venta.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Usuario <-> ImportacionVenta
Models.Usuario.hasMany(Models.ImportacionVenta, {
  foreignKey: 'usuario_id',
  as: 'importaciones'
});

Models.ImportacionVenta.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Usuario <-> Auditoria
Models.Usuario.hasMany(Models.Auditoria, {
  foreignKey: 'usuario_id',
  as: 'auditorias'
});

Models.Auditoria.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Producto <-> UmbralConfiguracion
Models.UmbralConfiguracion.belongsTo(Models.Producto, {
  foreignKey: 'producto_id',
  as: 'producto'
});

Models.Producto.hasMany(Models.UmbralConfiguracion, {
  foreignKey: 'producto_id',
  as: 'umbrales'
});

// Producto <-> OrdenReabastecimiento
Models.OrdenReabastecimiento.belongsTo(Models.Producto, {
  foreignKey: 'producto_id',
  as: 'producto'
});

Models.Producto.hasMany(Models.OrdenReabastecimiento, {
  foreignKey: 'producto_id',
  as: 'ordenes'
});

// Producto <-> Alerta
Models.Alerta.belongsTo(Models.Producto, {
  foreignKey: 'producto_id',
  as: 'producto'
});

Models.Producto.hasMany(Models.Alerta, {
  foreignKey: 'producto_id',
  as: 'alertas'
});

// Lote <-> Alerta
    Models.Alerta.belongsTo(Models.Lote, {
      foreignKey: 'lote_id',
      as: 'lote'
    });

    Models.Lote.hasMany(Models.Alerta, {
      foreignKey: 'lote_id',
      as: 'alertas'
    });

    // TipoEnvase <-> ProductoPresentacion
    Models.tipoEnvase.hasMany(Models.ProductoPresentacion, {
      foreignKey: 'envase_id',
      as: 'presentaciones'
    });

    Models.ProductoPresentacion.belongsTo(Models.tipoEnvase, {
      foreignKey: 'envase_id',
      as: 'envase'
    });

    // TipoEnvase <-> Producto (categoria_paquete_id y contenido_paquete_envase_id)
    Models.tipoEnvase.hasMany(Models.Producto, {
      foreignKey: 'categoria_paquete_id',
      as: 'productosCategoriaPaquete'
    });
    Models.Producto.belongsTo(Models.tipoEnvase, {
      foreignKey: 'categoria_paquete_id',
      as: 'categoriaPaquete'
    });

    Models.tipoEnvase.hasMany(Models.Producto, {
      foreignKey: 'contenido_paquete_envase_id',
      as: 'productosEnvaseContenido'
    });
    Models.Producto.belongsTo(Models.tipoEnvase, {
      foreignKey: 'contenido_paquete_envase_id',
      as: 'envaseContenido'
    });

    // Producto <-> ProductoPresentacion (empaques de profundidad variable)
    Models.Producto.hasMany(Models.ProductoPresentacion, {
      foreignKey: 'producto_id',
      as: 'presentacionesNiveles'
    });

    Models.ProductoPresentacion.belongsTo(Models.Producto, {
      foreignKey: 'producto_id',
      as: 'producto'
    });

    // Producto <-> Precio (historial de precios)
    Models.Producto.hasMany(Models.Precio, {
      foreignKey: 'producto_id',
      as: 'precios'
    });

    Models.Precio.belongsTo(Models.Producto, {
      foreignKey: 'producto_id',
      as: 'producto'
    });

// Alerta <-> NotificacionCorreo
Models.NotificacionCorreo.belongsTo(Models.Alerta, {
  foreignKey: 'alerta_id',
  as: 'alerta'
});

Models.Alerta.hasMany(Models.NotificacionCorreo, {
  foreignKey: 'alerta_id',
  as: 'notificaciones'
});

// Usuario <-> ReporteGenerado
Models.ReporteGenerado.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

Models.Usuario.hasMany(Models.ReporteGenerado, {
  foreignKey: 'usuario_id',
  as: 'reportes'
});

// Usuario <-> PreferenciaUsuario
Models.PreferenciaUsuario.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

Models.Usuario.hasMany(Models.PreferenciaUsuario, {
  foreignKey: 'usuario_id',
  as: 'preferencias'
});

// Usuario <-> MovimientoInventario
Models.MovimientoInventario.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Usuario <-> UmbralConfiguracion
Models.UmbralConfiguracion.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

// Usuario <-> OrdenReabastecimiento
Models.OrdenReabastecimiento.belongsTo(Models.Usuario, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});

module.exports = Models;
