const config = require('../config');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD) {
    throw new Error('La configuración SMTP está incompleta');
  }
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
    await smtp.sendMail({ from: config.EMAIL_FROM, to: destinatario, subject: asunto, html: contenidoHtml });
    return true;
  } catch (error) {
    logger.error(`Error enviando correo: ${error.message}`);
    throw error;
  }
};

module.exports = { enviarCorreo };
