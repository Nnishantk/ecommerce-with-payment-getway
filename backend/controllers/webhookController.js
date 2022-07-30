const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const crypto = require("crypto");
console.log(process.env.RAZORPAY_SECRET_KEY);
console.log(process.env.RAZORPAY_API_KEY);

exports.razorpayWebhook = async (req, res) => {
  try {
    console.log("webhook");
    console.log(req.body.event);
    const webhookPayloadJson = JSON.stringify(req.body);
    const receivedRazorpaySignature = req.headers["x-razorpay-signature"];
    console.log(req.headers);

    const calculatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookPayloadJson)
      .digest("hex");

    if (receivedRazorpaySignature !== calculatedSignature) {
      console.log("hmac signature does not matches");
      console.log(receivedRazorpaySignature);
      console.log(calculatedSignature);
      return res.sendStatus(400);
    }

    const webhookPayload = req.body;

    switch (webhookPayload.event) {
      case "order.paid":
        await updateOrderStatus(webhookPayload.payload.order.entity.id, "paid");
        break;
      case "payment.failed":
        await updateOrderStatus(
          webhookPayload.payload.payment.entity.order_id,
          "failed"
        );
        break;
      default:
        break;
    }

    return res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
};

const updateOrderStatus = async (razorpayOrderId, status) => {
  try {
    const order = await Order.findOne({ paymentGatewayOrderId: razorpayOrderId });
    order.paymentStatus = status;
    await order.save();

    if (status == "paid") {
      await deleteCart(order.user);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const deleteCart = async (userId) => {
  try {
    await Cart.deleteOne({ user: userId });
    await Cart.create({user: userId});
  } catch (error) {
    console.log(error);
    throw error;
  }
};
