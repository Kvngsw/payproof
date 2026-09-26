import crypto from 'crypto';
import { z }  from 'zod';
import { logger } from './logger';
import { RailError, RailTimeoutError } from './errors';

const BASE_URL = () =>
  process.env.MONNIFY_BASE_URL ?? 'https://sandbox.monnify.com';

function koboToNaira(kobo: number): number {
  return kobo / 100; // the single conversion point: Monnify speaks naira, we speak kobo
}

function nairaToKobo(naira: number | string): number {
  return Math.round(Number(naira) * 100);
}

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

interface TokenCache { token: string; expiresAt: number }
let _tokenCache: TokenCache | null   = null;
let _tokenPromise: Promise<string> | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (_tokenCache && now < _tokenCache.expiresAt) {
    logger.debug('Monnify token served from cache');
    return _tokenCache.token;
  }

  if (_tokenPromise) { // one refresh at a time: 100 concurrent expiries = 1 auth call
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

    number:  `••••${first.accountNumber.slice(-4)}`,
    name:    acct.accountName,
  });

  return {
    accountNumber: first.accountNumber,
    bankName:      first.bankName,
    accountName:   acct.accountName,
  };
}

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
    paymentReference:   order.ref,
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
    const timeout    = setTimeout(() => controller.abort(), 8_000); // hanging rails must not hang requests
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

  const amountKobo = r.amountPaid == null ? 0 : nairaToKobo(r.amountPaid);

  logger.info('Monnify transaction verified', {
    transactionReference,
    paymentStatus: r.paymentStatus,

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

export function isSandbox(): boolean {
  return BASE_URL().includes('sandbox');
}

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
    return crypto.timingSafeEqual( // constant-time: response time must not leak signature bytes
      Buffer.from(expected,  'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {

    return false;
  }
}
