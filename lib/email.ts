import { logger } from './logger';
import { env } from './env';

export interface OtpDeliveryResult {
  delivery: 'email';
}

export async function sendOtp(
  email:   string,
  code:    string,
): Promise<OtpDeliveryResult> {
  const { host, port, secure, user, pass } = smtpConfig();

  const { default: nodemailer } = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `PayProof <${user}>`,
    to: email,
    subject: 'Your PayProof login code',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your PayProof code</h2>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
        <p>This code expires in 10 minutes. Do not share it.</p>
        <p style="color: #888; font-size: 12px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  logger.info('OTP email sent', { email });
  return { delivery: 'email' };
}

function smtpConfig() {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
    );
  }
  return {
    host,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    user,
    pass,
  };
}
