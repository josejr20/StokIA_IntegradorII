const config = require('../config');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    });
  }
  return transporter;
};

const enviarCorreo = async (destinatario, asunto, contenidoHtml) => {
  try {
    const smtp = getTransporter();
    if (smtp) {
      await smtp.sendMail({ from: config.EMAIL_FROM, to: destinatario, subject: asunto, html: contenidoHtml });
      return true;
    }
    if (!config.BREVO_API_KEY) {
      throw new Error('No hay transporte SMTP ni API de Brevo configurados');
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': config.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: config.BREVO_SENDER_EMAIL, name: 'StockIA' },
        to: [{ email: destinatario }],
        subject: asunto,
        htmlContent: contenidoHtml
      }),
      timeout: 10000
    });
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`El proveedor de correo respondió ${response.status}`);
    }
    return true;
  } catch (error) {
    logger.error(`Error enviando correo: ${error.message}`);
    throw error;
  }
};

module.exports = { enviarCorreo };
