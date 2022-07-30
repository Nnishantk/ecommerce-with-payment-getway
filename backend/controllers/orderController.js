const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Vender = require("../models/vendorModel");
const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});
// Create new Order
// exports.newOrder = catchAsyncErrors(async (req, res, next) => {
//   const {
//     shippingInfo,
//     orderItems,
//     paymentInfo,
//     itemsPrice,
//     taxPrice,
//     shippingPrice,
//     totalPrice,
//   } = req.body;

//   // const productIds = orderItems.map((order) => order.product);
//   // let venders = []

//   // for (let i = 0; productIds.length > 0; i++) {
//   //   const product = await Product.findById(productIds[i]);
//   //   const vender = await Vender.aggregate([
//   //     { $match: { _id: product.user } },
//   //     { $project: { _id: 1 } },
//   //   ]);

//   // }

//   const order = await Order.create({
//     shippingInfo,
//     orderItems,
//     paymentInfo,
//     itemsPrice,
//     taxPrice,
//     shippingPrice,
//     totalPrice,
//     paidAt: Date.now(),
//     user: req.user._id,
//   });

//   res.status(201).json({
//     success: true,
//     order,
//   });
// });

// // get Single Order
exports.getSingleOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email"
  );

  if (!order) {
    return next(new ErrorHander("Order not found with this Id", 404));
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// get logged in user  Orders
exports.myOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id });

  res.status(200).json({
    success: true,
    orders,
  });
});

// get all Orders -- Admin
exports.getAllOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find().populate("orderItems.product");

  let totalAmount = 0;

  orders.forEach((order) => {
    totalAmount += order.totalPrice;
  });

  res.status(200).json({
    success: true,
    totalAmount,
    orders,
  });
});

//get all Orders - Vender
exports.getAllOrdersVender = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.aggregate([
    {
      $project: {
        orderItems: {
          $filter: {
            input: "$orderItems",
            as: "newOrderItems",
            cond: { "$$newOrderItems.venderId": req.user._id },
          },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    orders,
  });
});

// // update Order Status -- Admin
exports.updateOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHander("Order not found with this Id", 404));
  }

  if (order.orderStatus === "Delivered") {
    return next(new ErrorHander("You have already delivered this order", 400));
  }

  if (req.body.status === "Shipped") {
    order.orderItems.forEach(async (o) => {
      await updateStock(o.product, o.quantity);
    });
  }
  order.orderStatus = req.body.status;

  if (req.body.status === "Delivered") {
    order.deliveredAt = Date.now();
  }

  await order.save({ validateBeforeSave: false });
  res.status(200).json({
    success: true,
  });
});

async function updateStock(id, quantity) {
  const product = await Product.findById(id);

  product.Stock -= quantity;

  await product.save({ validateBeforeSave: false });
}

// // delete Order -- Admin
// exports.deleteOrder = catchAsyncErrors(async (req, res, next) => {
//   const order = await Order.findById(req.params.id);

//   if (!order) {
//     return next(new ErrorHander("Order not found with this Id", 404));
//   }

//   await order.remove();

//   res.status(200).json({
//     success: true,
//   });
// });

exports.checkout = async (req, res, next) => {
  try {
    await Order.findOneAndDelete({
      user: req.user._id,
      orderStatus: "unconfirmed",
    });

    const { address } = req.body;

    const cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path: "products.product",
        select: { review: 0 },
      })
      .populate({
        path: "coupon",
        select: "couponCode discount expirationDate",
      });

    const order = new Order({ user: req.user._id, address });

    let grandTotal = 0;

    const orderProducts = cart.products.map((cartProduct) => {
      const total = cartProduct.quantity * cartProduct.product.price;
      grandTotal += total;
      return {
        product: cartProduct.product._id,
        unitPrice: cartProduct.product.price,
        quantity: cartProduct.quantity,
        total,
      };
    });

    order.products = orderProducts;

    if (cart.coupon) {
      order.coupon = cart.coupon._id;
      order.discount = 0.01 * cart.coupon.discount * grandTotal;
    }

    order.grandTotal = grandTotal;
    order.shippingPrice = 10;
    order.amountToBePaid = grandTotal + order.shippingPrice - order.discount;

    await order.save();

    await order.populate([
      { path: "products.product", select: { reviews: 0 } },
      {
        path: "coupon",
        select: "couponCode discount expirationDate",
      },
    ]);

    return res.status(200).json({
      success: true,
      msg: "order created",
      order,
    });
  } catch (error) {
    next(error);
  }
};

exports.placeOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      user: req.user._id,
      orderStatus: "unconfirmed",
    });

    const amount = order.amountToBePaid;

    const orderOptions = {
      amount: amount * 100,
      currency: "INR",
    };

    const paymentGatewayOrder = await razorpayInstance.orders.create(
      orderOptions
    );

    order.paymentGatewayOrderId = paymentGatewayOrder.id;
    order.orderStatus = "confirmed";
    await order.save();

    return res.status(200).json({
      msg: "order id",
      orderId: paymentGatewayOrder.id,
      amount: amount,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
      orderStatus: "confirmed",
    }).populate({
      path: "products.product",
      select: {
        reviews: 0
      }
    }).populate({
      path: "coupon",
      select: "couponCode discount expirationDate"
    });

    return res.status(200).json({
      success: true,
      msg: "orders of user",
      orders
    })
  } catch (error) {
    next(error);
  }
};
