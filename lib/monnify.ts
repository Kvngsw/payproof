/**
 * lib/monnify.ts — Monnify rail adapter (RailProvider implementation).
 *
 * WHY (rail-agnostic interface): The interface decouples business logic
 * from the payment provider. If Monnify goes down during the demo, we can
 * swap to a backup without touching a single order or webhook handler.
 *
 * WHY (kobo↔naira boundary): Integer money (kobo) is used throughout the
 * API and database. Floating point arithmetic is fundamentally broken for
 * exact values. This file is the ONLY place where conversion between kobo
 * (our internal unit) and naira (Monnify's API unit) happens.
 *
 * WHY (singleflight token cache): Monnify tokens last ~60 minutes. Without
 * caching, every request fires an auth call. Singleflight ensures that if
 * 100 concurrent requests arrive while the token is expired, only one
 * auth call goes out — the other 99 wait and reuse the result.
 *
 * WHY (timing-safe HMAC): crypto.timingSafeEqual prevents timing attacks
 * where an attacker sends partial signatures and measures response time to
 * reconstruct the full HMAC.
 *
 * Rewritten from PayProof 1.0 lib/monnifyClient.js:
 *   - Removed ALL console.log (they leaked BVN + amounts)
 *   - Kobo↔naira conversion centralised here only
 *   - Zod schemas validate every Monnify API response
 *   - initializeTransaction added (was missing from spec)
 *   - verifyTransaction returns amountKobo (not amountNaira)
 */

import crypto from 'crypto';
import { z }  from 'zod';
import { logger } from './logger';
import { RailError, RailTimeoutError } from './errors';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = () =>
  process.env.MONNIFY_BASE_URL ?? 'https://sandbox.monnify.com';

// ── Money conversion — lives ONLY in this file ────────────────────────────────

/** Monnify API uses naira. We store/send kobo. Convert at the boundary. */
function koboToNaira(kobo: number): number {
  return kobo / 100;
}

function nairaToKobo(naira: number | string): number {
  return Math.round(Number(naira) * 100);
}

// ── Zod schemas for Monnify API responses ─────────────────────────────────────

const TokenResponseSchema = z.object({
  responseBody: z.object({
    accessToken: z.string(),
  }),
});

const ReservedAccountSchema = z.object({
  responseBody: z.object({
    accountName: z.string(),
    accounts: z
      .array(
        z.object({
          bankName:      z.string(),
          accountNumber: z.string(),
        }),
      )
      .min(1),
  }),
});

const TransactionQuerySchema = z.object({
  responseBody: z.object({
    // Unpaid transactions return nulls — schema reflects the real rail,
    // and the code below treats null status/amount as "not paid".
    paymentStatus: z.string().nullable().optional(),
    amountPaid: z.union([z.string(), z.number()]).nullable().optional(),
    currencyCode: z.string().nullable().optional(),
    paidOn: z.string().nullable().optional(),
    transactionReference: z.string().nullable().optional(),
  }),
});

const InitTransactionSchema = z.object({
  responseBody: z.object({
    transactionReference: z.string(),
    checkoutUrl:         z.string().url(),
  }),
});

const TransferSchema = z.object({
  responseBody: z.object({
    status:    z.string(),
    reference: z.string(),
    amount:    z.union([z.string(), z.number()]),
  }),
});

const BankValidationSchema = z.object({
  responseBody: z.object({
    accountNumber: z.string(),
    accountName:   z.string(),
    bankCode:      z.string(),
  }),
});

// ── Interfaces (rail-agnostic contract) ───────────────────────────────────────

export interface ReservedAccount {
  accountNumber: string;
  bankName:      string;
  accountName:   string;
}

export interface InitTransactionResult {
  reference:   string;
  checkoutUrl: string;
}

export interface VerifiedTransaction {
  paymentStatus: string;
  amountKobo:    number;
  currency:      string;
  paidAt:        string | null;
  raw:           unknown;
}

export interface PayoutParams {
  amountKobo:            number;
  reference:             string;
  narration:             string;
  destinationBankCode:   string;
  destinationAccountNumber: string;
  destinationAccountName:   string;
  sourceAccountNumber:   string;
}

export interface PayoutResult {
  status:    string;
  reference: string;
}

export interface BankValidation {
  accountNumber: string;
  accountName:   string;
  bankCode:      string;
}

// ── Token cache (singleflight) ────────────────────────────────────────────────

