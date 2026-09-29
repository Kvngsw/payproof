import { logger } from './logger';
import { env } from './env';

export type DeliveryMode = 'smtp' | 'email' | 'dev_screen';

export interface OtpDeliveryResult {
  delivery: DeliveryMode;
  devCode?: string; // only present when the chain reaches dev_screen
}

async function sendViaSmtp(email: string, code: string): Promise<void> {
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
    html: otpHtml(code),
  });
}

async function sendViaResend(email: string, code: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('[PayProof] RESEND_API_KEY is not set.');
  const from = `PayProof <${env.OTP_FROM_EMAIL}>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Your PayProof login code',
      html: otpHtml(code),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed: ${response.status} ${body.slice(0, 120)}`);
  }
}

export async function sendOtp(
  email:   string,
  code:    string,
): Promise<OtpDeliveryResult> {
  if (env.OTP_MODE === 'dev') {
    logger.info('OTP dev mode — code returned in response', {
      email,
      ...(env.NODE_ENV !== 'production' && { code }),
    });
    return { delivery: 'dev_screen', devCode: code };
  }

  try {
    await sendViaSmtp(email, code);
    logger.info('OTP email sent via SMTP', { email });
    return { delivery: 'smtp' };
  } catch (smtpErr) {
    logger.error('SMTP send failed, trying Resend', {
      email,
      err: smtpErr instanceof Error ? smtpErr : new Error(String(smtpErr)),
    });
  }

  try {
    await sendViaResend(email, code);
    logger.info('OTP email sent via Resend', { email });
    return { delivery: 'email' };
  } catch (resendErr) {
    logger.error('Resend failed, falling back to dev_screen', {
      email,
      err: resendErr instanceof Error ? resendErr : new Error(String(resendErr)),
    });
  }

  return { delivery: 'dev_screen', devCode: code }; // every rail down: login survives, FE banners the mode
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

function otpHtml(code: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Your PayProof code</h2>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
      <p>This code expires in 10 minutes. Do not share it.</p>
      <p style="color: #888; font-size: 12px;">If you didn't request this, ignore this email.</p>
    </div>
  `;
}
