import { z } from 'zod';

const schema = z.object({

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  DIRECT_URL: z.string().min(1).optional(),

  APP_DATABASE_URL: z.string().min(1).optional(),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)'),

  MONNIFY_BASE_URL: z
    .string()
    .url()
    .default('https://sandbox.monnify.com'),
  MONNIFY_API_KEY: z.string().min(1, 'MONNIFY_API_KEY is required'),
  MONNIFY_SECRET_KEY: z.string().min(1, 'MONNIFY_SECRET_KEY is required'),
  MONNIFY_CONTRACT_CODE: z.string().min(1, 'MONNIFY_CONTRACT_CODE is required'),
  MONNIFY_WALLET_ACCOUNT_NUMBER: z
    .string()
    .min(1, 'MONNIFY_WALLET_ACCOUNT_NUMBER is required (your Monnify wallet source account)'),
  LOGISTICS_BANK_CODE: z.string().min(1, 'LOGISTICS_BANK_CODE is required'),
  LOGISTICS_ACCOUNT_NUMBER: z.string().min(1, 'LOGISTICS_ACCOUNT_NUMBER is required'),
  LOGISTICS_ACCOUNT_NAME: z.string().min(1, 'LOGISTICS_ACCOUNT_NAME is required'),

  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  OTP_FROM_EMAIL: z.string().email().default('noreply@payproof.ng'),

  OTP_MODE: z.enum(['dev', 'live']).default('dev'),

  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  AI_SYSTEM_PROMPT: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  DEMO_FALLBACK: z.stringbool().default(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

function parseEnv() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(
      `\n[PayProof 2.0] Environment validation failed. Fix these before starting:\n\n${lines.join('\n')}\n\n` +
        `Copy .env.example to .env.local and fill in the missing values.\n`
    );
  }

  return result.data;
}

export const env = parseEnv();

export type Env = typeof env;