interface TokenCache { token: string; expiresAt: number }
let _tokenCache: TokenCache | null   = null;
let _tokenPromise: Promise<string> | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expiresAt) {
    logger.debug('Monnify token served from cache');
    return _tokenCache.token;
  }

  // Singleflight — if a refresh is already in flight, wait for it.
  if (_tokenPromise) {
    return _tokenPromise;
  }

  _tokenPromise = (async (): Promise<string> => {
    const apiKey    = process.env.MONNIFY_API_KEY;
    const secretKey = process.env.MONNIFY_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new RailError('[PayProof] MONNIFY_API_KEY or MONNIFY_SECRET_KEY is not set.');
    }

    const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    logger.debug('Fetching fresh Monnify access token');

    const response = await fetch(`${BASE_URL()}/api/v1/auth/login`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new RailError(`[Monnify] getToken failed: ${response.status}`, { body });
    }

    const data   = TokenResponseSchema.parse(await response.json());
    const token  = data.responseBody.accessToken;

    // Cache with 5-minute buffer before expiry (tokens last ~60 minutes).
    _tokenCache = { token, expiresAt: now + 55 * 60 * 1_000 };

    logger.info('Monnify access token refreshed', {
      expiresAt: new Date(_tokenCache.expiresAt).toISOString(),
    });

    return token;
  })();

  try {
    return await _tokenPromise;
  } finally {
    _tokenPromise = null;
  }
}

// ── Rail functions ────────────────────────────────────────────────────────────

/**
 * Create a Monnify reserved account for a seller at registration.
 * The account_number is what buyers use to pay directly.
 */
