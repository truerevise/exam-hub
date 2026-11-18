const { onRequest } = require('firebase-functions/v2/https');

// Premium Pass payments have been retired. Keep the old webhook URL safely
// disabled so Razorpay cannot activate paid access or write payment records.
exports.razorpayWebhook = onRequest({ cors: false }, async (req, res) => {
  return res.status(410).json({
    error: 'Premium Pass payments are disabled. All TrueRevise student features are free.'
  });
});
