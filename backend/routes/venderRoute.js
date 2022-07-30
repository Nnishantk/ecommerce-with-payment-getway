const express = require("express");
const {
  registerVender,
  venderLogin,
  createProduct,
  getVenderDetails,
  changeVenderStatus,
  updateVender,
  singleVenderProducts,
} = require("../controllers/venderController");
const { isAuthenticatedUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.route("/register").post(registerVender);

router.route("/login").post(venderLogin);

router
  .route("/product/new")
  .post(isAuthenticatedUser, authorizeRoles("vender"), createProduct);

router
  .route("/products")
  .get(isAuthenticatedUser, authorizeRoles("vender"), singleVenderProducts);

router
  .route("/:id")
  .get(isAuthenticatedUser, authorizeRoles("vender"), getVenderDetails)
  .put(isAuthenticatedUser, authorizeRoles("vender"), updateVender);

router
  .route("/status")
  .put(isAuthenticatedUser, authorizeRoles("admin"), changeVenderStatus);

module.exports = router;
