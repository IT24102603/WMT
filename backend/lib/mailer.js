const nodemailer = require("nodemailer");

function buildMailer() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : null;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, text }) {
  const mailer = buildMailer();
  if (!mailer) throw new Error("SMTP is not configured on the server.");
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
    to,
    subject,
    text,
  });
}

module.exports = { buildMailer, sendMail };
