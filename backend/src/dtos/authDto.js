class LoginDto {
  constructor(identifier, password) {
    this.identifier = identifier;
    this.password = password;
  }

  static fromBody(body) {
    return new LoginDto(body.identifier ?? body.email, body.password);
  }

  toJSON() {
    return { identifier: this.identifier, password: this.password };
  }
}

module.exports = { LoginDto };
