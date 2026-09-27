// Local recipe:
//   NODE_ENV=development API_PROXY_TARGET= bun run start -- -p 3111
//   E2E_BASE=http://localhost:3111/api/v1 npm run test:e2e
// API_PROXY_TARGET must be empty (else /api/v1 proxies to the deployed app —
// different JWT secret — and the buyer token minted below is rejected);
// NODE_ENV=development unlocks /monnify/simulate, which is 403 in production mode.

import db from '../lib/db';
import { signAccessToken } from '../lib/auth';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000/api/v1';
const TS = Date.now().toString(36);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`FAIL ${name} ${detail}`.trim());
  }
}

interface Res {
  status: number;
  json: unknown;
  headers: Headers;
}

async function req(method: string, path: string, body?: unknown, token?: string, cookie?: string): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json, headers: r.headers };
}

interface ApiJson {
  [key: string]: ApiJson | ApiJson[] | string | number | boolean | null;
}

const J = (r: Res): ApiJson => r.json as ApiJson;

async function main() {
  const pre = await fetch(BASE + '/health');
  if (pre.headers.get('x-vercel-id')) {
    console.error(
      `Refusing to run: ${BASE} is proxied to the deployed app (x-vercel-id present) — ` +
      'it has a different JWT secret and no local DB. Start the local server with ' +
      'API_PROXY_TARGET= (empty) so /api/v1 serves from this checkout.',
    );
    process.exit(1);
  }

  const email = `e2e${TS}@payproof.ng`;
  let sellerToken = '';
  let sellerId = '';
  let setCookie = '';
  const regBody = {
    name: 'E2E Seller',
    email,
    password: 'E2EPass123!',
    phone: '+2348000000001',
    businessName: 'E2E Store',
    bvn: '33333333333',
    settlement: { bankCode: '058', accountNumber: '0123456789' },
  };

  // A4 flip: single-step register answers 202 {sent} + OTP email — never a token.
  const reg = await req('POST', '/auth/seller/register', {
    name: 'E2E Seller',
    email,
    password: 'E2EPass123!',
  });
  check('E01 A4 register 202, no token', reg.status === 202 && J(reg).sent === true && J(reg).token === undefined, `got ${reg.status}`);
  if (reg.status !== 202) console.log(`info E01 response: ${JSON.stringify(J(reg)).slice(0, 120)}`);

  const dupSeller = await req('POST', '/auth/seller/register', { ...regBody, email: 'ada@payproof.ng' });
  check('E01 duplicate seller email 409', dupSeller.status === 409, `got ${dupSeller.status}`);
  const dupBuyer = await req('POST', '/auth/buyer/register', { name: 'Dup Buyer', email: 'ada@payproof.ng', password: 'E2EPass123!' });
  check('A3 seller-email buyer register 409', dupBuyer.status === 409, `got ${dupBuyer.status}`);

  // e2e cannot read OTP mailboxes — the seed seller provides the token.
  const login = await req('POST', '/auth/seller/login', { email: 'ada@payproof.ng', password: 'SeedPassword123!' });
  check('E02 seed login 200', login.status === 200, JSON.stringify(J(login)).slice(0, 120));
  sellerToken = J(login).token as string;
  setCookie = login.headers.get('set-cookie') ?? '';
  check('E01 refresh cookie set', setCookie.includes('pp_refresh') && setCookie.includes('HttpOnly'));
  const me0 = await req('GET', '/auth/me', undefined, sellerToken);
  sellerId = ((J(me0).profile as { id: string } | undefined)?.id ?? '');

  const loginBad = await req('POST', '/auth/login', { email: 'ada@payproof.ng', password: 'wrong-pass-1' });
  check('A1 wrong password 401', loginBad.status === 401, `got ${loginBad.status}`);
  const loginNoBody = await req('POST', '/auth/login', {});
  check('A1 empty body 400', loginNoBody.status === 400);

  const badLogin = await req('POST', '/auth/seller/login', { email, password: 'wrong-pass-1' });
  check('E02 wrong password 401', badLogin.status === 401);
  const noBody = await req('POST', '/auth/seller/login', {});
  check('E02 empty body 400', noBody.status === 400);

  const me = await req('GET', '/auth/me', undefined, sellerToken);
  check('E05 me 200 seller', me.status === 200 && J(me).role === 'seller');
  check('E05 me leaks no secrets', JSON.stringify(J(me)).includes('passwordHash') === false);
  const meAnon = await req('GET', '/auth/me');
  check('E05 me anon 401', meAnon.status === 401);

  const origBusiness = (J(me).profile as { businessName?: string; name?: string } | undefined)?.businessName ?? '';
  const patchMe = await req('PATCH', '/auth/me', { business_name: 'E2E Updated Store', phone: '+2348000000002' }, sellerToken);
  check('A7 PATCH me 200', patchMe.status === 200 && J(patchMe).role === 'seller', `got ${patchMe.status}`);
  check('A7 response leaks no secrets', JSON.stringify(J(patchMe)).includes('passwordHash') === false);
  const patchMeBiz = await req('GET', '/auth/me', undefined, sellerToken);
  check('A7 business_name persisted', ((J(patchMeBiz).profile as { businessName?: string } | undefined)?.businessName ?? '') === 'E2E Updated Store');
  await req('PATCH', '/auth/me', { business_name: origBusiness, phone: '+2348000000001' }, sellerToken); // restore seed
  const patchAnon = await req('PATCH', '/auth/me', { name: 'x' });
  check('A7 anon 401', patchAnon.status === 401);
  const patchEmpty = await req('PATCH', '/auth/me', {}, sellerToken);
  check('A7 empty body 400', patchEmpty.status === 400);
  const patchBadBvn = await req('PATCH', '/auth/me', { bvn: '123' }, sellerToken);
  check('A7 bad bvn 400', patchBadBvn.status === 400);
  const refreshCookie = setCookie.split(';')[0];
  const ref = await req('POST', '/auth/refresh', undefined, undefined, refreshCookie);
  check('refresh rotates 200', ref.status === 200 && typeof J(ref).token === 'string');
  if (ref.status === 200) sellerToken = J(ref).token as string;
  const refBad = await req('POST', '/auth/refresh');
  check('refresh no cookie 401', refBad.status === 401);

  const p1 = await req('POST', '/products', {
    name: 'E2E Widget', priceKobo: 1000000, dispatchFeeKobo: 200000,
    deliveryDays: 2, stockQuantity: 5, description: 'E2E test widget product.',
  }, sellerToken);
  check('E10 create 201', p1.status === 201, `got ${p1.status}`);
  const pZero = await req('POST', '/products', {
    name: 'E2E Empty', priceKobo: 500000, dispatchFeeKobo: 100000,
    deliveryDays: 1, stockQuantity: 0, description: 'Zero stock test product.',
  }, sellerToken);
  check('E10 zero-stock create 201', pZero.status === 201);
  const prodId = J(p1).id;
  const zeroId = J(pZero).id;

  const list = await req('GET', `/products?seller_id=${sellerId}`, undefined, sellerToken);
  check('E08 list seller products', list.status === 200 && Array.isArray(J(list)) && (J(list) as unknown as unknown[]).length >= 2);
  const get = await req('GET', `/products/${prodId}`);
  check('E09 get 200', get.status === 200 && J(get).id === prodId);
  const getMiss = await req('GET', '/products/00000000-0000-0000-0000-000000000000');
  check('E09 missing 404', getMiss.status === 404);
  const patch = await req('PATCH', `/products/${prodId}`, { priceKobo: 1200000 }, sellerToken);
  check('E11 owner patch 200', patch.status === 200 && J(patch).priceKobo === 1200000);

  const all = await req('GET', '/products');
  const foreign = (J(all) as unknown as Array<{ id: string; seller?: { id: string } }>).find(
    (p) => p.seller?.id && p.seller.id !== sellerId,
  );
  if (foreign) {
    const patchForeign = await req('PATCH', `/products/${foreign.id}`, { priceKobo: 1 }, sellerToken);
    check('E11 non-owner 403', patchForeign.status === 403, `got ${patchForeign.status}`);
  } else {
    check('E11 non-owner 403', false, 'no foreign product found');
  }
  const anonCreate = await req('POST', '/products', { name: 'x' });
  check('E10 anon 401', anonCreate.status === 401);

  const spub = await req('GET', `/sellers/${sellerId}`);
  check('E06 public + reputation shape', spub.status === 200 && typeof J(spub).reputation === 'object');
  const dash = await req('GET', '/sellers/me/dashboard', undefined, sellerToken);
  check('E07 dashboard 200', dash.status === 200 && J(dash).reserved_account !== undefined && J(dash).counts_by_status !== undefined);

  const buyerEmail = `e2ebuyer${TS}@payproof.ng`;
  const otpReq = await req('POST', '/auth/buyer/otp/request', { email: buyerEmail });
  check('E03 otp accepted, no dev_code leak', otpReq.status === 202 && J(otpReq).dev_code === undefined, `got ${otpReq.status}`);
  if (otpReq.status !== 202) console.log(`info E03 response: ${JSON.stringify(J(otpReq)).slice(0, 120)}`);
  const otpWrong = await req('POST', '/auth/buyer/otp/verify', { email: buyerEmail, code: '000000' });
  check('E04 wrong code 400', otpWrong.status === 400);
  const otpVerifyWrong = await req('POST', '/auth/otp/verify', { email: buyerEmail, code: '000000' });
  check('A2 wrong code 400', otpVerifyWrong.status === 400, `got ${otpVerifyWrong.status}`);
  await db.buyer.upsert({ where: { email: buyerEmail }, update: {}, create: { email: buyerEmail } });
  const buyer = await db.buyer.findUniqueOrThrow({ where: { email: buyerEmail } });
  const buyerToken = signAccessToken({ sub: buyer.id, role: 'buyer' });
  const crossTable = await req('POST', '/auth/seller/register', { name: 'Cross', email: buyerEmail, password: 'E2EPass123!' });
  check('uniqueness buyer-email seller register 409', crossTable.status === 409, `got ${crossTable.status}`);
  const patchBuyer = await req('PATCH', '/auth/me', { name: 'x' }, buyerToken);
  check('A7 buyer forbidden 401', patchBuyer.status === 401, `got ${patchBuyer.status}`);

  const oos = await req('POST', '/orders', { product_id: zeroId, delivery_address: '14 Allen Avenue, Ikeja, Lagos' }, buyerToken);
  check('E12 out-of-stock 409', oos.status === 409, `got ${oos.status}`);

  async function makeOrder() {
    const o = await req('POST', '/orders', {
      product_id: prodId, delivery_address: '14 Allen Avenue, Ikeja, Lagos', phone: '+2348077777777',
    }, buyerToken);
    if (o.status !== 201) throw new Error('order create failed: ' + JSON.stringify(J(o)).slice(0, 200));
    return { id: (J(o).order as { id: string }).id, ref: (J(o).payment as { reference: string }).reference };
  }
  const o1 = await makeOrder();
  check('E12 create 201 + checkout', true);
  const oList = await req('GET', '/orders', undefined, buyerToken);
  check('E13 buyer list', oList.status === 200 && Array.isArray(J(oList)));
  const oDetail = await req('GET', `/orders/${o1.id}`, undefined, buyerToken);
  check('E14 pending shape', oDetail.status === 200 && J(oDetail).status === 'PendingPayment' && Array.isArray(J(oDetail).events));
  const oForeign = await req('GET', `/orders/${o1.id}`);
  check('E14 anon 401', oForeign.status === 401);
  const sellerCantOrder = await req('POST', '/orders', { product_id: prodId, delivery_address: '14 Allen Avenue, Ikeja, Lagos' }, sellerToken);
  check('E12 seller forbidden 403', sellerCantOrder.status === 403);

  const sim = await req('POST', '/monnify/simulate', { payment_reference: o1.ref });
  check('simulate → AwaitingShipment', sim.status === 200 && J(sim).status === 'AwaitingShipment', `got ${sim.status}`);
  const ship = await req('POST', `/orders/${o1.id}/ship`, { tracking_number: 'E2E123' }, sellerToken);
  check('E17 ship 200', ship.status === 200);
  const shipAgain = await req('POST', `/orders/${o1.id}/ship`, {}, sellerToken);
  check('E17 reship 409', shipAgain.status === 409);
  const buyerShip = await req('POST', `/orders/${o1.id}/ship`, {}, buyerToken);
  check('E17 buyer 403', buyerShip.status === 403);
  const track = await req('PATCH', `/orders/${o1.id}/tracking`, { tracking_status: 'In Transit' }, sellerToken);
  check('E18 tracking forward 200', track.status === 200);
  const trackBack = await req('PATCH', `/orders/${o1.id}/tracking`, { tracking_status: 'Picked Up' }, sellerToken);
  check('E18 tracking backward 400', trackBack.status === 400);

  const confirm = await req('POST', `/orders/${o1.id}/confirm-delivery`, undefined, buyerToken);
  const payoutFailed = confirm.status === 502;
  check('E19 confirm → Completed', confirm.status === 200, `got ${confirm.status}`);
  if (payoutFailed) {
    console.log('info E19 payout rail failed in sandbox (transfers not enabled) — checking order still Completed');
  }
  const afterConfirm = await req('GET', `/orders/${o1.id}`, undefined, buyerToken);
  check('order Completed after confirm', J(afterConfirm).status === 'Completed', `got ${J(afterConfirm).status}`);
  const payoutView = await req('GET', `/orders/${o1.id}/payout`, undefined, buyerToken);
  check('E21 payout view 200', payoutView.status === 200 && J(payoutView).status !== undefined);

  const o2 = await makeOrder();
  await req('POST', '/monnify/simulate', { payment_reference: o2.ref });
  await req('POST', `/orders/${o2.id}/ship`, {}, sellerToken);
  const dispute = await req('POST', `/orders/${o2.id}/report-issue`, { reason: 'Item arrived damaged, screen cracked on arrival.' }, buyerToken);
  check('E20 dispute 200', dispute.status === 200 && J(dispute).status === 'Disputed');
  const frozenView = await req('GET', `/orders/${o2.id}/payout`, undefined, buyerToken);
  check('E21 disputed frozen', frozenView.status === 200 && J(frozenView).status === 'frozen');
  const confirmDisputed = await req('POST', `/orders/${o2.id}/confirm-delivery`, undefined, buyerToken);
  check('E19 on Disputed 409', confirmDisputed.status === 409, `got ${confirmDisputed.status}`);

  const o3 = await makeOrder();
  const cancel = await req('POST', `/orders/${o3.id}/cancel`, undefined, buyerToken);
  check('E24 cancel 200', cancel.status === 200 && J(cancel).status === 'Cancelled');
  const cancelPaid = await req('POST', `/orders/${o1.id}/cancel`, undefined, buyerToken);
  check('E24 cancel Completed 409', cancelPaid.status === 409);

  const o4 = await makeOrder();
  const verify = await req('POST', `/orders/${o4.id}/verify`, undefined, buyerToken);
  check('E15 verify live unpaid', verify.status === 200 && J(verify).verified === false, `got ${verify.status}`);

  const ai = await req('POST', `/orders/${o1.id}/assistant`, { message: 'Where is my order?' }, buyerToken);
  console.log(`info E22 assistant → ${ai.status} (502 without GEMINI_API_KEY is expected)`);
  const aiEmpty = await req('POST', `/orders/${o1.id}/assistant`, { message: '' }, buyerToken);
  check('E22 empty message 400', aiEmpty.status === 400);

  const whUnknown = await req('POST', '/monnify/webhook', {
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: { transactionReference: 'E2E-UNKNOWN-1', paymentReference: 'pp_ord_nonexistent', amountPaid: 100 },
  });
  check('E16 unknown ref 200-ignore', whUnknown.status === 200);
  const whOther = await req('POST', '/monnify/webhook', { eventType: 'SOMETHING_ELSE', eventData: {} });
  check('E16 non-txn event 200-ignore', whOther.status === 200);

  const health = await req('GET', '/health');
  check('E23 health ok', health.status === 200 && J(health).ok === true);

  console.log(`\n==== E2E SMOKE: ${pass} passed, ${fail} failed ====`);
  if (failures.length > 0) console.log('FAILED: ' + failures.join(', '));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E CRASH: ' + (err as Error).message);
  process.exit(1);
});
