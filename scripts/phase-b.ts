import db from '../lib/db';

const BASE = 'https://payproof-seven.vercel.app/api/v1';
const PRODUCT = 'Solar Desk Lamp';

async function otp(email: string): Promise<string> {
  const q = await fetch(BASE + '/auth/buyer/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { dev_code, delivery } = (await q.json()) as { dev_code?: string; delivery: string };
  if (!dev_code) throw new Error('No dev_code (deploy OTP_MODE is not dev?) delivery=' + delivery);
  const v = await fetch(BASE + '/auth/buyer/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: dev_code }),
  });
  const { token } = (await v.json()) as { token: string };
  return token;
}

async function main() {
  const mode = process.argv[2];
  const buyerEmail = 'tobi@payproof.ng';
  const buyerToken = await otp(buyerEmail);
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` };

  if (mode === 'prepare') {
    const product = await db.product.findFirst({ where: { name: PRODUCT } });
    if (!product || product.stockQuantity <= 0) throw new Error('Solar out of stock');
    const o = await fetch(BASE + '/orders', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        product_id: product.id,
        delivery_address: '14 Allen Avenue, Ikeja, Lagos',
        phone: '+2348077777777',
      }),
    });
    if (o.status !== 201) throw new Error('order failed: ' + (await o.text()).slice(0, 200));
    const { order, payment } = (await o.json()) as {
      order: { id: string };
      payment: { reference: string; checkout_url: string };
    };
    console.log('ORDER_ID=' + order.id);
    console.log('PAYREF=' + payment.reference);
    console.log('CHECKOUT_URL=' + payment.checkout_url);
  } else if (mode === 'complete') {
    const orderId = process.argv[3];
    if (!orderId) throw new Error('Usage: phase-b.ts complete <orderId>');

    let status = '';
    for (let i = 0; i < 40; i++) {
      const g = await fetch(`${BASE}/orders/${orderId}`, { headers: auth });
      const j = (await g.json()) as { status: string };
      status = j.status;
      console.log(`POLL ${i + 1} status=${status}`);
      if (status !== 'PendingPayment') break;
      await new Promise((r) => setTimeout(r, 15000));
    }
    if (status !== 'AwaitingShipment' && status !== 'Paid') {
      throw new Error('Payment not detected after 10min. Pay the checkout first.');
    }

    const login = await fetch(BASE + '/auth/seller/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emeka@payproof.ng', password: 'SeedPassword123!' }),
    });
    const { token: sellerToken } = (await login.json()) as { token: string };
    const sauth = { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` };

    const ship = await fetch(`${BASE}/orders/${orderId}/ship`, {
      method: 'POST',
      headers: sauth,
      body: JSON.stringify({ tracking_number: 'PHASEB1' }),
    });
    console.log('SHIP=' + ship.status);
    const confirm = await fetch(`${BASE}/orders/${orderId}/confirm-delivery`, {
      method: 'POST',
      headers: auth,
    });
    console.log('CONFIRM=' + confirm.status + ' ' + (await confirm.text()).slice(0, 300));
    const payout = await fetch(`${BASE}/orders/${orderId}/payout`, { headers: auth });
    console.log('PAYOUT=' + (await payout.text()).slice(0, 400));
  } else {
    throw new Error('Usage: phase-b.ts <prepare|complete> [orderId]');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('PHASEB_CRASH: ' + (err as Error).message);
  process.exit(1);
});
