const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // password conserva hashes legacy; las cuentas nuevas usan password_hash.
    password: { type: DataTypes.STRING(128), allowNull: true },
    password_hash: { type: DataTypes.STRING(128), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    rol_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'roles', key: 'id' } },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ultimo_acceso: { type: DataTypes.DATE, allowNull: true },
    is_staff: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    google_id: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    avatar: { type: DataTypes.STRING(500), allowNull: true },
    provider: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'local' },
    email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    last_login: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'usuarios',
    timestamps: false,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash && !user.password_hash.startsWith('$2')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        } else if (user.password && !user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash') && user.password_hash && !user.password_hash.startsWith('$2')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        } else if (user.changed('password') && user.password && !user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  Usuario.prototype.validarPassword = async function (password) {
    const hash = this.password_hash || this.password;
    return Boolean(hash) && bcrypt.compare(password, hash);
  };

  return Usuario;
};
