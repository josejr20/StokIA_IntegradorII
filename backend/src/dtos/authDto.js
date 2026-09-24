class LoginDto {
  constructor(email, password) {
    this.email = email;
    this.password = password;
  }

  static fromBody(body) {
    return new LoginDto(body.email, body.password);
  }

  toJSON() {
    return { email: this.email, password: this.password };
  }
}

module.exports = { LoginDto };
