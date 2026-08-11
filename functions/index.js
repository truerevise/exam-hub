const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');
const Razorpay = require('razorpay');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

const functionsSecrets = [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET];

function razorpayClient() {
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID.value(),
    key_secret: RAZORPAY_KEY_SECRET.value()
  });
}

async function getPassSettings() {
  const snap = await db.doc('passSettings/main').get();
  const data = snap.exists ? snap.data() : {};
  const price = Math.max(1, Number(data.price || 20));
  const validityDays = Math.max(1, Number(data.validityDays || 30));
  return { price, validityDays };
}

exports.createPremiumOrder = onCall({ secrets: functionsSecrets, cors: ['https://truerevise.github.io'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');

  const { price, validityDays } = await getPassSettings();
  const amount = Math.round(price * 100);
  const receipt = `eh_${request.auth.uid.slice(0, 12)}_${Date.now()}`;
  const order = await razorpayClient().orders.create({
    amount,
    currency: 'INR',
    receipt,
    notes: { uid: request.auth.uid, validityDays: String(validityDays), product: 'Exam Hub Premium Pass' }
  });

  await db.collection('paymentOrders').doc(order.id).set({
    uid: request.auth.uid,
    orderId: order.id,
    amount,
    currency: 'INR',
    validityDays,
    status: 'created',
    createdAt: FieldValue.serverTimestamp()
  });

  return { orderId: order.id, amount, currency: 'INR', keyId: RAZORPAY_KEY_ID.value(), validityDays };
});

exports.verifyPremiumPayment = onCall({ secrets: functionsSecrets, cors: ['https://truerevise.github.io'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new HttpsError('invalid-argument', 'Incomplete payment details.');
  }

  const orderRef = db.collection('paymentOrders').doc(razorpay_order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError('not-found', 'Payment order not found.');
  const order = orderSnap.data();
  if (order.uid !== request.auth.uid) throw new HttpsError('permission-denied', 'This payment belongs to another account.');
  if (order.status === 'paid') return { success: true, alreadyProcessed: true };

  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET.value())
    .update(`${order.orderId}|${razorpay_payment_id}`)
    .digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
  if (!valid) throw new HttpsError('permission-denied', 'Payment verification failed.');

  const payment = await razorpayClient().payments.fetch(razorpay_payment_id);
  if (payment.order_id !== order.orderId || Number(payment.amount) !== Number(order.amount) || payment.currency !== 'INR') {
    throw new HttpsError('failed-precondition', 'Payment details do not match the order.');
  }
  if (payment.status !== 'captured') {
    throw new HttpsError('failed-precondition', 'Payment is not captured yet.');
  }

  const studentRef = db.doc(`students/${request.auth.uid}`);
  const studentSnap = await studentRef.get();
  const existingUntil = studentSnap.exists ? Number(studentSnap.data().premiumUntil || 0) : 0;
  const base = Math.max(Date.now(), existingUntil);
  const premiumUntil = base + Number(order.validityDays || 30) * 24 * 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    tx.update(orderRef, {
      status: 'paid',
      paymentId: razorpay_payment_id,
      paidAt: FieldValue.serverTimestamp()
    });
    tx.set(studentRef, {
      premium: true,
      premiumUntil,
      premiumActivatedAt: FieldValue.serverTimestamp(),
      lastPremiumPaymentId: razorpay_payment_id
    }, { merge: true });
  });

  return { success: true, premiumUntil };
});

exports.razorpayWebhook = onRequest({ secrets: [RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const signature = req.get('x-razorpay-signature') || '';
  const rawBody = req.rawBody;
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value()).update(rawBody).digest('hex');
  if (!signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(401).send('Invalid signature');

  const event = req.body || {};
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment?.id) {
      const orderRef = db.collection('paymentOrders').doc(payment.order_id);
      const snap = await orderRef.get();
      if (snap.exists && snap.data().status !== 'paid') {
        const order = snap.data();
        const studentRef = db.doc(`students/${order.uid}`);
        const studentSnap = await studentRef.get();
        const existingUntil = studentSnap.exists ? Number(studentSnap.data().premiumUntil || 0) : 0;
        const premiumUntil = Math.max(Date.now(), existingUntil) + Number(order.validityDays || 30) * 24 * 60 * 60 * 1000;
        await db.runTransaction(async (tx) => {
          tx.update(orderRef, { status: 'paid', paymentId: payment.id, paidAt: FieldValue.serverTimestamp(), source: 'webhook' });
          tx.set(studentRef, { premium: true, premiumUntil, premiumActivatedAt: FieldValue.serverTimestamp(), lastPremiumPaymentId: payment.id }, { merge: true });
        });
      }
    }
  }
  return res.status(200).json({ received: true });
});
