const express = require("express");
const {
  createCategory,
  getCategories,
  createSubCategory
} = require("../controllers/categoryController");
const { isAuthenticatedUser, authorizeRoles } = require("../middleware/auth");
const upload = require("../middleware/fileUpload");


const router = express.Router();

router
  .route("/admin/category/new").post(
     upload.single("image"),
      createCategory,
    );

 router.route("/admin/subCategory/new").post( upload.single("image"),createSubCategory) 

router.route("/getAllCategory").get(getCategories);

module.exports = router;
