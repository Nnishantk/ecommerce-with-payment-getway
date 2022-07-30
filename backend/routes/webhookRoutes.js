const router = require("express").Router();
const webhookController = require("../controllers/webhookController");

router.post("/razorpay", webhookController.razorpayWebhook);

module.exports = router;