import db from '../lib/db';

const BASE = 'http://localhost:3000/api/v1';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`ok   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${detail}`.trim());
  }
}

async function main() {
  const email = 'tobi@payproof.ng';
  const otpReq = await fetch(BASE + '/auth/buyer/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { dev_code } = (await otpReq.json()) as { dev_code: string };
  const otpVerify = await fetch(BASE + '/auth/buyer/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: dev_code }),
  });
  const { token } = (await otpVerify.json()) as { token: string };
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const product = await db.product.findFirst({ where: { name: 'Solar Desk Lamp' } });
  if (!product) throw new Error('Solar Desk Lamp missing — run seed first');

  const created = await fetch(BASE + '/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ product_id: product.id, delivery_address: '14 Allen Avenue, Ikeja, Lagos' }),
  });
  if (created.status !== 201) throw new Error('order create failed: ' + (await created.text()).slice(0, 200));
  const { order, payment } = (await created.json()) as {
    order: { id: string };
    payment: { reference: string };
  };
  const orderId = order.id;
  const ourRef = payment.reference;

  const payRow = await db.payment.findFirst({ where: { orderId } });
  const liveRef = payRow?.providerRef;
  if (!liveRef) throw new Error('payment row missing providerRef');
  const payload = {
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      transactionReference: liveRef,
      paymentReference: ourRef,
      amountPaid: product.priceKobo + product.dispatchFeeKobo,
    },
  };

  const t1 = await fetch(BASE + '/monnify/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  check('T1 webhook 200', t1.status === 200, `got ${t1.status}`);
  const after = await db.order.findUnique({
    where: { id: orderId },
    include: { orderEvents: true, payments: true },
  });
  check('T1 stays PendingPayment', after!.status === 'PendingPayment', `got ${after!.status}`);
  const mismatchEvents = after!.orderEvents.filter((e) => (e.note ?? '').includes('PAYMENT_MISMATCH'));
  check('T1 exactly 1 PAYMENT_MISMATCH event', mismatchEvents.length === 1, `got ${mismatchEvents.length}`);
  check('T1 payment row untouched (still pending)', after!.payments[0].status === 'pending');

  const t2 = await fetch(BASE + '/monnify/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const afterReplay = await db.order.findUnique({
    where: { id: orderId },
    include: { orderEvents: true },
  });
  const mismatchAfter = afterReplay!.orderEvents.filter((e) => (e.note ?? '').includes('PAYMENT_MISMATCH'));
  check('T2 replay 200 + no duplicate event', t2.status === 200 && mismatchAfter.length === 1);

  const t3 = await fetch(BASE + '/monnify/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: { transactionReference: 'E2E-NOPE-1', paymentReference: 'pp_ord_nonexistent', amountPaid: 100 },
    }),
  });
  check('T3 unknown ref 200-ignore', t3.status === 200);

  const t4 = await fetch(BASE + '/monnify/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'this is not json{{{',
  });
  check('T4 malformed 200', t4.status === 200);

  console.log(`\n==== WEBHOOK CHECK: ${pass} passed, ${fail} failed ====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('WEBHOOK_CHECK_CRASH: ' + (err as Error).message);
  process.exit(1);
});