export async function createReservedAccount(params: {
  userId:   string | number;
  name:     string;
  email:    string;
  bvn:      string;
}): Promise<ReservedAccount> {
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;
  if (!contractCode) throw new RailError('[PayProof] MONNIFY_CONTRACT_CODE is not set.');
  if (!params.bvn)   throw new RailError('BVN is required to create a reserved account.');

  const token = await getToken();

  const body = {
    accountReference:    `PAYPROOF-${params.userId}-${Date.now().toString(36)}`,
    accountName:         `PayProof — ${params.name}`,
    currencyCode:        'NGN',
    contractCode,
    customerEmail:       params.email,
    customerName:        params.name,
    getAllAvailableBanks: true,
    bvn:                 params.bvn,
  };

  logger.debug('Creating Monnify reserved account', { userId: params.userId });

  let response: Response;
  try {
    response = await fetch(`${BASE_URL()}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new RailError('Network error reaching Monnify', {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new RailError(`[Monnify] createReservedAccount failed: ${response.status}`, {
      body: text,
    });
  }

  const data  = ReservedAccountSchema.parse(await response.json());
  const acct  = data.responseBody;
  const first = acct.accounts[0];

  logger.info('Monnify reserved account created', {
    userId:  params.userId,
    bank:    first.bankName,
    // Log only last 4 digits — no secrets in logs
    number:  `••••${first.accountNumber.slice(-4)}`,
    name:    acct.accountName,
  });

  return {
    accountNumber: first.accountNumber,
    bankName:      first.bankName,
    accountName:   acct.accountName,
  };
}

/**
 * Initialise a Monnify hosted checkout for a buyer.
 * Returns a checkoutUrl to redirect the buyer to, and a reference
 * that Monnify sends back in the webhook (our payment reference).
 */
export async function initializeTransaction(order: {
  ref:          string;
  totalKobo:    number;
  productName:  string;
  buyerEmail:   string;
  redirectUrl:  string;
}): Promise<InitTransactionResult> {
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;
  if (!contractCode) throw new RailError('MONNIFY_CONTRACT_CODE is not set.');

  const token = await getToken();

  const body = {
    amount:             koboToNaira(order.totalKobo),
    customerName:       order.buyerEmail,
    customerEmail:      order.buyerEmail,
    paymentReference:   order.ref,              // YOUR ref — Monnify echoes this in webhook
    paymentDescription: `PayProof order: ${order.productName}`,
    currencyCode:       'NGN',
    contractCode,
    redirectUrl:        order.redirectUrl,
    paymentMethods:     ['ACCOUNT_TRANSFER', 'CARD'],
  };

  logger.debug('Initialising Monnify transaction', { ref: order.ref });

  const response = await fetch(`${BASE_URL()}/api/v1/merchant/transactions/init-transaction`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new RailError(`[Monnify] initializeTransaction failed: ${response.status}`, {
      body: text,
    });
  }

  const data = InitTransactionSchema.parse(await response.json());
  return {
    reference:   data.responseBody.transactionReference,
    checkoutUrl: data.responseBody.checkoutUrl,
  };
}

/**
 * Server-side transaction verification.
 *
 * WHY: Never trust the webhook body alone. We always call back to Monnify
 * to confirm the payment status. This prevents spoofed webhooks from
 * marking orders as paid.
 *
 * Returns amountKobo — conversion from naira happens here only.
 */
export async function verifyTransaction(
  transactionReference: string,
): Promise<VerifiedTransaction> {
  const token = await getToken();

  const url = new URL(`${BASE_URL()}/api/v2/merchant/transactions/query`);
  url.searchParams.set('transactionReference', transactionReference);

  logger.debug('Verifying Monnify transaction', { transactionReference });

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8_000);
    response = await fetch(url.toString(), {
      method:  'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal:  controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new RailTimeoutError('Monnify verify timed out after 8s.');
    }
    throw new RailError('Network error during Monnify verify', {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new RailError(`[Monnify] verifyTransaction failed: ${response.status}`, { body });
  }

  const raw  = await response.json();
  const data = TransactionQuerySchema.parse(raw);
  const r    = data.responseBody;

  // Null status/amount (unpaid or rail drift) degrades to "not paid" —
  // the caller takes the mismatch path, never a crash-retry loop.
  const amountKobo = r.amountPaid == null ? 0 : nairaToKobo(r.amountPaid);

  logger.info('Monnify transaction verified', {
    transactionReference,
    paymentStatus: r.paymentStatus,
    // Log amount in kobo — no floats in logs
    amountKobo,
  });

  return {
    paymentStatus: r.paymentStatus ?? 'UNKNOWN',
    amountKobo,
    currency: r.currencyCode ?? 'NGN',
    paidAt:   r.paidOn ?? null,
    raw,
  };
}

/**
 * Initiate a bank transfer (payout).
 * amountKobo is converted to naira here — the ONLY conversion point.
 */
export async function initiatePayout(params: PayoutParams): Promise<PayoutResult> {
  const token = await getToken();

  const sourceAccountNumber = params.sourceAccountNumber ||
    process.env.MONNIFY_WALLET_ACCOUNT_NUMBER;

  if (!sourceAccountNumber) {
    throw new RailError('MONNIFY_WALLET_ACCOUNT_NUMBER is not configured.');
  }

  const body = {
    amount:                   koboToNaira(params.amountKobo),
    reference:                params.reference,
    narration:                params.narration,
    destinationBankCode:      params.destinationBankCode,
    destinationAccountNumber: params.destinationAccountNumber,
    destinationAccountName:   params.destinationAccountName,
    currency:                 'NGN',
    sourceAccountNumber,
  };

  logger.debug('Initiating Monnify payout', {
    reference: params.reference,
    // Log only last 4 digits — no account numbers in logs
    destination: `••••${params.destinationAccountNumber.slice(-4)}`,
    amountKobo: params.amountKobo,
  });

  const response = await fetch(`${BASE_URL()}/api/v2/disbursements/single`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new RailError(`[Monnify] initiatePayout failed: ${response.status}`, { body: text });
  }

  const data   = TransferSchema.parse(await response.json());
  const result = data.responseBody;

  logger.info('Monnify payout initiated', {
    reference: params.reference,
    status:    result.status,
    amountKobo: params.amountKobo,
  });

  return {
    status:    result.status,
    reference: result.reference,
  };
}

/**
 * Validate a bank account before storing settlement details.
 * In sandbox, returns a stub — the real API requires live Monnify credentials.
 */
export async function validateBankAccount(
  bankCode:      string,
  accountNumber: string,
): Promise<BankValidation> {
  if (isSandbox()) {
    logger.debug('validateBankAccount: sandbox — returning simulated result', {
      bankCode,
      accountNumber: `••••${accountNumber.slice(-4)}`,
    });
    return { bankCode, accountNumber, accountName: 'Sandbox Account' };
  }

  const token = await getToken();
  const url   = new URL(`${BASE_URL()}/api/v2/disbursements/account/validate`);
  url.searchParams.set('accountNumber', accountNumber);
  url.searchParams.set('bankCode', bankCode);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new RailError(`[Monnify] validateBankAccount failed: ${response.status}`, { body });
  }

  const data = BankValidationSchema.parse(await response.json());
  return data.responseBody;
}

/** True when MONNIFY_BASE_URL points at the sandbox environment. */
export function isSandbox(): boolean {
  return BASE_URL().includes('sandbox');
}

/**
 * Verify the HMAC-SHA512 webhook signature from Monnify.
 *
 * WHY (timingSafeEqual): Regular string comparison short-circuits on the
 * first differing character. An attacker can measure response time to
 * reconstruct the HMAC byte by byte. timingSafeEqual always takes the
 * same time regardless of how many bytes match.
 *
 * Sandbox mode: Monnify doesn't send a signature header. We skip
 * verification in sandbox and enforce it in production.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secretKey = process.env.MONNIFY_SECRET_KEY;
  if (!secretKey) {
    throw new RailError('[PayProof] MONNIFY_SECRET_KEY is not set.');
  }

  const expected = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected,  'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    // Buffer.from throws if signature is not valid hex — treat as no match.
    return false;
  }
}
