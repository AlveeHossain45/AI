/**
 * Email delivery: SMTP when configured, otherwise logs the link and, in
 * development, exposes the token so flows can be tested without SMTP.
 */
import config from '../config/index.js';
import logger from '../utils/logger.js';

let transporter = null;
let transportReady = false;

async function getTransport () {
  if (!config.email.smtpUrl) return null;
  if (transportReady) return transporter;
  try {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.createTransport(config.email.smtpUrl);
    await transporter.verify();
    transportReady = true;
    logger.info('Email: SMTP transport verified');
    return transporter;
  } catch (error) {
    logger.warn(`Email: SMTP unavailable (${error.message}). Links will be logged instead.`);
    transporter = null;
    return null;
  }
}

/**
 * @returns {Promise<{delivered: boolean, devUrl?: string}>}
 */
export async function sendEmail ({ to, subject, text, path }) {
  const devUrl = path ? `${config.clientUrl}${path}` : undefined;
  const transport = await getTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: config.email.from,
        to,
        subject,
        text: devUrl ? `${text}\n\n${devUrl}` : text,
      });
      return { delivered: true };
    } catch (error) {
      logger.error(`Email send failed: ${error.message}`);
    }
  }
  logger.warn(`[DEV EMAIL] To: ${to} | Subject: ${subject} | Link: ${devUrl || 'n/a'}`);
  return { delivered: false, devUrl: config.isDev ? devUrl : undefined };
}

export default { sendEmail };
