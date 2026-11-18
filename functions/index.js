const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');

const disabledPayment = async () => {
  throw new HttpsError(
    'failed-precondition',
    'Premium Pass payments are disabled. All TrueRevise student features are free.'
  );
};

// Keep existing deployed callable endpoints in place, but reject all new
// payment creation and verification requests.
exports.createPremiumOrder = onCall({ cors: true }, disabledPayment);
exports.verifyPremiumPayment = onCall({ cors: true }, disabledPayment);

// Keep the existing webhook endpoint in place and reject Razorpay callbacks.
exports.razorpayWebhook = onRequest({ cors: false }, async (req, res) => {
  return res.status(410).json({
    error: 'Premium Pass payments are disabled. All TrueRevise student features are free.'
  });
});
