class TokenRecuperacionDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.token = data.token;
    this.expira_en = data.expira_en;
    this.usado = data.usado;
    this.fecha_creacion = data.fecha_creacion;
  }

  static fromCreate(data) {
    return {
      usuario_id: data.usuario_id,
      token: data.token,
      expira_en: data.expira_en
    };
  }
}

module.exports = { TokenRecuperacionDto };
