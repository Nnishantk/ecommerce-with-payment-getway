const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Brand = require("../models/brandModel");
const { multipleFileHandle } = require("../utils/fileHandle");

exports.createBrand = catchAsyncErrors(async (req, res, next) => {
  const imagesLinks = await multipleFileHandle(req.files);

  req.body.brandIcon = imagesLinks[0];

  req.body.user = req.user.id;

  const category = await Brand.create(req.body);

  res.status(201).json({
    success: true,
    category,
  });
});

exports.createCoupon = catchAsyncErrors(async (req, res, next) => {});

exports.updateBrand = catchAsyncErrors(async (req, res, next) => {});
