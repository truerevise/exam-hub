const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();
const db = getFirestore();

// Callable functions already enforce Firebase Auth before creating an order.
// Allow the public True Revise web client to complete the browser preflight.
// This fixes the situation where OPTIONS succeeds but the browser never sends
// the actual POST to the callable endpoint.
const callableOptions = {
  secrets: functionsSecrets,
  cors: true
};

exports.razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const signature = req.get('x-razorpay-signature') || '';
  const rawBody = req.rawBody;
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value())
    .update(rawBody)
    .digest('hex');
  if (!safeEqualHex(expected, signature)) return res.status(401).send('Invalid signature');

  const event = req.body || {};
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment?.id) {
      const orderRef = db.collection('paymentOrders').doc(payment.order_id);
      const orderSnap = await orderRef.get();
      if (orderSnap.exists && orderSnap.data().status !== 'paid') {
        await db.runTransaction(async (tx) => {
          const freshOrderSnap = await tx.get(orderRef);
          if (!freshOrderSnap.exists) return;
          const order = freshOrderSnap.data();
          if (order.status === 'paid') return;

          const studentRef = db.doc(`students/${order.uid}`);
          const studentSnap = await tx.get(studentRef);
          const existingUntil = studentSnap.exists ? Number(studentSnap.data().premiumUntil || 0) : 0;
          const premiumUntil = Math.max(Date.now(), existingUntil) + Number(order.validityDays || 30) * 24 * 60 * 60 * 1000;

          tx.update(orderRef, {
            status: 'paid',
            paymentId: payment.id,
            paidAt: FieldValue.serverTimestamp(),
            source: 'webhook'
          });
          tx.set(studentRef, {
            premium: true,
            premiumUntil,
            premiumActivatedAt: FieldValue.serverTimestamp(),
            lastPremiumPaymentId: payment.id
          }, { merge: true });
        });
      }
    }
  }

  return res.status(200).json({ received: true });
});