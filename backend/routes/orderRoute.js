const express = require("express");
const orderController = require("../controllers/orderController");
const router = express.Router();

const { isAuthenticatedUser, authorizeRoles } = require("../middleware/auth");

router.post("/checkout", isAuthenticatedUser, orderController.checkout);

router.post("/place-order", isAuthenticatedUser, orderController.placeOrder);

router.get("/orders/me", isAuthenticatedUser, orderController.getOrders)

// router.route("/order/new").post(isAuthenticatedUser, newOrder);

router.route("/order/:id").get(isAuthenticatedUser, orderController.getSingleOrder);

// router.route("/orders/me").get(isAuthenticatedUser, myOrders);

// router
//   .route("/admin/orders")
//   .get(isAuthenticatedUser, authorizeRoles("admin"), getAllOrders);

router
  .route("/admin/order/:id")
  .put(isAuthenticatedUser, authorizeRoles("admin"), orderController.updateOrder)
//   .delete(isAuthenticatedUser, authorizeRoles("admin"), deleteOrder);

module.exports = router;
